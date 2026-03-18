# PlayerPanel Component (Presentation)

## Purpose
Show player name, clock, captured pieces, and status.

## Interfaces
- `PlayerPanelProps`

## Component Methods
- `renderPlayerInfo(player: IPlayer): VNode`
- `formatClock(ms: number): string`

## Called By
- `GameView`

## Calls
- `TimeControl.getRemainingTime`
- `GamesStore.getGameById`
