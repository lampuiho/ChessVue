# Presentation/Components/PlayerPanel.md
# PlayerPanel Component (Presentation)

## Purpose
Render player info and clocks.

## Data Interfaces
- IPlayer (from DataInterface/Game.md)
- ClockState (from DataInterface/TimeControl.md)

## Component Methods
- renderPlayerInfo(player: IPlayer): VNode
- formatClock(ms: number): string

## Calls
- TimeControlService.getRemainingTime
- GamesStore.getGameById
