# DomainLogic/SerializationService.md
# SerializationService Module (Domain Logic)

## Purpose
Serialize and deserialize chess game state to/from JSON/FEN/PGN and migrate legacy formats.

## Data Interfaces
- IGame, IChessboardState, IMoveTree (from DataInterface/Game.md, DataInterface/ChessboardState.md, DataInterface/Move.md)

## Module Functions
- serializeGameToJSON(game: IGame): string
- serializeGameToFEN(position: IChessboardState): string
- serializeGameToPGN(game: IGame): string
- deserializeGame(game: IGame): string
- migrateSavedGame(oldData: any): IGame

## Private Functions
- deserializeGameFromJSON(json: string): IGame
- deserializeGameFromFEN(fen: string): IChessboardState
- deserializeGameFromPGN(pgn: string): IGame
- determineGameFormat(game: string): GameFormat

## Calls
- none
