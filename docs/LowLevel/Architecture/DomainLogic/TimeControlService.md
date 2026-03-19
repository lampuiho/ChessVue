# DomainLogic/TimeControlService.md
# TimeControlService Module (Domain Logic)

## Purpose
Manage per-player clocks and flag detection for time control.

## Data Interfaces
- TimeControlConfig, ClockState, PlayerClockState (from DataInterface/TimeControl.md)
- IGame (from DataInterface/Game.md)

## Module Functions
- initializeClockState(config: TimeControlConfig): ClockState
- tickClock(clock: ClockState, deltaMs: number): ClockState
- applyIncrement(clock: ClockState, player: PlayerColor, config: TimeControlConfig): ClockState
- getRemainingTime(clock: ClockState, player: PlayerColor): number
- isFlagFall(clock: ClockState): { flagged: boolean; player?: PlayerColor }
- updateClockAfterMove(clock: ClockState, player: PlayerColor, config: TimeControlConfig): ClockState
- pauseClock(clock: ClockState): ClockState

## Private Helpers
- 
ormalizeClockValue(value: number): number
- switchActiveClock(clock: ClockState, activePlayer: PlayerColor): ClockState

## Calls
- none
