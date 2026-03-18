# Chessboard Component (Presentation)

## Purpose
Render squares, pieces, highlights; handle user move input and drag/drop.

## Interfaces
- `ChessboardProps`
- `ChessboardEmitEvents`

## Component Methods
- `renderBoard(board: IChessboardState): VNode`
- `onSquareClick(square: Square): void`
- `onPieceDrag(start: Square, end: Square): void`
- `highlightLegalMoves(piece: IChessPiece): Square[]`

## Called By
- `GameView`

## Emits
- `moveAttempt({from, to}): void`
- `pieceSelected(square): void`

## Calls
- `GameRules.generateLegalMoves`
- `GameRules.isMoveLegal`
