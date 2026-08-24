import {
  AnalysisBranchExitBehaviour,
  GameState,
  PauseReason,
  ResultReason,
  ResultState,
  type IAssignedEngine,
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
  function commitLiveMove(game: IGame, move: IMove, ponderEngine?: IAssignedEngine): void {
    const livePath = game.livePath;
    if (!livePath) throw new ReferenceError('live path is undefined even though we are making a live move');
    const isLivePositionRendered = position.pathsEqual(game.highlightPath, livePath);
    const nextClockSnapshot = clock.applyMove(game, move.movingColour, new ClockTimestamp());
    const parentNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    if (parentNode.children.length > 0) MoveHistoryService.pruneFutureMoves(parentNode);
    MoveApplicationService.applyMove(livePosition, move);
    const nextNodeIdx = parentNode.children.length;
    const nextNode = MoveHistoryService.addMainlineMove(parentNode, move, nextClockSnapshot);
    game.livePath = position.getPathToNode(nextNode);
    if (isLivePositionRendered) game.highlightPath = [...game.livePath];
    else {
      game.highlightPath.push(nextNodeIdx);
      position.requireGameRuntime(game).renderedPosition = undefined;
    }
    game.clockSnapshot = nextClockSnapshot;
    position.syncRuntimeNodeCache(game);
    status.updatePositionResult(game, livePosition);
    status.updateGameStateAfterPosition(game, livePosition.sideToMove);
    touchGame(game);
    playerTurn.clearPlayerTurnRuntime(game);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.startPonderingIfAvailable(game, ponderEngine, move.$?.ponderMove);
    void analysis.refreshAnalysisForGame(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
  }
  function commitHistoryRewriteMove(game: IGame, parentNode: IMoveNode, move: IMove): void {
    game.clockSnapshot = parentNode.clockSnapshot ?? game.clockSnapshot;
    commitLiveMove(game, move);
  }
  function advanceRenderedAnalysisBranch(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove): IBoardPosition {
    const runtime = position.requireGameRuntime(game);
    let renderedPosition = parentPosition;
    if (renderedPosition === runtime.livePosition) {
      renderedPosition = MoveApplicationService.genPosition(renderedPosition, []);
      runtime.renderedPosition = renderedPosition;
    }
    MoveApplicationService.applyMove(renderedPosition, move);
    const nextNode = MoveHistoryService.addAnalysisMove(parentNode, move);
    game.highlightPath = position.getPathToNode(nextNode);
    position.syncRuntimeNodeCache(game);
    return renderedPosition;
  }
  function commitLiveHistoryAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove, exitBehaviour: AnalysisBranchExitBehaviour): void {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    if (exitBehaviour === AnalysisBranchExitBehaviour.ReturnToLiveNode) {
      game.highlightPath = [...game.livePath!];
      position.requireGameRuntime(game).renderedPosition = position.getLivePosition(game);
      position.syncRuntimeNodeCache(game);
      game.gameState = status.getLiveState(position.getLivePosition(game).sideToMove);
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
  function replaceWithAnalysisRoot(game: IGame, boardRoot: IBoardPosition, nextState: GameState): void {
    const nextClockSnapshot = clock.initialiseClockSnapshot(game.timeControl);
    game.rootPosition = boardRoot;
    game.moveTree = MoveHistoryService.createMoveTree(nextClockSnapshot);
    position.invalidateRuntimePositions(game);
    game.highlightPath = [];
    game.livePath = undefined;
    game.clockSnapshot = nextClockSnapshot;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    playerTurn.clearPlayerTurnRuntime(game);
    game.gameState = nextState;
    position.syncRuntimeNodeCache(game);
    touchGame(game);
  }
  async function makeMove(game: IGame, move: IMove): Promise<void> {
    status.assertMoveAllowed(game);
    const parentNode = position.getCurrentNode(game);
    const parentPosition = position.getRenderedPosition(game);
    if (status.isOngoingLiveGame(game) && status.isLiveHistoryReview(game)) {
      if (game.gameplayOptions.allowTakeback) commitHistoryRewriteMove(game, parentNode, move);
      else commitLiveHistoryAnalysisMove(game, parentNode, parentPosition, move, UserSettingService.getSettings().gameplay.analysisBranchExitBehaviour);
      return;
    }
    if (status.isOngoingLiveGame(game) && status.isLiveState(game.gameState)) {
      const runtime = position.requireGameRuntime(game);
      if (!runtime.pendingPlayerTurnPromise || !runtime.pendingPlayerTurnHandlePromise) throw new ReferenceError(`turn started to allow make move for ${move.movingColour} but move request was not made`);
      runtime.pendingPlayerTurnPromise.resolve(move);
      await runtime.pendingPlayerTurnHandlePromise;
      return;
    }
    if (status.isOngoingLiveGame(game)) commitLiveAnalysisMove(game, parentNode, parentPosition, move);
    else commitStandaloneAnalysisMove(game, parentNode, parentPosition, move);
  }
  async function takeBack(game: IGame, moveCount: number = 1): Promise<void> {
    status.assertNotPausedForAction(game, 'Takeback');
    const targetNode = position.getCurrentNode(game);
    game.moveTree = MoveHistoryService.takeBack(targetNode, moveCount);
    const fallbackNode = targetNode.$?.parent ? position.getCurrentNodeOfPath(game.moveTree, position.getPathToNode(targetNode.$.parent)) : game.moveTree.root;
    game.highlightPath = position.getPathToNode(fallbackNode);
    if (game.livePath) game.livePath = game.highlightPath;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    playerTurn.clearPlayerTurnRuntime(game);
    position.invalidateRuntimePositions(game);
    position.syncRuntimeNodeCache(game);
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
    game.highlightPath = nextPath;
    position.requireGameRuntime(game).renderedPosition = isLiveNode ? position.getLivePosition(game) : undefined;
    position.syncRuntimeNodeCache(game);
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
      game.highlightPath = position.getPathToNode(liveNode);
      position.requireGameRuntime(game).renderedPosition = position.getLivePosition(game);
      position.syncRuntimeNodeCache(game);
      const liveColour = position.getLivePosition(game).sideToMove;
      game.gameState = status.getLiveAnalysisState(liveColour, liveColour, true);
      touchGame(game);
      return;
    }
    if (game.resultReason !== ResultReason.Timeout || !game.livePath) return;
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, position.getRenderedPosition(game).sideToMove);
    position.syncRuntimeNodeCache(game);
    touchGame(game);
  }
  function exitInGameAnalysis(game: IGame): void {
    if (!status.isAnyLiveAnalysisState(game.gameState)) return;
    game.highlightPath = position.getPathToNode(position.getLiveNode(game));
    position.requireGameRuntime(game).renderedPosition = position.getLivePosition(game);
    position.syncRuntimeNodeCache(game);
    const liveColour = position.getLivePosition(game).sideToMove;
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
