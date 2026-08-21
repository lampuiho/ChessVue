import { PlayerColour, TimeControlPreset, type IClockSnapshot, type ITimeControl } from '@/contracts';
import { ClockTimestamp } from '@/utility/date';

function getElapsedMs(startUtc: ClockTimestamp, endUtc: ClockTimestamp): number {
  return Math.max(0, endUtc.getTime() - startUtc.getTime());
}

function cloneClockSnapshot(snapshot: IClockSnapshot): IClockSnapshot {
  return {
    white: { ...snapshot.white },
    black: { ...snapshot.black },
    activeColour: snapshot.activeColour,
    startedAtUtc: snapshot.startedAtUtc,
    pausedAtUtc: snapshot.pausedAtUtc,
    lastMoveAtUtc: snapshot.lastMoveAtUtc,
  };
}
function isUntimed(timeControl: ITimeControl): boolean {
  return timeControl.initialMs === undefined || timeControl.preset === TimeControlPreset.Untimed;
}
function getClock(snapshot: IClockSnapshot, colour: PlayerColour) {
  return colour === PlayerColour.White ? snapshot.white : snapshot.black;
}
function materialiseElapsed(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot {
  const nextSnapshot = cloneClockSnapshot(snapshot);

  if (nextSnapshot.activeColour === undefined || nextSnapshot.startedAtUtc === undefined) {
    return nextSnapshot;
  }

  const activeClock = getClock(nextSnapshot, nextSnapshot.activeColour);

  if (activeClock.remainingMs === undefined || activeClock.isRunning === false) {
    return nextSnapshot;
  }

  const elapsedMs = getElapsedMs(nextSnapshot.startedAtUtc, nowUtc);
  activeClock.remainingMs = Math.max(0, activeClock.remainingMs - elapsedMs);
  nextSnapshot.startedAtUtc = nowUtc;

  return nextSnapshot;
}
export const TimeControlService = {
  /** Does not mutate timeControl; returns a new clock snapshot. */
  initialiseClockSnapshot(timeControl: ITimeControl): IClockSnapshot {
    if (isUntimed(timeControl)) {
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
    const materialised = materialiseElapsed(snapshot, nowUtc);

    return {
      white: materialised.white.remainingMs,
      black: materialised.black.remainingMs,
    };
  },
  /** Does not mutate snapshot; returns a new snapshot with running flags and timestamps updated. */
  startClock(snapshot: IClockSnapshot, activeColour: PlayerColour, nowUtc: ClockTimestamp): IClockSnapshot {
    const nextSnapshot = cloneClockSnapshot(snapshot);

    if (getClock(nextSnapshot, activeColour).remainingMs === undefined) {
      return nextSnapshot;
    }

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
      return cloneClockSnapshot(snapshot);
    }

    const nextSnapshot = materialiseElapsed(snapshot, nowUtc);
    nextSnapshot.white.isRunning = false;
    nextSnapshot.black.isRunning = false;
    nextSnapshot.pausedAtUtc = nowUtc;
    nextSnapshot.startedAtUtc = undefined;

    return nextSnapshot;
  },
  /** Does not mutate snapshot; returns a new resumed snapshot when resuming is valid. */
  resumeClock(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot {
    if (snapshot.activeColour === undefined) {
      return cloneClockSnapshot(snapshot);
    }

    const activeClock = getClock(snapshot, snapshot.activeColour);

    if (activeClock.remainingMs === undefined || activeClock.isRunning) {
      return cloneClockSnapshot(snapshot);
    }

    const nextSnapshot = cloneClockSnapshot(snapshot);
    nextSnapshot.white.isRunning = nextSnapshot.activeColour === PlayerColour.White;
    nextSnapshot.black.isRunning = nextSnapshot.activeColour === PlayerColour.Black;
    nextSnapshot.startedAtUtc = nowUtc;
    nextSnapshot.pausedAtUtc = undefined;

    return nextSnapshot;
  },
  /** Does not mutate snapshot or timeControl; returns a new snapshot with elapsed time and turn state applied. */
  applyMove(snapshot: IClockSnapshot, mover: PlayerColour, nowUtc: ClockTimestamp, timeControl: ITimeControl): IClockSnapshot {
    if (isUntimed(timeControl)) {
      return cloneClockSnapshot(snapshot);
    }

    const materialised = materialiseElapsed(snapshot, nowUtc);
    const moverClock = getClock(materialised, mover);

    if (moverClock.remainingMs === undefined) {
      return materialised;
    }

    moverClock.remainingMs += timeControl.incrementMs;
    moverClock.isRunning = false;

    const nextActiveColour: PlayerColour = mover === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
    const nextActiveClock = getClock(materialised, nextActiveColour);
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
