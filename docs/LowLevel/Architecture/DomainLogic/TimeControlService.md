# DomainLogic/TimeControlService.md
# TimeControlService Module (Domain Logic)

## Purpose
Update clocks, apply increments/delays, and detect flag fall. Independent domain clock logic with no cross-module dependencies in this layer.

## Data Interfaces
- ITimeControlConfig, ClockState, PlayerClockState (from DataInterface/TimeControl.md)
- IGame (from DataInterface/Game.md)

## Module Functions
- initializeClockState(config: ITimeControlConfig): ClockState
- tickClock(clock: ClockState, deltaMs: number): ClockState
- applyIncrement(clock: ClockState, player: PlayerColour, config: ITimeControlConfig): ClockState
- getRemainingTime(clock: ClockState, player: PlayerColour): number
- isFlagFall(clock: ClockState): { flagged: boolean; player?: PlayerColour }
- updateClockAfterMove(clock: ClockState, player: PlayerColour, config: ITimeControlConfig): ClockState

## Calls
- none
