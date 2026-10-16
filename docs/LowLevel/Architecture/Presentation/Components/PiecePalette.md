# PiecePalette

Status: design-only component boundary. The current `Chessboard.vue` implements its setup palette and promotion choices inline; there is no separate `PiecePalette.vue` module. The interface below describes the proposed extraction, not an existing runtime surface.

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
- Promotion selection and free-analysis board editing share this same piece-choice surface.
- `PiecePalette` contains no HTML or template markup and binds piece-choice state into common button renderers.
