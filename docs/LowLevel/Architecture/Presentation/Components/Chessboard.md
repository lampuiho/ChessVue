# Chessboard

## Purpose
Render the visible board state and collect move or board-edit input.

## Consumes
- visible board position
- orientation and appearance settings
- current legal-move highlights supplied by the owning view/store layer
- `ChessPiece` for piece rendering inside squares
- `BoardSquare` for square-level interaction and highlight rendering
- `PiecePalette` for promotion and setup piece-choice flows

## Emits
- `moveAttempted`
- `promotionRequested`
- `boardEditConfirmed`
- `boardEditCancelled`
- `selectionCleared`

## Notes
- The component does not run move-legality rules itself.
- `Chessboard` composes square rendering, drag/select interactions, and `ChessPiece` presentation.
- Piece-choice overlays for promotion or setup flows may use `AnalysisChessPieceButton`.
- Board editing is enabled only when the workspace context allows it.
- `Chessboard` contains no HTML or template markup and binds board view models into `BoardGrid`, `BoardSquare`, and `PiecePalette`.
