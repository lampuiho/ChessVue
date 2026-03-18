# GamesStore Module (State Management)

## Purpose
Manage active games, create/load/delete games, and dispatch game updates.

## Interfaces
- `IGamesStore`
- `IGame`

## Module Functions
- `createGame(options: NewGameOptions): IGame`
- `loadGame(gameId: string): IGame | null`
- `saveGame(game: IGame): void`
- `deleteGame(gameId: string): void`
- `makeMove(gameId: string, move: Move): boolean`
- `takeBack(gameId: string, count: number): void`
- `getGameById(gameId: string): IGame | undefined`
- `listGames(): IGame[]`

## Called By
- `GameView.getCurrentGame`
- `GameView.onMove`
- `MenuBarComponent.onNewGame`
- `Router.beforeRouteEnter`

## Calls
- `MoveUpdateService.addMainlineMove`
- `MoveUpdateService.addAnalysisMove`
- `MoveUpdateService.takeback`
- `GameRules.isMoveLegal`
- `TimeControl.updateClockAfterMove`
- `Serialization.serializeGameToJSON`
- `Serialization.deserializeGameFromJSON`
- `StorageAdapter.setItem`
- `StorageAdapter.getItem`
