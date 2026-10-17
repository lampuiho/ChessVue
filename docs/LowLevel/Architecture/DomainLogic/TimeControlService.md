# TimeControlService

## Purpose
Calculate timed and untimed clock behaviour independently of UI tick loops.

## Public Interface
```ts
initialiseClockSnapshot(timeControl: ITimeControl): IClockSnapshot
getRemainingTime(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): Record<PlayerColour, number | undefined>
startClock(snapshot: IClockSnapshot, activeColour: PlayerColour, nowUtc: ClockTimestamp): IClockSnapshot
pauseClock(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot
resumeClock(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): IClockSnapshot
applyMove(snapshot: IClockSnapshot, mover: PlayerColour, nowUtc: ClockTimestamp, timeControl: ITimeControl): IClockSnapshot
hasExpired(snapshot: IClockSnapshot, nowUtc: ClockTimestamp): boolean
```

## Mutation Contract
- Clock snapshots are immutable history records once published to a game or move node. Start, pause, resume, elapsed-time materialisation, and move application therefore copy the supplied snapshot and its two mutable player-clock records before applying a transition.
- Returning a new snapshot prevents current clock changes from rewriting snapshots already retained in move history or observed by another workflow.
- `getRemainingTime(...)` materialises elapsed time on a copied snapshot so this derived read never mutates its caller-owned input.
- Timestamp objects are retained by reference because `ClockTimestamp` values are treated as immutable instants.

## Responsibilities
- initialise untimed and timed games correctly
- provide an authoritative remaining-time read model for UI tick rendering
- pause and resume without drift
- detect expiry and clamp elapsed time at zero; `GamesStore` owns single timeout finalisation and turn cleanup
- leave paused snapshots fixed during explicit analysis and other pauses; ordinary history review retains a running live snapshot

## Scenario Coverage
- `SCN-TIME-01`
- `SCN-TIME-02`
- `SCN-TIME-03`
- `SCN-TIME-04`
- `SCN-TIME-05`
