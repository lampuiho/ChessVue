# ChessPiece

Source: [`src/components/common/ChessPiece.vue`](../../../../../../src/components/common/ChessPiece.vue)

## Purpose
Render a single chess piece as SVG artwork for its kind and colour.

## Interface
- Props: the fields of [`IChessPiece`](../../../DataInterface/ChessPiece.md): `kind: PieceKind`, `colour: PlayerColour`.
- Emits: none. Slots: none.

## Dependencies
- Callers: `Chessboard` (squares and the board-edit palette), `PlayerPanel` (avatar and captured material), `PromotionModal` (choices).
- Styles: `board.css` (`.piece-artwork`, `.piece-artwork--white`, `.piece-artwork--black`, `.piece-artwork__detail`, `.piece-artwork__eye`).

## Notes
- The SVG is decorative (`aria-hidden`, not focusable); the surrounding square or button carries the accessible name.
- Fill and outline come from colour-variant custom properties in `board.css`; selection, highlight and drag state belong to the parent square, not to the piece.
- `ChessPiece` does not own square selection, move rules or drag-and-drop orchestration.
- **Planned:** piece theme selection will change the artwork drawn here without changing board logic. The initial phase uses one fixed piece set.
