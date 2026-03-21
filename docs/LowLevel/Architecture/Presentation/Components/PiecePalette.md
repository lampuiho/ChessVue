# PiecePalette

## Purpose
Render a small piece-choice control surface for promotion and setup/edit flows.

## Consumes
- available piece kinds
- selected piece kind
- piece colour
- active piece theme

## Emits
- `pieceChosen`
- `cancelRequested`

## Notes
- `PiecePalette` uses `AnalysisChessPieceButton` for individual piece choices.
- `Chessboard` or a dialog wrapper may host this component depending on the interaction flow.
- `PiecePalette` contains no HTML or template markup and binds piece-choice state into common button renderers.
