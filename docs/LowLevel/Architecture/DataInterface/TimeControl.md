# Time Control Types

## Purpose
Define the baseline time-control schema and the live timing snapshot used for drift-safe clock handling.

## Types
- `type TimeControlPreset = "bullet" | "blitz" | "rapid" | "classical" | "untimed"`

## Interfaces
- `interface ITimeControl`
- `interface IPlayerClock`
- `interface IClockSnapshot`

## Data Structures
```ts
interface ITimeControl {
  preset: TimeControlPreset | null
  initialMs: number | null
  incrementMs: number
}

interface IPlayerClock {
  remainingMs: number | null
  isRunning: boolean
}

interface IClockSnapshot {
  white: IPlayerClock
  black: IPlayerClock
  activeColour: PlayerColour | null
  startedAtUtc: string | null
  pausedAtUtc: string | null
  lastMoveAtUtc: string | null
}
```

## Rules
- `null` timing values represent untimed play.
- Relative timestamps, not UI tick counters, are the source of truth for remaining time.
- `clockState` on `IGameWorkspace` tells consumers whether a snapshot is running, paused, expired, or inactive.
