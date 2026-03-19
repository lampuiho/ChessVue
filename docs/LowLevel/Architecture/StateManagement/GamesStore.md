# StateManagement/GamesStore.md
# GamesStore Module (State Management)

## Purpose
Manage game instances, apply domain-driven updates, and persist games.

## Data Interfaces
- IGame, NewGameOptions (from DataInterface/Game.md)
- Move (from DataInterface/Move.md)
- IChessboardState (from DataInterface/ChessboardState.md)

## Module Functions
- createGame(options: NewGameOptions): IGame
- loadGame(gameId: string): IGame | null
- saveGame(game: IGame): void
- deleteGame(gameId: string): void
- makeMove(gameId: string, move: Move): boolean
- 	akeBack(gameId: string, count: number): boolean
- getGameById(gameId: string): IGame | undefined
- listGames(): IGame[]
- eplaceGame(game: IGame): void

## Calls
- GameRuleService.isMoveLegal
- MoveUpdateService.addMoveToMainline
- MoveUpdateService.navigateToNode
- TimeControlService.updateClockAfterMove
- SerializationService.serializeGameToJSON
- SerializationService.deserializeGameFromJSON
- StorageAdapter.setItem
- StorageAdapter.getItem
