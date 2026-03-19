# DomainLogic/GameRuleService.md
# GameRuleService Module (Domain Logic)

## Purpose
Validate chess moves and board state according to rules and variant constraints.

## Data Interfaces
- IChessboardState (from DataInterface/ChessboardState.md)
- IChessPiece (from DataInterface/ChessPiece.md)
- Move (from DataInterface/Move.md)

## Module Functions
- isMoveLegal(position: IChessboardState, move: IMove): boolean
- generateLegalMoves(position: IChessboardState, player: PlayerColor): IMove[]
- applyMove(position: IChessboardState, move: IMove): IChessboardState
- isCheck(position: IChessboardState, player: PlayerColor): boolean
- isCheckmate(position: IChessboardState, player: PlayerColor): boolean
- isStalemate(position: IChessboardState, player: PlayerColor): boolean
- evaluateGameStatus(position: IChessboardState): GameStatus
- getPositionFEN(position: IChessboardState): string
- loadPositionFromFEN(fen: string): IChessboardState

## Private Helpers
- computePieceLegalMoves(piece: IChessPiece, position: IChessboardState): IMove[]
- isPathClear(from: string, to: string, board: IChessboardState): boolean
- pplyCastleMove(position: IChessboardState, move: IMove): IChessboardState
- pplyEnPassantMove(position: IChessboardState, move: IMove): IChessboardState
- pplyPromotion(position: IChessboardState, move: IMove): IChessboardState

## Calls
- none
