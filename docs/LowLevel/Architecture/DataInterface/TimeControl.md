# Time Control Types

## Purpose
Define the baseline time-control schema and the live timing snapshot used for drift-safe clock handling.

## Types
- `enum TimeControlPreset`

## Interfaces
- `interface ITimeControl`
- `interface IPlayerClock`
- `interface IClockSnapshot`

## Data Structures
```ts
enum TimeControlPreset {
  Bullet = "bullet",
  Blitz = "blitz",
  Rapid = "rapid",
  Classical = "classical",
  Untimed = "untimed"
}

interface ITimeControl {
  preset?: TimeControlPreset
  initialMs?: number
  incrementMs: number
}

interface IPlayerClock {
  remainingMs?: number
  isRunning: boolean
}

interface IClockSnapshot {
  white: IPlayerClock
  black: IPlayerClock
  activeColour?: PlayerColour
  startedAtUtc?: ClockTimestamp
  pausedAtUtc?: ClockTimestamp
  lastMoveAtUtc?: ClockTimestamp
}
```

## Rules
- Omitted timing values represent untimed play.
- Relative timestamps, not UI tick counters, are the source of truth for remaining time. **Why:** UI ticks are only render cadence and may be throttled in the background; deriving elapsed time from stored instants prevents missed renders from becoming lost clock time. Any replacement must remain independent of UI update frequency.
- Published clock snapshots are stable history records. Clock transitions create replacement snapshots, including copied white and black clock records, so current timing changes cannot mutate snapshots retained on move-tree nodes. **Why:** restore and takeback require the exact clock at each historical node; one shared mutable snapshot would rewrite that history on later ticks, pauses, or moves. Immutable timestamp instances may remain shared because transitions replace rather than mutate them.
- `gameState` on `IGame` tells consumers whether a snapshot is actively running, paused, or outside live clock consumption.
- `IClockSnapshot` stores timing data only. It does not replace `gameState` and `resultState` as the authority for whether the game is in live play, live analysis, board edit, or post-result analysis.
