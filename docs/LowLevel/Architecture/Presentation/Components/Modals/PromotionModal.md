# PromotionModal

Source: [`src/components/modals/PromotionModal.vue`](../../../../../../src/components/modals/PromotionModal.vue)

## Purpose
Let the user choose a promotion piece for a pending pawn move.

## Interface
- Props: `moves: readonly IMoveRaw[]`, the exact pending raw candidates (legal moves or premove candidates); `colour: PlayerColour`, the moving colour; `signal: AbortSignal`.
- Emits: `selected(move: IMoveRaw)`, `dismissed()`. Slots: none.

## Dependencies
- Children: `ModalDialog`, `ChessPiece`.
- Styles: `dialogs.css` (`.promotion-row`).
- No store or game dependency.

## Notes
- Each candidate renders as a piece button labelled `Promote to <colour> <piece>`. Raw moves carry no moving colour, so `colour` is needed for the artwork and labels.
- A choice is ignored after the opening has been aborted or if it is not one of `moves`. Otherwise the modal emits `selected` with that exact candidate and then `dismissed`.
- Cancel, Escape and the backdrop dismiss without a move.
- `Chessboard._commitTarget` opens it, passing `onSelected` and an `onClosed` that clears only this opening's pending input. The board accepts a selection only if it is still one of its pending candidates, then emits `moveAttempted` to `GameView`. Board replacement, permission loss and unmount close the opening, so a detached chooser cannot commit a move. `selected` and `dismissed` stay separate because choosing a piece is not, by itself, permission to commit a canonical move ([component simplification plan, retained events](../../../../../ArchivedPlans/ComponentSimplificationPlan.md#retained-events-concrete-justifications)).
