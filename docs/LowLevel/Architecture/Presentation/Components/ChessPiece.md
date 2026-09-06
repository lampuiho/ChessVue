# ChessPiece

## Purpose
Render a single chess piece token according to the selected piece theme and piece colour.

## Consumes
- piece kind
- piece colour
- active piece theme
- optional selected, highlighted, or draggable visual state

## Emits
- none directly

## Notes
- `ChessPiece` is a presentational child of `Chessboard`.
- It does not own square selection, move rules, or drag/drop orchestration.
- Future theme switching will change the rendered asset or glyph set without changing board logic. The initial phase requires only a fixed piece presentation and the code structure to support that future extension.
