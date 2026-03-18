# TimeControl Module (Domain Logic)

## Purpose
Manage per-player clocks, increments, delays, and remaining time calculations.

## Interfaces
- `TimeControlConfig`
- `ClockState`
- `IGame`

## Module Functions
- `initializeClocks(config: TimeControlConfig): ClockState`
- `tickClock(game: IGame, deltaMs: number): IGame`
- `applyIncrement(game: IGame, player: PlayerType): IGame`
- `getRemainingTime(game: IGame, player: PlayerType): number`
- `isFlagFall(game: IGame): { flagged: boolean; player?: PlayerType }`
- `updateClockAfterMove(game: IGame, move: Move): IGame`

## Called By
- `GamesStore.makeMove`
- `GameView.onTimerTick`
- `PlayerPanelComponent.render`

## Calls
- `Serialization.serializeGame`
