# MenuBar Component (Presentation)

## Purpose
Main menu actions: new game, load/save, settings, recent games.

## Interfaces
- `MenuBarProps`

## Component Methods
- `onNewGame(): void`
- `onLoadGame(): void`
- `onSaveGame(): void`
- `onOpenSettings(): void`

## Called By
- `App.vue`

## Calls
- `GamesStore.createGame`
- `GamesStore.loadGame`
- `FileIOAdapter.saveGameToFile`
- `UiStateStore.setCurrentGameId`
