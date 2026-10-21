import { PlayerColour, TimeControlPreset, type IClockSnapshot, type ITimeControl } from '@/contracts';
import { ClockTimestamp } from '@/utility/date';

function _getElapsedMs(startUtc: ClockTimestamp, endUtc: ClockTimestamp): number {
  return Math.max(0, endUtc.getTime() - startUtc.getTime());
}

function _cloneClockSnapshot(snapshot: IClockSnapshot): IClockSnapshot {
  return {
    white: { ...snapshot.white },
    black: { ...snapshot.black },
    activeColour: snapshot.activeColour,
    startedAtUtc: snapshot.startedAtUtc,
    pausedAtUtc: snapshot.pausedAtUtc,
    lastMoveAtUtc: snapshot.lastMoveAtUtc,
  };
}
function _isUntimed(timeControl: ITimeControl): boolean {
  return timeControl.initialMs === undefined || timeControl.preset === TimeControlPreset.Untimed;
}
function _getClock(snapshot: IClockSnapshot, colour: PlayerColour) {
  return colour === PlayerColour.White ? snapshot.white : snapshot.black;
}
function _materialiseElapsed(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot {
  const nextSnapshot = _cloneClockSnapshot(snapshot);

  if (nextSnapshot.activeColour === undefined || nextSnapshot.startedAtUtc === undefined) {
    return nextSnapshot;
  }

  const activeClock = _getClock(nextSnapshot, nextSnapshot.activeColour);

  if (activeClock.remainingMs === undefined || activeClock.isRunning === false) {
    return nextSnapshot;
  }

  const elapsedMs = _getElapsedMs(nextSnapshot.startedAtUtc, nowUtc);
  activeClock.remainingMs = Math.max(0, activeClock.remainingMs - elapsedMs);
  nextSnapshot.startedAtUtc = nowUtc;

  return nextSnapshot;
}
export const TimeControlService = {
  /** Does not mutate timeControl; returns a new clock snapshot. */
  initialiseClockSnapshot(timeControl: ITimeControl): IClockSnapshot {
    if (_isUntimed(timeControl)) {
      return {
        white: { isRunning: false },
        black: { isRunning: false },
      };
    }

    return {
      white: { remainingMs: timeControl.initialMs, isRunning: false },
      black: { remainingMs: timeControl.initialMs, isRunning: false },
    };
  },
  /** Does not mutate snapshot; returns remaining time from a materialised clone. */
  getRemainingTime(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): Record<PlayerColour, number | undefined> {
    const materialised = _materialiseElapsed(snapshot, nowUtc);

    return {
      white: materialised.white.remainingMs,
      black: materialised.black.remainingMs,
    };
  },
  /** Does not mutate snapshot; returns a new snapshot with running flags and timestamps updated. */
  startClock(snapshot: IClockSnapshot, activeColour: PlayerColour, nowUtc: ClockTimestamp): IClockSnapshot {
    const nextSnapshot = _cloneClockSnapshot(snapshot);

    if (_getClock(nextSnapshot, activeColour).remainingMs == null) return nextSnapshot;

    nextSnapshot.white.isRunning = activeColour === PlayerColour.White;
    nextSnapshot.black.isRunning = activeColour === PlayerColour.Black;
    nextSnapshot.activeColour = activeColour;
    nextSnapshot.startedAtUtc = nowUtc;
    nextSnapshot.pausedAtUtc = undefined;
    nextSnapshot.lastMoveAtUtc = nextSnapshot.lastMoveAtUtc ?? nowUtc;

    return nextSnapshot;
  },
  /** Does not mutate snapshot; returns a new paused snapshot. */
  pauseClock(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot {
    if (snapshot.activeColour === undefined || snapshot.startedAtUtc === undefined) {
      return _cloneClockSnapshot(snapshot);
    }

    const nextSnapshot = _materialiseElapsed(snapshot, nowUtc);
    nextSnapshot.white.isRunning = false;
    nextSnapshot.black.isRunning = false;
    nextSnapshot.pausedAtUtc = nowUtc;
    nextSnapshot.startedAtUtc = undefined;

    return nextSnapshot;
  },
  /** Does not mutate snapshot; returns a new resumed snapshot when resuming is valid. */
  resumeClock(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot {
    if (snapshot.activeColour === undefined) {
      return _cloneClockSnapshot(snapshot);
    }

    const activeClock = _getClock(snapshot, snapshot.activeColour);

    if (activeClock.remainingMs === undefined || activeClock.isRunning) {
      return _cloneClockSnapshot(snapshot);
    }

    const nextSnapshot = _cloneClockSnapshot(snapshot);
    nextSnapshot.white.isRunning = nextSnapshot.activeColour === PlayerColour.White;
    nextSnapshot.black.isRunning = nextSnapshot.activeColour === PlayerColour.Black;
    nextSnapshot.startedAtUtc = nowUtc;
    nextSnapshot.pausedAtUtc = undefined;

    return nextSnapshot;
  },
  /** Does not mutate snapshot or timeControl; returns a new snapshot with elapsed time and turn state applied. */
  applyMove(snapshot: IClockSnapshot, mover: PlayerColour, nowUtc: ClockTimestamp, timeControl: ITimeControl): IClockSnapshot {
    if (_isUntimed(timeControl)) {
      return _cloneClockSnapshot(snapshot);
    }

    const materialised = _materialiseElapsed(snapshot, nowUtc);
    const moverClock = _getClock(materialised, mover);

    if (moverClock.remainingMs === undefined) {
      return materialised;
    }

    moverClock.remainingMs += timeControl.incrementMs;
    moverClock.isRunning = false;

    const nextActiveColour: PlayerColour = mover === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
    const nextActiveClock = _getClock(materialised, nextActiveColour);
    nextActiveClock.isRunning = true;

    materialised.activeColour = nextActiveColour;
    materialised.startedAtUtc = nowUtc;
    materialised.pausedAtUtc = undefined;
    materialised.lastMoveAtUtc = nowUtc;

    return materialised;
  },
  /** Does not mutate snapshot. */
  hasExpired(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): boolean {
    const remaining = this.getRemainingTime(snapshot, nowUtc);

    return (remaining.white ?? 1) <= 0 || (remaining.black ?? 1) <= 0;
  },
};
