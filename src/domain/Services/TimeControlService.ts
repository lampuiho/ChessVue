import { PlayerColour, TimeControlPreset, type IClockSnapshot, type ITimeControl } from '../../contracts'

import { getElapsedMs } from '../internal/Utc'

function cloneClockSnapshot(snapshot: IClockSnapshot): IClockSnapshot {
  return {
    white: { ...snapshot.white },
    black: { ...snapshot.black },
    activeColour: snapshot.activeColour,
    startedAtUtc: snapshot.startedAtUtc,
    pausedAtUtc: snapshot.pausedAtUtc,
    lastMoveAtUtc: snapshot.lastMoveAtUtc,
  }
}
function isUntimed(timeControl: ITimeControl): boolean {
  return timeControl.initialMs === null || timeControl.preset === TimeControlPreset.Untimed
}
function getClock(snapshot: IClockSnapshot, colour: PlayerColour) {
  return colour === PlayerColour.White ? snapshot.white : snapshot.black
}
function materialiseElapsed(snapshot: IClockSnapshot, nowUtc: string): IClockSnapshot {
  const nextSnapshot = cloneClockSnapshot(snapshot)

  if (nextSnapshot.activeColour === null || nextSnapshot.startedAtUtc === null) {
    return nextSnapshot
  }

  const activeClock = getClock(nextSnapshot, nextSnapshot.activeColour)

  if (activeClock.remainingMs === null || activeClock.isRunning === false) {
    return nextSnapshot
  }

  const elapsedMs = getElapsedMs(nextSnapshot.startedAtUtc, nowUtc)
  activeClock.remainingMs = Math.max(0, activeClock.remainingMs - elapsedMs)
  nextSnapshot.startedAtUtc = nowUtc

  return nextSnapshot
}
export const TimeControlService = {
  initialiseClockSnapshot(timeControl: ITimeControl): IClockSnapshot {
    if (isUntimed(timeControl)) {
      return {
        white: { remainingMs: null, isRunning: false },
        black: { remainingMs: null, isRunning: false },
        activeColour: null,
        startedAtUtc: null,
        pausedAtUtc: null,
        lastMoveAtUtc: null,
      }
    }

    return {
      white: { remainingMs: timeControl.initialMs, isRunning: false },
      black: { remainingMs: timeControl.initialMs, isRunning: false },
      activeColour: null,
      startedAtUtc: null,
      pausedAtUtc: null,
      lastMoveAtUtc: null,
    }
  },
  getRemainingTime(snapshot: IClockSnapshot, nowUtc: string): Record<PlayerColour, number> {
    const materialised = materialiseElapsed(snapshot, nowUtc)

    return {
      white: materialised.white.remainingMs ?? 0,
      black: materialised.black.remainingMs ?? 0,
    }
  },
  startClock(snapshot: IClockSnapshot, activeColour: PlayerColour, nowUtc: string): IClockSnapshot {
    const nextSnapshot = cloneClockSnapshot(snapshot)

    if (getClock(nextSnapshot, activeColour).remainingMs === null) {
      return nextSnapshot
    }

    nextSnapshot.white.isRunning = activeColour === PlayerColour.White
    nextSnapshot.black.isRunning = activeColour === PlayerColour.Black
    nextSnapshot.activeColour = activeColour
    nextSnapshot.startedAtUtc = nowUtc
    nextSnapshot.pausedAtUtc = null
    nextSnapshot.lastMoveAtUtc = nextSnapshot.lastMoveAtUtc ?? nowUtc

    return nextSnapshot
  },
  pauseClock(snapshot: IClockSnapshot, nowUtc: string): IClockSnapshot {
    if (snapshot.activeColour === null || snapshot.startedAtUtc === null) {
      return cloneClockSnapshot(snapshot)
    }

    const nextSnapshot = materialiseElapsed(snapshot, nowUtc)
    nextSnapshot.white.isRunning = false
    nextSnapshot.black.isRunning = false
    nextSnapshot.pausedAtUtc = nowUtc
    nextSnapshot.startedAtUtc = null

    return nextSnapshot
  },
  resumeClock(snapshot: IClockSnapshot, nowUtc: string): IClockSnapshot {
    if (snapshot.activeColour === null) {
      return cloneClockSnapshot(snapshot)
    }

    const activeClock = getClock(snapshot, snapshot.activeColour)

    if (activeClock.remainingMs === null || activeClock.isRunning) {
      return cloneClockSnapshot(snapshot)
    }

    const nextSnapshot = cloneClockSnapshot(snapshot)
    nextSnapshot.white.isRunning = nextSnapshot.activeColour === PlayerColour.White
    nextSnapshot.black.isRunning = nextSnapshot.activeColour === PlayerColour.Black
    nextSnapshot.startedAtUtc = nowUtc
    nextSnapshot.pausedAtUtc = null

    return nextSnapshot
  },
  applyMove(snapshot: IClockSnapshot, mover: PlayerColour, nowUtc: string, timeControl: ITimeControl): IClockSnapshot {
    if (isUntimed(timeControl)) {
      return cloneClockSnapshot(snapshot)
    }

    const materialised = materialiseElapsed(snapshot, nowUtc)
    const moverClock = getClock(materialised, mover)

    if (moverClock.remainingMs === null) {
      return materialised
    }

    moverClock.remainingMs += timeControl.incrementMs
    moverClock.isRunning = false

    const nextActiveColour: PlayerColour = mover === PlayerColour.White ? PlayerColour.Black : PlayerColour.White
    const nextActiveClock = getClock(materialised, nextActiveColour)
    nextActiveClock.isRunning = true

    materialised.activeColour = nextActiveColour
    materialised.startedAtUtc = nowUtc
    materialised.pausedAtUtc = null
    materialised.lastMoveAtUtc = nowUtc

    return materialised
  },
  hasExpired(snapshot: IClockSnapshot, nowUtc: string): boolean {
    const remaining = this.getRemainingTime(snapshot, nowUtc)

    return remaining.white <= 0 || remaining.black <= 0
  },
}

