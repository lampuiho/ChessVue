# DomainLogic/SerializationService.md
# SerializationService Module (Domain Logic)

## Purpose
Serialize and deserialize game state across JSON/FEN/PGN for persistence and interchange.

## Data Interfaces
- IGame, IChessboardState, IMoveTree (from DataInterface/Game.md, DataInterface/ChessboardState.md, DataInterface/Move.md)

## Module Functions
- serializeGameToJSON(game: IGame): string
- deserializeGameFromJSON(json: string): IGame
- serializePositionToFEN(position: IChessboardState): string
- deserializePositionFromFEN(fen: string): IChessboardState
- serializeGameToPGN(game: IGame): string
- deserializeGameFromPGN(pgn: string): IGame
- migrateSavedGame(oldData: any): IGame
- parseMoveSAN(san: string, position: IChessboardState): IMove

## Private Helpers
- alidateFEN(fen: string): boolean
- parseFEN(fen: string): IChessboardState
- uildFEN(position: IChessboardState): string
- parsePGNHeaders(pgn: string): Record<string, string>
- parsePGNMoves(pgn: string): string[]
- 	oSAN(move: IMove, position: IChessboardState): string

## Calls
- none
