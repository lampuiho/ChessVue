# SerializationService Module (Domain Logic)

## Purpose
Serialize and deserialize game state to/from FEN, PGN, and JSON.

## Interfaces
- `IGamePersisted`
- `FENString`
- `PGNString`

## Module Functions
- `serializeGameToJSON(game: IGame): string`
- `deserializeGameFromJSON(json: string): IGame`
- `serializeGameToFEN(game: IGame): FENString`
- `deserializeGameFromFEN(fen: FENString): IChessboardState`
- `serializeGameToPGN(game: IGame): PGNString`
- `migrateSavedGame(oldData: any): IGame`

## Called By
- `GamesStore.loadGame`
- `GamesStore.saveGame`
- `FileIOAdapter.saveGameToFile`
- `FileIOAdapter.loadGameFromFile`

## Calls
- `MoveUpdateService.getCurrentPosition`
- `GameRules.generateLegalMoves` (for PGN validation)
