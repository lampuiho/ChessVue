# Presentation/Views/Home.md
# HomeView Component (Presentation)

## Purpose
Show quick actions: new game, resume games, and saved game shortcuts.

## Data Interfaces
- IGame (from DataInterface/Game.md)

## Component Methods
- setupHomeActions(): void
- onCreateQuickGame(): void
- onResumeGame(gameId: string): void

## Calls
- GamesStore.listGames
- GamesStore.createGame
- UiStateStore.setCurrentGameId

