# Presentation/Components/GameControlPanel.md
# GameControlPanel Component (Presentation)

## Purpose
User controls for resigning, taking back moves, toggling analysis mode, and clock control.

## Data Interfaces
- IGame (from DataInterface/Game.md)

## Component Methods
- onResign(): void
- onOfferDraw(): void
- onTakeBack(): void
- onPause(): void
- onEnterAnalysisMode(): void

## Calls
- GamesStore.takeBack
- UiStateStore.showModal
- GamesStore.makeMove

