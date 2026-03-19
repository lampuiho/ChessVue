# Presentation/Components/GameTabs.md
# GameTabs Component (Presentation)

## Purpose
Render tabs for open games and manage switching between games.

## Data Interfaces
- IGame (from DataInterface/Game.md)
- IUiState (from DataInterface/UiState.md)

## Component Methods
- enderTabs(gameIds: string[]): VNode
- onSelectTab(gameId: string): void
- onCloseTab(gameId: string): void

## Calls
- UiStateStore.openTab
- UiStateStore.closeTab
- GamesStore.getGameById

