import {
  AnalysisBranchExitBehaviour,
  GameState,
  PauseReason,
  ResultReason,
  ResultState,
  type IBoardPosition,
  type IGame,
  type IMove,
  type IMoveNode,
} from '@/contracts';
import { MoveApplicationService, MoveHistoryService, UserSettingService } from '@/domain';
import { getOpponentColour } from '@/utility/chess/BoardUtility';
import { ClockTimestamp } from '@/utility/date';
import type { GameAnalysisComposable } from './GameAnalysisComposable';
import type { GameClockComposable } from './GameClockComposable';
import type { GamePlayerTurnComposable } from './GamePlayerTurnComposable';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGameMoveDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  clock: GameClockComposable;
  analysis: GameAnalysisComposable;
  playerTurn: GamePlayerTurnComposable;
  touchGame: (game: IGame) => void;
}

export function useGameMove(dependency: IGameMoveDependency) {
  const { position, status, clock, analysis, playerTurn, touchGame } = dependency;
  function commitLiveMove(game: IGame, move: IMove): void {
    const livePath = game.livePath;
    if (!livePath) throw new ReferenceError('live path is undefined even though we are making a live move');
    const isLivePositionRendered = position.pathsEqual(game.renderedPath, livePath);
    const parentNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    const nextClockSnapshot = clock.applyMove(game, move.movingColour, new ClockTimestamp());
    if (parentNode.children.length > 0) MoveHistoryService.pruneFutureMoves(parentNode);
    MoveApplicationService.applyMove(livePosition, move);
    const nextNodeIdx = parentNode.children.length;
    const nextNode = MoveHistoryService.addMainlineMove(parentNode, move, nextClockSnapshot);
    const nextLivePath = position.getPathToNode(nextNode);
    position.setLivePath(game, nextLivePath, { node: nextNode, position: livePosition });
    if (isLivePositionRendered) position.setRenderedPath(game, nextLivePath, { node: nextNode, position: livePosition });
    else position.setRenderedPath(game, [...game.renderedPath, nextNodeIdx]);
    game.clockSnapshot = nextClockSnapshot;
    status.updatePositionResult(game, livePosition);
    status.updateGameStateAfterPosition(game, livePosition.sideToMove);
    touchGame(game);
    playerTurn.clearPlayerTurnRuntime(game);
    clock.refreshRuntimeRegistrations(game);
    void analysis.refreshAnalysisForGame(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
  }
  function commitHistoryRewriteMove(game: IGame, move: IMove): void {
    const renderedNode = position.getRenderedNode(game);
    const renderedPosition = position.getRenderedPosition(game);
    position.setLivePath(game, game.renderedPath, { node: renderedNode, position: renderedPosition });
    game.clockSnapshot = renderedNode.clockSnapshot ?? game.clockSnapshot;
    commitLiveMove(game, move);
  }
  function advanceRenderedAnalysisBranch(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove): IBoardPosition {
    let renderedPosition = parentPosition;
    if (game.livePath !== undefined && renderedPosition === position.getLivePosition(game)) renderedPosition = MoveApplicationService.genPosition(renderedPosition, []);
    MoveApplicationService.applyMove(renderedPosition, move);
    const nextNode = MoveHistoryService.addAnalysisMove(parentNode, move);
    position.setRenderedPath(game, position.getPathToNode(nextNode), { node: nextNode, position: renderedPosition });
    return renderedPosition;
  }
  function commitLiveHistoryAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove, exitBehaviour: AnalysisBranchExitBehaviour): void {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    if (exitBehaviour === AnalysisBranchExitBehaviour.ReturnToLiveNode) {
      const liveNode = position.getLiveNode(game);
      const livePosition = position.getLivePosition(game);
      position.setRenderedPath(game, game.livePath!, { node: liveNode, position: livePosition });
      game.gameState = status.getLiveState(livePosition.sideToMove);
      touchGame(game);
      return;
    }
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedPosition.sideToMove);
    touchGame(game);
    void analysis.refreshAnalysisForGame(game);
  }
  function commitLiveAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove): void {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedPosition.sideToMove);
    touchGame(game);
  }
  function commitStandaloneAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove): void {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    status.updatePositionResult(game, renderedPosition);
    status.updateGameStateAfterPosition(game, renderedPosition.sideToMove);
    touchGame(game);
  }
  function replaceWithAnalysisRoot(game: IGame, rootPosition: IBoardPosition, nextState: GameState): void {
    const nextClockSnapshot = clock.initialiseClockSnapshot(game.timeControl);
    game.rootPosition = rootPosition;
    const nextMoveTree = MoveHistoryService.createMoveTree(nextClockSnapshot);
    position.replaceMoveTree(game, nextMoveTree);
    position.setRenderedPath(game, [], { node: nextMoveTree.root });
    position.setLivePath(game, undefined);
    game.clockSnapshot = nextClockSnapshot;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    playerTurn.clearPlayerTurnRuntime(game);
    game.gameState = nextState;
    touchGame(game);
  }
  async function makeMove(game: IGame, move: IMove): Promise<void> {
    status.assertMoveAllowed(game);
    if (status.isOngoingLiveGame(game) && status.isLiveState(game.gameState)) {
      await playerTurn.attemptPlayerMove(game, move);
      return;
    }
    const parentNode = position.getRenderedNode(game);
    const parentPosition = position.getRenderedPosition(game);
    if (status.isOngoingLiveGame(game) && status.isLiveHistoryReview(game)) {
      if (game.gameplayOptions.allowTakeback) commitHistoryRewriteMove(game, move);
      else commitLiveHistoryAnalysisMove(game, parentNode, parentPosition, move, UserSettingService.getSettings().gameplay.analysisBranchExitBehaviour);
      return;
    }
    if (status.isOngoingLiveGame(game)) commitLiveAnalysisMove(game, parentNode, parentPosition, move);
    else commitStandaloneAnalysisMove(game, parentNode, parentPosition, move);
  }
  async function takeBack(game: IGame, moveCount: number = 1): Promise<void> {
    status.assertNotPausedForAction(game, 'Takeback');
    const targetNode = position.getRenderedNode(game);
    const fallbackNode = MoveHistoryService.takeBack(targetNode, moveCount);
    const fallbackPath = position.getPathToNode(fallbackNode);
    const hasLivePath = game.livePath !== undefined;
    position.setRenderedPath(game, fallbackPath, { node: fallbackNode });
    if (hasLivePath) position.setLivePath(game, fallbackPath, { node: fallbackNode });
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    playerTurn.clearPlayerTurnRuntime(game);
    status.updateGameStateAfterPosition(game, position.getRenderedPosition(game).sideToMove);
    touchGame(game);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
    await analysis.refreshAnalysisForGame(game);
  }
  function navigateToNode(game: IGame, node: IMoveNode): void {
    status.assertNotPausedForAction(game, 'History navigation');
    if (!position.isNodeInTree(game.moveTree, node)) return;
    const nextPath = position.getPathToNode(node);
    const isLiveNode = game.livePath !== undefined && position.pathsEqual(nextPath, game.livePath);
    const hasLivePath = game.livePath !== undefined;
    const renderedPosition = isLiveNode ? position.getLivePosition(game) : undefined;
    position.setRenderedPath(game, nextPath, { node, position: renderedPosition });
    const renderedColour = position.getRenderedPosition(game).sideToMove;
    if (status.isLiveState(game.gameState) && hasLivePath) {
      game.gameState = isLiveNode ? status.getLiveState(renderedColour) : status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedColour);
      return;
    }
    if (status.isLiveAnalysisState(game.gameState) && hasLivePath) {
      const liveColour = position.getLivePosition(game).sideToMove;
      game.gameState = isLiveNode ? status.getLiveState(liveColour) : status.getLiveAnalysisState(liveColour, renderedColour);
      return;
    }
    status.updateGameStateAfterPosition(game, renderedColour);
  }
  async function enterInGameAnalysis(game: IGame): Promise<void> {
    status.assertNotPausedForAction(game, 'In-game analysis entry');
    if (status.isLiveState(game.gameState)) {
      const liveNode = position.getLiveNode(game);
      await clock.pauseGame(game, PauseReason.Analysis);
      const livePosition = position.getLivePosition(game);
      position.setRenderedPath(game, position.getPathToNode(liveNode), { node: liveNode, position: livePosition });
      const liveColour = livePosition.sideToMove;
      game.gameState = status.getLiveAnalysisState(liveColour, liveColour, true);
      touchGame(game);
      return;
    }
    if (game.resultReason !== ResultReason.Timeout || !game.livePath) return;
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, position.getRenderedPosition(game).sideToMove);
    touchGame(game);
  }
  function exitInGameAnalysis(game: IGame): void {
    if (!status.isAnyLiveAnalysisState(game.gameState)) return;
    const liveNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    position.setRenderedPath(game, position.getPathToNode(liveNode), { node: liveNode, position: livePosition });
    const liveColour = livePosition.sideToMove;
    if (game.resultReason === ResultReason.Timeout && game.resultState !== ResultState.Ongoing) {
      game.gameState = status.getAnalysisState(getOpponentColour(liveColour));
      touchGame(game);
      return;
    }
    if (status.isPausedLiveAnalysisState(game.gameState)) resumeFromInGameAnalysis(game, liveColour);
    else game.gameState = status.getLiveState(liveColour);
    touchGame(game);
  }
  function resumeFromInGameAnalysis(game: IGame, liveColour: Parameters<GameStatusComposable['getLiveState']>[0]): void {
    const runtime = position.requireGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== PauseReason.Analysis);
    if ((runtime.pauseReasons ?? []).length > 0) game.gameState = status.getPausedState(liveColour);
    else {
      game.clockSnapshot = clock.resumeClock(game.clockSnapshot, new ClockTimestamp());
      game.gameState = status.getLiveState(liveColour);
    }
    clock.refreshRuntimeRegistrations(game);
    if (status.isLiveState(game.gameState)) void playerTurn.flushDeferredPlayerMove(game);
  }
  return {
    commitLiveMove,
    replaceWithAnalysisRoot,
    makeMove,
    takeBack,
    navigateToNode,
    enterInGameAnalysis,
    exitInGameAnalysis,
  };
}
export type GameMoveComposable = ReturnType<typeof useGameMove>;
