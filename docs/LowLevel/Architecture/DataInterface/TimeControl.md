# TimeControl Config and ClockState

## Purpose
Define time control structures and per-player clock state.

## Interfaces
- `TimeControlVariant` (`"bullet" | "blitz" | "rapid" | "classical"`)
- `ITimeControlConfig`
- `ClockState`

## Data Structures
- `interface ITimeControlConfig {
  initialMs: number
  incrementMs: number
  delayMs?: number
  incrementType: "simple" | "bronstein" | "fischer"
  maxTimeMs?: number
  variant?: TimeControlVariant
}

- `interface PlayerClockState {
  remainingMs: number
  lastTickAt: number
  isRunning: boolean
  hasFlagged: boolean
}

- `interface ClockState {
  white: PlayerClockState
  black: PlayerClockState
  activeColor: PlayerColour
}
