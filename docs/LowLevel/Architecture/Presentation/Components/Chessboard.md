# Presentation/Components/Chessboard.md
# Chessboard Component (Presentation)

## Purpose
Render chessboard, pieces, highlighting, and move input.

## Data Interfaces
- IChessboardState (from DataInterface/ChessboardState.md)
- IChessPiece (from DataInterface/ChessPiece.md)

## Component Methods
- enderBoard(board: IChessboardState): VNode
- onSquareClick(square: string): void
- onPieceDrag(start: string, end: string): void
- highlightLegalMoves(piece: IChessPiece): string[]

## Emits
- moveAttempt({from, to}): void
- pieceSelected(square): void

## Calls
- GameRuleService.generateLegalMoves
- GameRuleService.isMoveLegal
