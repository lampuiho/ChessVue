# Presentation/Components/PlayerPanel.md
# PlayerPanel Component (Presentation)

## Purpose
Render player info and clocks.

## Data Interfaces
- IPlayer (from DataInterface/Game.md)
- ClockState (from DataInterface/TimeControl.md)

## Component Methods
- enderPlayerInfo(player: IPlayer): VNode
- ormatClock(ms: number): string

## Calls
- TimeControlService.getRemainingTime
- GamesStore.getGameById
