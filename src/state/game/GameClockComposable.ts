import {
  PauseReason,
  PlayerColour,
  ResultReason,
  ResultState,
  type IClockSnapshot,
  type IGame,
  type ITimeControl,
} from '@/contracts';
import { PlatformEventService, TimeControlService } from '@/domain';
import { getOpponentColour } from '@/utility/chess/BoardUtility';
import { ClockTimestamp } from '@/utility/date';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGameClockDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  // game persistent data touched event (internally updating update time)
  timestampGame: (game: IGame) => void;
  clearPlayerTurnRuntime: (game: IGame) => Promise<void>;
  flushDeferredPlayerMove: (game: IGame) => Promise<void>;
  requestPlayerMoveIfNeeded: (game: IGame) => void;
  clearPremoves: (game: IGame) => void;
}

export function useGameClock(dependency: IGameClockDependency) {
  const { position, status, timestampGame, clearPlayerTurnRuntime, flushDeferredPlayerMove, requestPlayerMoveIfNeeded, clearPremoves } = dependency;
  const pendingTimeouts = new WeakMap<IGame, Promise<void>>();
  function isTimedGame(game: IGame): boolean {
    return game.timeControl.initialMs != null && game.timeControl.preset !== 'untimed';
  }
  function _hasRunningClock(snapshot: IClockSnapshot): boolean {
    return !!snapshot.activeColour
      && !!snapshot.startedAtUtc
      && (snapshot.white.isRunning || snapshot.black.isRunning);
  }
  function _canPauseForReason(game: IGame, reason: PauseReason): boolean {
    if (reason === PauseReason.Analysis || status.isPausedState(game.gameState)) return true;
    return isTimedGame(game) && _hasRunningClock(game.clockSnapshot);
  }
  function initialiseClockSnapshot(timeControl: ITimeControl): IClockSnapshot {
    return TimeControlService.initialiseClockSnapshot(timeControl);
  }
  function startClock(snapshot: IClockSnapshot, colour: PlayerColour, nowUtc: ClockTimestamp): IClockSnapshot {
    return TimeControlService.startClock(snapshot, colour, nowUtc);
  }
  function resumeClock(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot {
    return TimeControlService.resumeClock(snapshot, nowUtc);
  }
  function applyMove(game: IGame, movingColour: PlayerColour, nowUtc: ClockTimestamp): IClockSnapshot {
    return TimeControlService.applyMove(game.clockSnapshot, movingColour, nowUtc, game.timeControl);
  }
  function refreshRuntimeRegistrations(game: IGame) {
    const runtime = position.requireGameRuntime(game);
    runtime.focusReturnUnsubscribe?.();
    runtime.focusReturnUnsubscribe = undefined;
    const hasLiveClock = status.isLiveState(game.gameState) || status.isLiveAnalysisState(game.gameState);
    if (!hasLiveClock || game.resultState !== ResultState.Ongoing || !isTimedGame(game) || !_hasRunningClock(game.clockSnapshot)) return;
    runtime.focusReturnUnsubscribe = PlatformEventService.subscribeToAppFocusReturned('GamesStore', () => syncClock(game, new ClockTimestamp()), `sync-clock-${game.metadata.id}`);
  }
  function _getExpiredColour(game: IGame, nowUtc: ClockTimestamp): PlayerColour | undefined {
    if (game.resultState !== ResultState.Ongoing) return;
    if (!status.isLiveState(game.gameState) && !status.isPausedState(game.gameState) && !status.isLiveAnalysisState(game.gameState)) return;
    if (!TimeControlService.hasExpired(game.clockSnapshot, nowUtc)) return;
    const remainingTime = TimeControlService.getRemainingTime(game.clockSnapshot, nowUtc);
    return (remainingTime.white ?? 1) <= 0 ? PlayerColour.White : PlayerColour.Black;
  }
  function _finaliseTimeout(game: IGame, nowUtc: ClockTimestamp, expiredColour: PlayerColour) {
    clearPremoves(game);
    position.requireGameRuntime(game).timeoutNotificationShown = false;
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, nowUtc);
    game.resultState = expiredColour === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon;
    game.resultReason = ResultReason.Timeout;
    game.gameState = status.getAnalysisState(getOpponentColour(expiredColour));
    timestampGame(game);
    refreshRuntimeRegistrations(game);
  }
  function reconcileTimeout(game: IGame, nowUtc: ClockTimestamp): boolean {
    const expiredColour = _getExpiredColour(game, nowUtc);
    if (!expiredColour) return false;
    _finaliseTimeout(game, nowUtc, expiredColour);
    return true;
  }
  async function _settleTimeout(game: IGame, nowUtc: ClockTimestamp, expiredColour: PlayerColour) {
    const snapshot = game.clockSnapshot;
    try {
      await clearPlayerTurnRuntime(game);
      if (game.clockSnapshot === snapshot && game.resultState === ResultState.Ongoing) _finaliseTimeout(game, nowUtc, expiredColour);
    } finally {
      pendingTimeouts.delete(game);
    }
  }
  function syncClock(game: IGame, nowUtc: ClockTimestamp) {
    const pending = pendingTimeouts.get(game);
    if (pending) return pending;
    const expiredColour = _getExpiredColour(game, nowUtc);
    if (!expiredColour) return Promise.resolve();
    const settlement = _settleTimeout(game, nowUtc, expiredColour);
    pendingTimeouts.set(game, settlement);
    return settlement;
  }
  async function pauseGame(game: IGame, reason: PauseReason) {
    const nowUtc = new ClockTimestamp();
    if (_getExpiredColour(game, nowUtc)) return syncClock(game, nowUtc);
    const runtime = position.requireGameRuntime(game);
    if (!_canPauseForReason(game, reason)) return;
    if (status.isPausedState(game.gameState)) {
      runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
      timestampGame(game);
      return;
    }
    if ((!status.isLiveState(game.gameState) && !status.isLiveAnalysisState(game.gameState)) || game.resultState !== ResultState.Ongoing) return;
    runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, nowUtc);
    if (status.isLiveState(game.gameState)) game.gameState = status.getPausedState(position.getLivePosition(game).sideToMove);
    else game.gameState = status.getLiveAnalysisState(status.getLiveAnchorColour(game), position.getRenderedPosition(game).sideToMove, true);
    timestampGame(game);
    refreshRuntimeRegistrations(game);
  }
  async function resumeGame(game: IGame, reason: PauseReason) {
    if (!status.isPausedState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const nowUtc = new ClockTimestamp();
    if (_getExpiredColour(game, nowUtc)) return syncClock(game, nowUtc);
    const runtime = position.requireGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== reason);
    if ((runtime.pauseReasons ?? []).length > 0) {
      timestampGame(game);
      return;
    }
    game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, nowUtc);
    if (status.isPausedLiveState(game.gameState)) game.gameState = status.getLiveState(position.getLivePosition(game).sideToMove);
    else game.gameState = status.getLiveAnalysisState(status.getLiveAnchorColour(game), position.getRenderedPosition(game).sideToMove);
    timestampGame(game);
    refreshRuntimeRegistrations(game);
    if (status.isLiveTurnReadyForMove(game)) {
      await flushDeferredPlayerMove(game);
      requestPlayerMoveIfNeeded(game);
    }
  }
  return {
    isTimedGame,
    initialiseClockSnapshot,
    startClock,
    resumeClock,
    applyMove,
    refreshRuntimeRegistrations,
    reconcileTimeout,
    syncClock,
    pauseGame,
    resumeGame,
  };
}
export type GameClockComposable = ReturnType<typeof useGameClock>;
