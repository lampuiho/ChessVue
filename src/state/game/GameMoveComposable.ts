import { shallowReactive } from 'vue';
import {
  GameState,
  PlayerType,
  ResultState,
  type IBoardPosition,
  type IGame,
  type IMove,
  type IMoveRaw,
  type IMoveNode,
  type IPlayer,
} from '@/contracts';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { genCandidateMovesForPiece, genLegalMovesForPiece, toDetailedMove } from '@/utility/chess';
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
  timestampGame: (game: IGame) => void;
  moveCommitted: (game: IGame) => void;
  clearPremoves: (game: IGame) => void;
}

export function useGameMove(dependency: IGameMoveDependency) {
  const { position, status, clock, analysis, playerTurn, timestampGame, moveCommitted, clearPremoves } = dependency;
  function _appendPremove(game: IGame, player: IPlayer, rawMove: IMoveRaw) {
    const queue = game.$!.premoveQueue ??= { player, moves: shallowReactive<IMoveRaw[]>([]) };
    queue.moves.push(rawMove);
  }
  function _revalidatePremoves(game: IGame) {
    const queue = position.requireGameRuntime(game).premoveQueue;
    if (!queue) return;
    if (game.resultState !== ResultState.Ongoing) { clearPremoves(game); return; }
    const preview = MoveApplicationService.genPosition(position.getLivePosition(game), []);
    for (const move of queue.moves) {
      if (preview.board[move.from]?.colour !== queue.player.colour
        || !genCandidateMovesForPiece(preview, move.from).some((candidate) => candidate.to === move.to && candidate.promotionPiece === move.promotionPiece)) {
        clearPremoves(game);
        return;
      }
      position.applyPremoveProjection(preview, move);
    }
  }
  function _refreshRenderedAnalysis(game: IGame, changed: boolean = true) {
    if (changed) return analysis.refreshAnalysisForGame(game);
    timestampGame(game);
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
    _revalidatePremoves(game);
    void _refreshRenderedAnalysis(game, isLivePositionRendered);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
  }
  async function _commitHistoryRewriteMove(game: IGame, move: IMove) {
    const renderedNode = position.getRenderedNode(game);
    const renderedPosition = position.getRenderedPosition(game);
    const renderedPath = game.renderedPath;
    await playerTurn.clearPlayerTurnRuntime(game);
    if (game.resultState !== ResultState.Ongoing || game.renderedPath !== renderedPath || position.getRenderedNode(game) !== renderedNode
      || status.isAnyLiveAnalysisState(game.gameState) || status.isPausedState(game.gameState) || !game.gameplayOptions.allowTakeback) {
      playerTurn.requestPlayerMoveIfNeeded(game);
      return;
    }
    const moveTimestamp = new ClockTimestamp();
    clearPremoves(game);
    position.setLivePath(game, renderedPath, { node: renderedNode, position: renderedPosition });
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
    void _refreshRenderedAnalysis(game, changed);
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
    void _refreshRenderedAnalysis(game);
  }
  function _commitStandaloneAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove) {
    const renderedPosition = _advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move);
    status.updateGameStateAfterPosition(game, renderedPosition.sideToMove);
    void _refreshRenderedAnalysis(game);
  }
  function replaceWithAnalysisRoot(game: IGame, rootPosition: IBoardPosition, nextState: GameState) {
    clearPremoves(game);
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
    void _refreshRenderedAnalysis(game);
  }
  function _resolveMove(parentPosition: IBoardPosition, move: IMoveRaw, lastMove?: IMove) {
    if (![move.from, move.to].every((boardId) => Number.isInteger(boardId) && boardId >= 0 && boardId < 64)) throw new Error('Invalid move coordinates.');
    const candidate = genLegalMovesForPiece(parentPosition, move.from, lastMove)
      .find((legal) => legal.to === move.to && legal.promotionPiece === move.promotionPiece);
    if (!candidate) throw new Error('This move is not legal in the selected position.');
    return toDetailedMove(parentPosition, candidate);
  }
  async function makeMove(game: IGame, rawMove: IMoveRaw) {
    status.assertMoveAllowed(game);
    const parentNode = position.getRenderedNode(game);
    const parentPosition = position.getRenderedPosition(game);
    const live = status.isOngoingLiveGame(game);
    const analysing = status.isAnyLiveAnalysisState(game.gameState);
    if (live && !analysing && game.renderedPath === game.livePath) {
      const player = playerTurn.getSideToMovePlayer(game, parentPosition.sideToMove);
      const local = game.whitePlayer?.type === PlayerType.Local && game.blackPlayer?.type === PlayerType.Engine ? game.whitePlayer
        : game.blackPlayer?.type === PlayerType.Local && game.whitePlayer?.type === PlayerType.Engine ? game.blackPlayer : undefined;
      if (player?.type === PlayerType.Engine && local) { _appendPremove(game, local, rawMove); return; }
      if (player?.type !== PlayerType.Local) throw new Error('This move does not belong to the current local turn.');
    }
    const move = _resolveMove(parentPosition, rawMove, parentNode.move);
    if (!live) _commitStandaloneAnalysisMove(game, parentNode, parentPosition, move);
    else if (analysing) _commitLiveAnalysisMove(game, parentNode, parentPosition, move);
    else if (status.isLiveHistoryReview(game) && game.gameplayOptions.allowTakeback) await _commitHistoryRewriteMove(game, move);
    else if (game.renderedPath !== game.livePath) throw new Error('Enter analysis to explore this historical position.');
    else await playerTurn.attemptPlayerMove(game, move);
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
    clearPremoves(game);
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
    const analysisWork = _refreshRenderedAnalysis(game, changed);
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
    void _refreshRenderedAnalysis(game, changed);
  }
  async function enterInGameAnalysis(game: IGame) {
    if (!game.livePath || status.isAnyLiveAnalysisState(game.gameState) || game.gameState === GameState.BoardEdit) return;
    const paused = status.isPausedState(game.gameState);
    const livePosition = position.getLivePosition(game);
    const renderedPosition = MoveApplicationService.genPosition(position.getRenderedPosition(game), []);
    position.setRenderedPath(game, [...game.renderedPath], { node: position.getRenderedNode(game), position: renderedPosition });
    game.gameState = game.resultState === ResultState.Ongoing
      ? status.getLiveAnalysisState(livePosition.sideToMove, renderedPosition.sideToMove, paused) : status.getAnalysisState(renderedPosition.sideToMove);
    void _refreshRenderedAnalysis(game, false);
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
