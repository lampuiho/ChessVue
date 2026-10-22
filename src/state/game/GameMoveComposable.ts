import {
  GameState,
  PlayerType,
  ResultState,
  type IBoardPosition,
  type IGame,
  type IMove,
  type IMoveNode,
} from '@/contracts';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService } from '@/domain';
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
  function _publishRenderedPosition(game: IGame, changed: boolean = true) {
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
    if (game.resultState !== ResultState.Ongoing) game.gameState = status.getAnalysisState(renderedColour);
    else if (status.isAnyLiveAnalysisState(game.gameState)) game.gameState = status.getLiveAnalysisState(livePosition.sideToMove, renderedColour);
    else game.gameState = status.getLiveState(livePosition.sideToMove);
    void _publishRenderedPosition(game, isLivePositionRendered);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
  }
  async function _commitHistoryRewriteMove(game: IGame, move: IMove) {
    const renderedNode = position.getRenderedNode(game);
    const renderedPosition = position.getRenderedPosition(game);
    await playerTurn.clearPlayerTurnRuntime(game);
    if (game.resultState !== ResultState.Ongoing) return;
    const moveTimestamp = new ClockTimestamp();
    position.setLivePath(game, game.renderedPath, { node: renderedNode, position: renderedPosition });
    const selectedClockSnapshot = renderedNode.clockSnapshot ?? game.clockSnapshot;
    game.clockSnapshot = clock.startClock(selectedClockSnapshot, renderedPosition.sideToMove, moveTimestamp);
    game.gameState = status.getLiveState(renderedPosition.sideToMove);
    if (clock.reconcileTimeout(game, moveTimestamp)) return;
    _applyLiveMove(game, move, moveTimestamp);
    _finaliseLiveMove(game, renderedPosition, true);
  }
  function commitLiveMove(game: IGame, move: IMove) {
    const livePath = game.livePath;
    if (!livePath) throw new ReferenceError('live path is undefined even though we are making a live move');
    const moveTimestamp = new ClockTimestamp();
    if (clock.reconcileTimeout(game, moveTimestamp)) return;
    const isLivePositionRendered = game.renderedPath === livePath;
    const parentNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    if (parentNode.children.length > 0 && !position.isPathPrefix(livePath, game.renderedPath)) MoveHistoryService.pruneFutureMoves(parentNode);
    _applyLiveMove(game, move, moveTimestamp);
    _finaliseLiveMove(game, livePosition, isLivePositionRendered);
  }
  function _returnToLiveNode(game: IGame) {
    const paused = status.isPausedState(game.gameState);
    const changed = !position.pathsEqual(game.renderedPath, game.livePath);
    const liveNode = position.getLiveNode(game);
    const livePosition = position.getLivePosition(game);
    position.setRenderedPath(game, game.livePath!, { node: liveNode, position: livePosition });
    game.gameState = game.resultState !== ResultState.Ongoing ? status.getAnalysisState(livePosition.sideToMove)
      : paused ? status.getPausedState(livePosition.sideToMove) : status.getLiveState(livePosition.sideToMove);
    void _publishRenderedPosition(game, changed);
    if (status.isLiveTurnReadyForMove(game)) playerTurn.requestPlayerMoveIfNeeded(game);
  }
  function _advanceRenderedAnalysisBranch(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove): IBoardPosition {
    let renderedPosition = parentPosition;
    if (game.livePath && renderedPosition === position.getLivePosition(game)) renderedPosition = MoveApplicationService.genPosition(renderedPosition, []);
    MoveApplicationService.applyMove(renderedPosition, move);
    const nextNode = MoveHistoryService.addAnalysisMove(parentNode, move);
    position.setRenderedPath(game, position.getPathToNode(nextNode), { node: nextNode, position: renderedPosition });
    moveCommitted(game);
    return renderedPosition;
  }
  function _commitLiveAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove) {
    const renderedPosition = _advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedPosition.sideToMove, status.isPausedLiveAnalysisState(game.gameState));
    void _publishRenderedPosition(game);
  }
  function _commitStandaloneAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove) {
    const renderedPosition = _advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    status.updateGameStateAfterPosition(game, renderedPosition.sideToMove);
    void _publishRenderedPosition(game);
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
    void _publishRenderedPosition(game);
  }
  async function makeMove(game: IGame, move: IMove) {
    status.assertMoveAllowed(game);
    const parentNode = position.getRenderedNode(game);
    const parentPosition = position.getRenderedPosition(game);
    if (!status.isOngoingLiveGame(game)) _commitStandaloneAnalysisMove(game, parentNode, parentPosition, move);
    else if (status.isAnyLiveAnalysisState(game.gameState)) _commitLiveAnalysisMove(game, parentNode, parentPosition, move);
    else if (status.isLiveHistoryReview(game) && game.gameplayOptions.allowTakeback) await _commitHistoryRewriteMove(game, move);
    else if (game.renderedPath !== game.livePath) throw new Error('Enter analysis to explore this historical position.');
    else {
      const livePosition = position.getLivePosition(game);
      const player = playerTurn.getSideToMovePlayer(game, livePosition.sideToMove);
      if (player?.type !== PlayerType.Local || move.movingColour !== livePosition.sideToMove) throw new Error('This move does not belong to the current local turn.');
      await playerTurn.attemptPlayerMove(game, move);
    }
  }
  function getTakeBackMoveCount(game: IGame) {
    let node = game.livePath ? position.getLiveNode(game) : position.getRenderedNode(game);
    if (!node.move) return 0;
    if (!game.livePath) return 1;
    const localPlayer = game.whitePlayer?.type === PlayerType.Local && game.blackPlayer?.type === PlayerType.Engine ? game.whitePlayer
      : game.blackPlayer?.type === PlayerType.Local && game.whitePlayer?.type === PlayerType.Engine ? game.blackPlayer : undefined;
    if (!localPlayer) return 1;
    let moveCount = 0;
    while (node.move) {
      moveCount += 1;
      if (node.move.movingColour === localPlayer.colour) return moveCount;
      if (!node.$?.parent) break;
      node = node.$.parent;
    }
    return 0;
  }
  async function takeBack(game: IGame, moveCount: number = getTakeBackMoveCount(game)) {
    status.assertExplorationAllowed(game, 'Takeback');
    status.assertNotPausedForAction(game, 'Takeback');
    const hasLivePath = !!game.livePath;
    if (hasLivePath && !game.gameplayOptions.allowTakeback) throw new Error('Takeback is not allowed for this game.');
    if (moveCount <= 0) return;
    const targetNode = hasLivePath ? position.getLiveNode(game) : position.getRenderedNode(game);
    await playerTurn.clearPlayerTurnRuntime(game);
    await Promise.all([game.whitePlayer, game.blackPlayer].filter(playerTurn.isEnginePlayer).map((player) => EngineRuntimeService.stopEngine(player.assignedEngine)));
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
    } else status.updateGameStateAfterPosition(game, fallbackPosition.sideToMove);
    const analysisWork = _publishRenderedPosition(game, changed);
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
    if (isLiveNode) {
      _returnToLiveNode(game);
      return;
    }
    position.setRenderedPath(game, nextPath, { node });
    const renderedColour = position.getRenderedPosition(game).sideToMove;
    if (hasLivePath && game.resultState === ResultState.Ongoing && status.isAnyLiveAnalysisState(game.gameState)) game.gameState = status.getLiveAnalysisState(position.getLivePosition(game).sideToMove, renderedColour, status.isPausedState(game.gameState));
    else if (hasLivePath && game.resultState === ResultState.Ongoing) game.gameState = status.isPausedState(game.gameState)
      ? status.getPausedState(position.getLivePosition(game).sideToMove) : status.getLiveState(position.getLivePosition(game).sideToMove);
    else status.updateGameStateAfterPosition(game, renderedColour);
    void _publishRenderedPosition(game, changed);
  }
  async function enterInGameAnalysis(game: IGame) {
    if (!game.livePath || status.isAnyLiveAnalysisState(game.gameState) || game.gameState === GameState.BoardEdit) return;
    const paused = status.isPausedState(game.gameState);
    const livePosition = position.getLivePosition(game);
    const renderedPosition = MoveApplicationService.genPosition(position.getRenderedPosition(game), []);
    position.setRenderedPath(game, [...game.renderedPath], { node: position.getRenderedNode(game), position: renderedPosition });
    game.gameState = game.resultState === ResultState.Ongoing
      ? status.getLiveAnalysisState(livePosition.sideToMove, renderedPosition.sideToMove, paused) : status.getAnalysisState(renderedPosition.sideToMove);
    void _publishRenderedPosition(game, false);
  }
  function exitInGameAnalysis(game: IGame) {
    if (!game.livePath || (!status.isAnyLiveAnalysisState(game.gameState) && game.resultState === ResultState.Ongoing)) return;
    _returnToLiveNode(game);
  }
  return {
    commitLiveMove,
    replaceWithAnalysisRoot,
    makeMove,
    getTakeBackMoveCount,
    takeBack,
    navigateToNode,
    enterInGameAnalysis,
    exitInGameAnalysis,
  };
}
export type GameMoveComposable = ReturnType<typeof useGameMove>;
