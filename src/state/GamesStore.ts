import { defineStore } from 'pinia';
import { ref } from 'vue';

import { GameState, SaveGameTargetKind, type IBoardPosition, type IGame, type IMove } from '@/contracts';
import { UserSettingService } from '@/domain';
import { useSavedGamesStore } from './SavedGamesStore';
import { RecordTimestamp } from '@/utility/date';
import { useGameAnalysis, type GameAnalysisComposable } from './game/GameAnalysisComposable';
import { useGameBoardEdit } from './game/GameBoardEditComposable';
import { useGameClock, type GameClockComposable } from './game/GameClockComposable';
import { useGameMove, type GameMoveComposable } from './game/GameMoveComposable';
import { useGamePlayerTurn, type GamePlayerTurnComposable } from './game/GamePlayerTurnComposable';
import { useGamePosition } from './game/GamePositionComposable';
import { useGameStatus } from './game/GameStatusComposable';
import { useGameWorkspace } from './game/GameWorkspaceComposable';

export const useGamesStore = defineStore('gamesStore', () => {
  // Canonical games stay raw; completed store transitions publish one shallow invalidation here.
  const workspaceRevision = ref(0);
  const autosaveError = ref('');
  const _autosaveFailureListeners = new Set<(message: string) => void>();
  function onAutosaveFailed(listener: (message: string) => void) {
    _autosaveFailureListeners.add(listener);
    return () => { _autosaveFailureListeners.delete(listener); };
  }
  const _moveCounts = new WeakMap<IGame, number>();
  let _autosaveQueue = Promise.resolve();
  function _moveCommitted(game: IGame) {
    const interval = UserSettingService.getSettings().gameSession.autosaveAfterMoveCount;
    const count = (_moveCounts.get(game) ?? 0) + 1;
    _moveCounts.set(game, interval > 0 ? count % interval : 0);
    if (interval <= 0 || count < interval) return;
    _autosaveQueue = _autosaveQueue.then(async () => {
      await useSavedGamesStore().saveGame(game, { targetKind: SaveGameTargetKind.Autosave });
      autosaveError.value = '';
    }).catch((error: unknown) => {
      autosaveError.value = error instanceof Error ? error.message : 'Automatic save failed.';
      for (const listener of _autosaveFailureListeners) listener(autosaveError.value);
    });
  }
  function _touchGame(game: IGame) {
    game.metadata.updatedAt = new RecordTimestamp();
    workspaceRevision.value += 1;
  }
  const position = useGamePosition();
  let clock: GameClockComposable;
  let analysis: GameAnalysisComposable;
  let playerTurn: GamePlayerTurnComposable;
  let move: GameMoveComposable;
  const status = useGameStatus({
    position,
    touchGame: _touchGame,
    clearPlayerTurnRuntime: (game: IGame) => playerTurn.clearPlayerTurnRuntime(game),
    refreshRuntimeRegistrations: (game: IGame) => clock.refreshRuntimeRegistrations(game),
  });
  analysis = useGameAnalysis({ position, touchGame: _touchGame });
  playerTurn = useGamePlayerTurn({
    position,
    status,
    touchGame: _touchGame,
    commitLiveMove: (game: IGame, playerMove: IMove) => move.commitLiveMove(game, playerMove),
    replaceWithAnalysisRoot: (game: IGame, rootPosition: IBoardPosition, nextState: GameState) => move.replaceWithAnalysisRoot(game, rootPosition, nextState),
    refreshRuntimeRegistrations: (game: IGame) => clock.refreshRuntimeRegistrations(game),
  });
  clock = useGameClock({
    position,
    status,
    touchGame: _touchGame,
    clearPlayerTurnRuntime: (game: IGame) => playerTurn.clearPlayerTurnRuntime(game),
    flushDeferredPlayerMove: (game: IGame) => playerTurn.flushDeferredPlayerMove(game),
    requestPlayerMoveIfNeeded: (game: IGame) => playerTurn.requestPlayerMoveIfNeeded(game),
  });
  move = useGameMove({ position, status, clock, analysis, playerTurn, touchGame: _touchGame, moveCommitted: _moveCommitted });
  const boardEdit = useGameBoardEdit({ position, status, analysis, move, touchGame: _touchGame });
  const workspace = useGameWorkspace({ position, status, clock, analysis, playerTurn, touchGame: _touchGame });
  return {
    workspaceRevision,
    autosaveError,
    onAutosaveFailed,
    createGame: workspace.createGame,
    startGameFromSetup: workspace.startGameFromSetup,
    insertGame: workspace.insertGame,
    getGame: workspace.getGame,
    listGames: workspace.listGames,
    makeMove: move.makeMove,
    getTakeBackMoveCount: move.getTakeBackMoveCount,
    takeBack: move.takeBack,
    navigateToNode: move.navigateToNode,
    getVisibleAnalysis: analysis.getVisibleAnalysis,
    syncClock: clock.syncClock,
    pauseGame: clock.pauseGame,
    resumeGame: clock.resumeGame,
    reassignPlayer: playerTurn.reassignPlayer,
    addAnalysisEngine: analysis.addAnalysisEngine,
    removeAnalysisEngine: analysis.removeAnalysisEngine,
    refreshAnalysis: analysis.refreshAnalysis,
    retryAnalysis: analysis.retryAnalysis,
    stopAnalysis: analysis.stopAnalysis,
    enterInGameAnalysis: move.enterInGameAnalysis,
    exitInGameAnalysis: move.exitInGameAnalysis,
    enterBoardEdit: boardEdit.enterBoardEdit,
    applyBoardEdit: boardEdit.applyBoardEdit,
    clearBoard: boardEdit.clearBoard,
    deleteChessPiece: boardEdit.deleteChessPiece,
    moveChessPiece: boardEdit.moveChessPiece,
    resetBoardToStartPosition: boardEdit.resetBoardToStartPosition,
    toggleChessPiece: boardEdit.toggleChessPiece,
    resignGame: status.resignGame,
    offerDraw: status.offerDraw,
    acceptDrawOffer: status.acceptDrawOffer,
    declineDrawOffer: status.declineDrawOffer,
    withdrawDrawOffer: status.withdrawDrawOffer,
  };
});
