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
  moveCommitted: (game: IGame) => void;
}

export function useGameMove(dependency: IGameMoveDependency) {
  const { position, status, clock, analysis, playerTurn, touchGame, moveCommitted } = dependency;
  function publishRenderedPosition(game: IGame, changed: boolean = true) {
    if (changed) return analysis.refreshAnalysisForGame(game);
    touchGame(game);
    return Promise.resolve();
  }
  function _applyLiveMove(game: IGame, move: IMove, moveTimestamp: ClockTimestamp): IMoveNode {
    const liveNode = position.getLiveNode(game);
    const livePos = position.getLivePosition(game);
    const nextClockSnapshot = clock.applyMove(game, move.movingColour, moveTimestamp);
    const recordedAnalysis = analysis.captureMoveAnalysis(game);
    MoveApplicationService.applyMove(livePos, move);
    const nextNode = MoveHistoryService.addMainlineMove(liveNode, move, nextClockSnapshot);
    nextNode.recordedAnalysis = recordedAnalysis;
    position.appendLivePath(game, nextNode);
    game.clockSnapshot = nextClockSnapshot;
    moveCommitted(game);
    return nextNode;
  }
  function _finaliseLiveMove(game: IGame, livePosition: IBoardPosition, isLivePositionRendered: boolean) {
    status.updateGameResultFromLivePosition(game, livePosition);
    if (game.resultState !== ResultState.Ongoing) position.getLiveNode(game).clockSnapshot = game.clockSnapshot;
    const renderedColour = isLivePositionRendered ? livePosition.sideToMove : position.getRenderedPosition(game).sideToMove;
    if (game.resultState === ResultState.Ongoing && !isLivePositionRendered) game.gameState = status.getLiveAnalysisState(livePosition.sideToMove, renderedColour);
    else status.updateGameStateAfterPosition(game, renderedColour);
    void publishRenderedPosition(game, isLivePositionRendered);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
  }
  async function _commitHistoryRewriteMove(game: IGame, move: IMove) {
    const moveTimestamp = new ClockTimestamp();
    const renderedNode = position.getRenderedNode(game);
    const renderedPosition = position.getRenderedPosition(game);
    position.setLivePath(game, game.renderedPath, { node: renderedNode, position: renderedPosition });
    await playerTurn.clearPlayerTurnRuntime(game);
    const selectedClockSnapshot = renderedNode.clockSnapshot ?? game.clockSnapshot;
    game.clockSnapshot = clock.startClock(selectedClockSnapshot, renderedPosition.sideToMove, moveTimestamp); // clock is wrong without adding pause timestamp, should've added pause so game counts current turn used time than from when the history was played?
    game.gameState = status.getLiveState(renderedPosition.sideToMove);
    if (clock.reconcileTimeout(game, moveTimestamp)) return;
    const nextNode = _applyLiveMove(game, move, moveTimestamp);
    _finaliseLiveMove(game, renderedPosition, true);
  }
  function commitLiveMove(game: IGame, move: IMove) {
    const livePath = game.livePath;
    if (!livePath) throw new ReferenceError('live path is undefined even though we are making a live move');
    const moveTimestamp = new ClockTimestamp();
    if (clock.reconcileTimeout(game, moveTimestamp)) return;
    const isLivePositionRendered = position.pathsEqual(game.renderedPath, livePath);
    const parentNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    if (parentNode.children.length > 0) MoveHistoryService.pruneFutureMoves(parentNode);
    const nextNode = _applyLiveMove(game, move, moveTimestamp);
    _finaliseLiveMove(game, livePosition, isLivePositionRendered);
  }
  function returnToLiveNode(game: IGame) {
    const changed = !position.pathsEqual(game.renderedPath, game.livePath);
    const liveNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    position.setRenderedPath(game, game.livePath!, { node: liveNode, position: livePosition });
    game.gameState = status.getLiveState(livePosition.sideToMove);
    void publishRenderedPosition(game, changed);
    playerTurn.requestPlayerMoveIfNeeded(game);
  }
  function advanceRenderedAnalysisBranch(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove): IBoardPosition {
    let renderedPosition = parentPosition;
    if (game.livePath && renderedPosition === position.getLivePosition(game)) renderedPosition = MoveApplicationService.genPosition(renderedPosition, []);
    MoveApplicationService.applyMove(renderedPosition, move);
    const nextNode = MoveHistoryService.addAnalysisMove(parentNode, move);
    position.setRenderedPath(game, position.getPathToNode(nextNode), { node: nextNode, position: renderedPosition });
    moveCommitted(game);
    return renderedPosition;
  }
  function commitLiveHistoryAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove, exitBehaviour: AnalysisBranchExitBehaviour) {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    if (exitBehaviour === AnalysisBranchExitBehaviour.ReturnToLiveNode) {
      returnToLiveNode(game);
      return;
    }
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedPosition.sideToMove, status.isPausedLiveAnalysisState(game.gameState));
    void publishRenderedPosition(game);
  }
  function commitLiveAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove) {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedPosition.sideToMove, status.isPausedLiveAnalysisState(game.gameState));
    void publishRenderedPosition(game);
  }
  function commitStandaloneAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove) {
    const renderedPosition = advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    status.updateGameStateAfterPosition(game, renderedPosition.sideToMove);
    void publishRenderedPosition(game);
  }
  function replaceWithAnalysisRoot(game: IGame, rootPosition: IBoardPosition, nextState: GameState) {
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
    game.gameState = nextState;
    void publishRenderedPosition(game);
  }
  async function makeMove(game: IGame, move: IMove) {
    status.assertMoveAllowed(game);
    if (status.isOngoingLiveGame(game) && status.isLiveState(game.gameState)) {
      await playerTurn.attemptPlayerMove(game, move);
      return;
    }
    const parentNode = position.getRenderedNode(game);
    const parentPosition = position.getRenderedPosition(game);
    if (status.isOngoingLiveGame(game) && !status.isPausedLiveAnalysisState(game.gameState) && status.isLiveHistoryReview(game)) {
      if (game.gameplayOptions.allowTakeback) await _commitHistoryRewriteMove(game, move);
      else commitLiveHistoryAnalysisMove(game, parentNode, parentPosition, move, UserSettingService.getSettings().gameplay.analysisBranchExitBehaviour);
      return;
    }
    if (status.isOngoingLiveGame(game)) commitLiveAnalysisMove(game, parentNode, parentPosition, move);
    else commitStandaloneAnalysisMove(game, parentNode, parentPosition, move);
  }
  async function takeBack(game: IGame, moveCount: number = 1) {
    status.assertExplorationAllowed(game, 'Takeback');
    const analysisPaused = status.canExploreAnalysis(game);
    const hasLivePath = !!game.livePath;
    if (hasLivePath && !game.gameplayOptions.allowTakeback) throw new Error('Takeback is not allowed for this game.');
    const targetNode = hasLivePath ? position.getLiveNode(game) : position.getRenderedNode(game);
    await playerTurn.clearPlayerTurnRuntime(game);
    const fallbackNode = MoveHistoryService.takeBack(targetNode, moveCount);
    const fallbackPath = position.getPathToNode(fallbackNode);
    const changed = !position.pathsEqual(game.renderedPath, fallbackPath);
    position.setRenderedPath(game, fallbackPath, { node: fallbackNode });
    if (hasLivePath) position.setLivePath(game, fallbackPath, { node: fallbackNode });
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    const fallbackPosition = position.getRenderedPosition(game);
    if (hasLivePath) {
      const selectedClockSnapshot = fallbackNode.clockSnapshot ?? game.clockSnapshot;
      game.clockSnapshot = clock.startClock(selectedClockSnapshot, fallbackPosition.sideToMove, new ClockTimestamp());
      game.gameState = status.getLiveState(fallbackPosition.sideToMove);
      if (analysisPaused) await clock.pauseGame(game, PauseReason.Analysis);
    } else status.updateGameStateAfterPosition(game, fallbackPosition.sideToMove);
    const analysisWork = publishRenderedPosition(game, changed);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
    await analysisWork;
  }
  function navigateToNode(game: IGame, node: IMoveNode) {
    status.assertExplorationAllowed(game, 'History navigation');
    if (!position.isNodeInTree(game.moveTree, node)) return;
    const nextPath = position.getPathToNode(node);
    const changed = !position.pathsEqual(game.renderedPath, nextPath);
    const hasLivePath = !!game.livePath;
    const isLiveNode = hasLivePath && position.pathsEqual(nextPath, game.livePath);
    if (isLiveNode && (status.isLiveState(game.gameState) || status.isLiveAnalysisState(game.gameState))) {
      returnToLiveNode(game);
      return;
    }
    const renderedPosition = isLiveNode ? position.getLivePosition(game) : undefined;
    position.setRenderedPath(game, nextPath, { node, position: renderedPosition });
    const renderedColour = position.getRenderedPosition(game).sideToMove;
    if (hasLivePath && (status.isLiveState(game.gameState) || status.isAnyLiveAnalysisState(game.gameState))) game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedColour, status.isPausedLiveAnalysisState(game.gameState));
    else status.updateGameStateAfterPosition(game, renderedColour);
    void publishRenderedPosition(game, changed);
  }
  async function enterInGameAnalysis(game: IGame) {
    status.assertNotPausedForAction(game, 'In-game analysis entry');
    if (status.isLiveState(game.gameState)) {
      const liveNode = position.getLiveNode(game);
      await clock.pauseGame(game, PauseReason.Analysis);
      const livePosition = position.getLivePosition(game);
      const changed = !position.pathsEqual(game.renderedPath, game.livePath);
      position.setRenderedPath(game, position.getPathToNode(liveNode), { node: liveNode, position: livePosition });
      const liveColour = livePosition.sideToMove;
      game.gameState = status.getLiveAnalysisState(liveColour, liveColour, true);
      void publishRenderedPosition(game, changed);
      return;
    }
    if (game.resultReason !== ResultReason.Timeout || !game.livePath) return;
    if (game.renderedPath === game.livePath) {
      position.setRenderedPath(game, [...game.renderedPath], { node: position.getRenderedNode(game), position: position.getRenderedPosition(game) });
    }
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, position.getRenderedPosition(game).sideToMove);
    touchGame(game);
  }
  function exitInGameAnalysis(game: IGame) {
    if (!status.isAnyLiveAnalysisState(game.gameState)) return;
    const changed = !position.pathsEqual(game.renderedPath, game.livePath);
    const liveNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    if (!game.livePath) throw new ReferenceError('Exiting in-game analysis without a live path is not possible.');
    position.setRenderedPath(game, game.livePath, { node: liveNode, position: livePosition });
    const liveColour = livePosition.sideToMove;
    if (game.resultReason === ResultReason.Timeout && game.resultState !== ResultState.Ongoing) {
      game.gameState = status.getAnalysisState(getOpponentColour(liveColour));
      void publishRenderedPosition(game, changed);
      return;
    }
    if (status.isPausedLiveAnalysisState(game.gameState)) resumeFromInGameAnalysis(game, liveColour);
    else game.gameState = status.getLiveState(liveColour);
    void publishRenderedPosition(game, changed);
    if (status.isLiveState(game.gameState)) {
      void playerTurn.flushDeferredPlayerMove(game);
      playerTurn.requestPlayerMoveIfNeeded(game);
    }
  }
  function resumeFromInGameAnalysis(game: IGame, liveColour: Parameters<GameStatusComposable['getLiveState']>[0]) {
    const runtime = position.requireGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== PauseReason.Analysis);
    if ((runtime.pauseReasons ?? []).length > 0) game.gameState = status.getPausedState(liveColour);
    else {
      game.clockSnapshot = clock.resumeClock(game.clockSnapshot, new ClockTimestamp());
      game.gameState = status.getLiveState(liveColour);
    }
    clock.refreshRuntimeRegistrations(game);
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
