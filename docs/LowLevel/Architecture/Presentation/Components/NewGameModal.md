# Presentation/Components/NewGameModal.md
# NewGameModal Component (Presentation)

## Purpose
Modal form to initiate new game options and quick presets.

## Data Interfaces
- NewGameOptions (from DataInterface/Game.md)
- ITimeControlConfig (from DataInterface/TimeControl.md)

## Component Methods
- open(): void
- close(): void
- submit(options: NewGameOptions): void

## Calls
- GamesStore.createGame
- UiStateStore.openTab

