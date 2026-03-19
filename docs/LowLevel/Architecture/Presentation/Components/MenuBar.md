# Presentation/Components/MenuBar.md
# MenuBar Component (Presentation)

## Purpose
Render top-level app actions, new game, load, save, and settings navigation.

## Data Interfaces
- IGame (from DataInterface/Game.md)

## Component Methods
- onNewGame(): void
- onLoadGame(): void
- onSaveGame(): void
- onOpenSettings(): void

## Calls
- GamesStore.createGame
- GamesStore.loadGame
- FileIOAdapter.saveGameToFile
- UiStateStore.setCurrentGameId

