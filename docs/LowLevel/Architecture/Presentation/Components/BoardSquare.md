# BoardSquare

## Purpose
Render one board square with selection, highlight, target, and drag/drop state.

## Consumes
- square identity
- square colour
- current occupant via `ChessPiece`
- selected, highlighted, check, and last-move state

## Emits
- `squareSelected`
- `pieceDropped`

## Notes
- `Chessboard` composes `BoardSquare` instances in a flat grid.
- `BoardSquare` contains no HTML or template markup and adapts square state into common board-render primitives.
