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
  touchGame: (game: IGame) => void;
  clearPlayerTurnRuntime: (game: IGame) => void;
  flushDeferredPlayerMove: (game: IGame) => Promise<void>;
}

export function useGameClock(dependency: IGameClockDependency) {
  const { position, status, touchGame, clearPlayerTurnRuntime, flushDeferredPlayerMove } = dependency;
  function isTimedGame(game: IGame): boolean {
    return game.timeControl.initialMs !== undefined && game.timeControl.preset !== 'untimed';
  }
  function hasRunningClock(snapshot: IClockSnapshot): boolean {
    return snapshot.activeColour !== undefined
      && snapshot.startedAtUtc !== undefined
      && (snapshot.white.isRunning || snapshot.black.isRunning);
  }
  function canPauseForReason(game: IGame, reason: PauseReason): boolean {
    if (reason === PauseReason.Analysis) return true;
    return isTimedGame(game) && hasRunningClock(game.clockSnapshot);
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
  function refreshRuntimeRegistrations(game: IGame): void {
    const runtime = position.requireGameRuntime(game);
    runtime.focusReturnUnsubscribe?.();
    runtime.focusReturnUnsubscribe = undefined;
    if (!status.isLiveState(game.gameState) || game.resultState !== ResultState.Ongoing || !isTimedGame(game)) return;
    runtime.focusReturnUnsubscribe = PlatformEventService.subscribeToAppFocusReturned('GamesStore', () => syncClock(game, new ClockTimestamp()), `sync-clock-${game.metadata.id}`);
  }
  async function syncClock(game: IGame, nowUtc: ClockTimestamp): Promise<void> {
    if (!status.isLiveState(game.gameState) && !status.isPausedLiveState(game.gameState)) return;
    if (!TimeControlService.hasExpired(game.clockSnapshot, nowUtc)) return;
    const remainingTime = TimeControlService.getRemainingTime(game.clockSnapshot, nowUtc);
    const expiredColour = (remainingTime.white ?? 1) <= 0 ? PlayerColour.White : PlayerColour.Black;
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, nowUtc);
    game.resultState = expiredColour === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon;
    game.resultReason = ResultReason.Timeout;
    game.gameState = status.getAnalysisState(getOpponentColour(expiredColour));
    clearPlayerTurnRuntime(game);
    touchGame(game);
    refreshRuntimeRegistrations(game);
  }
  async function pauseGame(game: IGame, reason: PauseReason): Promise<void> {
    const runtime = position.requireGameRuntime(game);
    if (!canPauseForReason(game, reason)) return;
    if (status.isPausedState(game.gameState)) {
      runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
      return;
    }
    if ((!status.isLiveState(game.gameState) && !status.isLiveAnalysisState(game.gameState)) || game.resultState !== ResultState.Ongoing) return;
    runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, new ClockTimestamp());
    if (status.isLiveState(game.gameState)) game.gameState = status.getPausedState(position.getRenderedPosition(game).sideToMove);
    else game.gameState = status.getLiveAnalysisState(status.getLiveAnchorColour(game), position.getRenderedPosition(game).sideToMove, true);
    touchGame(game);
    refreshRuntimeRegistrations(game);
  }
  async function resumeGame(game: IGame, reason: PauseReason): Promise<void> {
    if (reason !== PauseReason.Analysis && !isTimedGame(game)) return;
    if (!status.isPausedState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const runtime = position.requireGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== reason);
    if ((runtime.pauseReasons ?? []).length > 0) return;
    game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, new ClockTimestamp());
    if (status.isPausedLiveState(game.gameState)) game.gameState = status.getLiveState(position.getRenderedPosition(game).sideToMove);
    else game.gameState = status.getLiveAnalysisState(status.getLiveAnchorColour(game), position.getRenderedPosition(game).sideToMove);
    touchGame(game);
    refreshRuntimeRegistrations(game);
    if (status.isLiveState(game.gameState)) await flushDeferredPlayerMove(game);
  }
  return {
    isTimedGame,
    initialiseClockSnapshot,
    startClock,
    resumeClock,
    applyMove,
    refreshRuntimeRegistrations,
    syncClock,
    pauseGame,
    resumeGame,
  };
}
export type GameClockComposable = ReturnType<typeof useGameClock>;
