# AnalysisChessPieceButton

## Purpose
Provide chess-piece-shaped selection buttons for piece-choice flows in analysis and setup contexts.

## Consumes
- piece kind
- piece colour
- selected and disabled state
- active piece theme

## Emits
- `clicked`

## Notes
- This button family is used for piece-choice interactions such as promotion selection and board-edit/setup piece picking.
- It combines `ChessPiece` rendering with button semantics instead of treating piece choice as a plain text action.
