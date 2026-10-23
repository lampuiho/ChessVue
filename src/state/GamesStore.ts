import { defineStore } from 'pinia';
import { onScopeDispose } from 'vue';
import { PauseReason, PlayerColour, PlayerType, ResultState, type IGame, type IMove, type IMoveNode, type IMoveRaw } from '@/contracts';
import { EngineRuntimeService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { logHandledError } from '@/utility/errors';
import { useGameAnalysis } from './game/GameAnalysisComposable';
import { useGameBoardEdit } from './game/GameBoardEditComposable';
import { useGameClock } from './game/GameClockComposable';
import { useGameMove } from './game/GameMoveComposable';
import { useGamePlayerTurn } from './game/GamePlayerTurnComposable';
import { useGamePosition } from './game/GamePositionComposable';
import { useGameStatus } from './game/GameStatusComposable';
import { useGameWorkspace } from './game/GameWorkspaceComposable';
import { useGameRecord } from './game/GameRecordComposable';
import { useGamePremove } from './game/GamePremoveComposable';
import { useGameTurnRuntime } from './game/GameTurnRuntimeComposable';

export const useGamesStore = defineStore('gamesStore', () => {
  const position = useGamePosition();
  const record = useGameRecord();
  const premove = useGamePremove({ position });
  const turnRuntime = useGameTurnRuntime({ position });
  const status = useGameStatus({ position, record, premove });
  const analysis = useGameAnalysis({ position, record });
  const clock = useGameClock({ position, status, record, premove, turnRuntime });
  const move = useGameMove({ position, status, clock, analysis, record, premove });
  const playerTurn = useGamePlayerTurn({ position, status, record, premove, move, clock, turnRuntime });
  const boardEdit = useGameBoardEdit({ position, status, analysis, move, record });
  const workspace = useGameWorkspace({ position, status, clock, analysis, playerTurn, record, premove });
  async function _commitHistoryRewriteMove(game: IGame, detailedMove: IMove) {
    const renderedNode = position.getRenderedNode(game);
    const renderedPosition = position.getRenderedPosition(game);
    const renderedPath = game.renderedPath;
    await playerTurn.clearPlayerTurnRuntime(game);
    if (game.resultState !== ResultState.Ongoing || game.renderedPath !== renderedPath || position.getRenderedNode(game) !== renderedNode
      || status.isAnyLiveAnalysisState(game.gameState) || status.isPausedState(game.gameState) || !game.gameplayOptions.allowTakeback) {
      playerTurn.requestPlayerMoveIfNeeded(game);
      return;
    }
    if (move.commitHistoryMove(game, detailedMove, renderedPath, renderedNode, renderedPosition)) playerTurn.requestPlayerMoveIfNeeded(game);
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
      if (player?.type === PlayerType.Engine && local) { premove.appendPremove(game, local, rawMove); return; }
      if (player?.type !== PlayerType.Local) throw new Error('This move does not belong to the current local turn.');
    }
    const detailedMove = move.resolveMove(parentPosition, rawMove, parentNode.move);
    if (!live) move.commitStandaloneAnalysisMove(game, parentNode, parentPosition, detailedMove);
    else if (analysing) move.commitLiveAnalysisMove(game, parentNode, parentPosition, detailedMove);
    else if (status.isLiveHistoryReview(game) && game.gameplayOptions.allowTakeback) await _commitHistoryRewriteMove(game, detailedMove);
    else if (game.renderedPath !== game.livePath) throw new Error('Enter analysis to explore this historical position.');
    else await playerTurn.attemptPlayerMove(game, detailedMove);
  }
  async function takeBack(game: IGame, moveCount: number = move.getTakeBackMoveCount(game)) {
    status.assertExplorationAllowed(game, 'Takeback');
    status.assertNotPausedForAction(game, 'Takeback');
    const hasLivePath = !!game.livePath;
    if (hasLivePath && !game.gameplayOptions.allowTakeback) throw new Error('Takeback is not allowed for this game.');
    if (moveCount <= 0) return;
    const targetNode = hasLivePath ? position.getLiveNode(game) : position.getRenderedNode(game);
    await playerTurn.clearPlayerTurnRuntime(game);
    await Promise.all([game.whitePlayer, game.blackPlayer].filter(playerTurn.isEnginePlayer).map((player) => EngineRuntimeService.stopEngine(player.assignedEngine)));
    const analysisWork = move.rewind(game, targetNode, moveCount, hasLivePath);
    playerTurn.requestPlayerMoveIfNeeded(game);
    await analysisWork;
  }
  function navigateToNode(game: IGame, node: IMoveNode) {
    if (move.navigateToNode(game, node)) playerTurn.requestPlayerMoveIfNeeded(game);
  }
  function exitInGameAnalysis(game: IGame) {
    if (move.exitInGameAnalysis(game)) playerTurn.requestPlayerMoveIfNeeded(game);
  }
  async function resumeGame(game: IGame, reason: PauseReason) {
    if (!status.isPausedState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const nowUtc = new ClockTimestamp();
    if (clock.getExpiredColour(game, nowUtc)) return clock.syncClock(game, nowUtc);
    if (clock.resumeClockState(game, reason, nowUtc)) {
      await playerTurn.flushDeferredPlayerMove(game);
      playerTurn.requestPlayerMoveIfNeeded(game);
    }
  }
  async function resignGame(game: IGame, colour: PlayerColour) {
    status.assertOngoingLiveAction(game, 'Resignation');
    await playerTurn.clearPlayerTurnRuntime(game);
    status.finaliseResignation(game, colour);
    clock.refreshRuntimeRegistrations(game);
  }
  async function acceptDrawOffer(game: IGame) {
    status.assertOngoingLiveAction(game, 'Draw acceptance');
    if (!game.drawOfferState) return;
    await playerTurn.clearPlayerTurnRuntime(game);
    status.finaliseDrawAgreement(game);
    clock.refreshRuntimeRegistrations(game);
  }
  onScopeDispose(() => {
    for (const game of workspace.listGames() as readonly IGame[]) {
      premove.clearPremoves(game);
      const cleanup = [playerTurn.clearPlayerTurnRuntime(game), analysis.disposeAnalysisForGame(game)];
      for (const player of [game.whitePlayer, game.blackPlayer]) if (playerTurn.isEnginePlayer(player)) cleanup.push(EngineRuntimeService.stopEngine(player.assignedEngine));
      void Promise.all(cleanup).catch((error) => logHandledError('GamesStore', 'dispose', error));
      game.$?.focusReturnUnsubscribe?.();
    }
  });
  return {
    autosaveError: record.autosaveError,
    onAutosaveFailed: record.onAutosaveFailed,
    createGame: workspace.createGame,
    startGameFromSetup: workspace.startGameFromSetup,
    insertGame: workspace.insertGame,
    getGame: workspace.getGame,
    listGames: workspace.listGames,
    makeMove,
    clearPremoves: premove.clearPremoves,
    getTakeBackMoveCount: move.getTakeBackMoveCount,
    takeBack,
    navigateToNode,
    getVisibleAnalysis: analysis.getVisibleAnalysis,
    syncClock: clock.syncClock,
    pauseGame: clock.pauseGame,
    resumeGame,
    reassignPlayer: playerTurn.reassignPlayer,
    addAnalysisEngine: analysis.addAnalysisEngine,
    removeAnalysisEngine: analysis.removeAnalysisEngine,
    refreshAnalysis: analysis.refreshAnalysis,
    retryAnalysis: analysis.retryAnalysis,
    stopAnalysis: analysis.stopAnalysis,
    enterInGameAnalysis: move.enterInGameAnalysis,
    exitInGameAnalysis,
    enterBoardEdit: boardEdit.enterBoardEdit,
    applyBoardEdit: boardEdit.applyBoardEdit,
    clearBoard: boardEdit.clearBoard,
    deleteChessPiece: boardEdit.deleteChessPiece,
    moveChessPiece: boardEdit.moveChessPiece,
    resetBoardToStartPosition: boardEdit.resetBoardToStartPosition,
    toggleChessPiece: boardEdit.toggleChessPiece,
    resignGame,
    offerDraw: status.offerDraw,
    acceptDrawOffer,
    declineDrawOffer: status.declineDrawOffer,
    withdrawDrawOffer: status.withdrawDrawOffer,
  };
});
