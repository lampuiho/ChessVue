# GameRuleService Module (Domain Logic)

## Purpose
Validate chess moves, and determine game end state.

## Interfaces
- `IChessboardState`
- `IChessPiece`
- `IGame`
- `IPlayer`

## Module Functions
- `isMoveLegal(gameState: IChessboardState, move: Move): boolean`
- `isCheck(position: IChessboardState, player: PlayerColor): boolean`
- `isCheckmate(position: IChessboardState, player: PlayerColor): boolean`
- `isStalemate(position: IChessboardState, player: PlayerColor): boolean`
- `generateLegalMoves(position: IChessboardState, player: PlayerColor): Move[]`
- `getPieceLegalDestinations(piece: IChessPiece, position: IChessboardState): Square[]`

## Called By
- `MoveUpdateService.addMainlineMove`
- `MoveUpdateService.addAnalysisMove`
- `GamesStore.makeMove`
- `GamesStore.validateMove`
- `GameView.onPlayerMove`

