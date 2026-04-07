# TimeControlService

## Purpose
Calculate timed and untimed clock behaviour independently of UI tick loops.

## Public Interface
```ts
initialiseClockSnapshot(timeControl: ITimeControl): IClockSnapshot
getRemainingTime(snapshot: IClockSnapshot, nowUtc: string): Record<PlayerColour, number | null>
startClock(snapshot: IClockSnapshot, activeColour: PlayerColour, nowUtc: string): IClockSnapshot
pauseClock(snapshot: IClockSnapshot, nowUtc: string): IClockSnapshot
resumeClock(snapshot: IClockSnapshot, nowUtc: string): IClockSnapshot
applyMove(snapshot: IClockSnapshot, mover: PlayerColour, nowUtc: string, timeControl: ITimeControl): IClockSnapshot
hasExpired(snapshot: IClockSnapshot, nowUtc: string): boolean
```

## Responsibilities
- initialise untimed and timed games correctly
- provide an authoritative remaining-time read model for UI tick rendering
- pause and resume without drift
- finalise timeout once
- keep free analysis, history review, and in-game analysis from consuming live time

## Scenario Coverage
- `SCN-TIME-01`
- `SCN-TIME-02`
- `SCN-TIME-03`
- `SCN-TIME-04`
- `SCN-TIME-05`
