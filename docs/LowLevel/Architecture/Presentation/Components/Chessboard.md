# Chessboard

## Purpose
Render the visible board state and collect move or board-edit input.

## Consumes
- canonical selected `position` for ordinary legality; optional `displayPosition` for projected artwork
- optional `premoveColour` for off-turn selection and `premoveSquares: ReadonlySet<BoardId>` for red endpoints
- orientation and appearance settings
- input-disabled and board-edit flags from the owning view
- last move for highlights and legal-move generation

## Emits
- `moveAttempted(move: IMoveRaw)`
- `premovesCancelled()`
- `chessPieceToggled`
- `chessPieceDeleted`
- `chessPieceMoved`
- `boardCleared`
- `boardReset`

## Notes
- `Chessboard.vue` renders the square buttons, piece glyphs, legal targets, and setup palette directly in its template; promotion mounts `PromotionModal` through `useModal`.
- Legal targets come from the shared chess utilities for the selected piece. Click, drag and native keyboard activation emit raw from/to coordinates and an explicit promotion choice when applicable. Canonical legal matching and `IMove` enrichment happen in `GameMoveComposable.makeMove`, after submission.
- The mounted promotion dialog names each choice by moving colour and piece kind. Pending choices leave the canonical position unchanged; Cancel clears the local attempt and permits another selection. The board owns the exact pending raw candidate objects and modal handle; a detached old button cannot complete a replacement chooser.
- Board editing is enabled only when the workspace context allows it.
- The rendered board uses eight explicit equal grid rows and columns, including empty ranks, so legal click and drag targets retain their dimensions after moves and route changes.
- In board edit, the inline palette selects a colour and kind using accessible labels. Clicking a square emits `chessPieceToggled` with a `BoardId` and `IChessPiece`; right-click emits `chessPieceDeleted`; dragging emits `chessPieceMoved` with source and target IDs.
- Clear emits `boardCleared`; Reset emits `boardReset`. The owning view maps these to the guarded `GamesStore` actions, including `resetBoardToStartPosition(...)`, and applies edits immediately.
- Selection, pending drag and pending promotion clear when the position, editing mode or input permission changes. A drop from the previous context cannot move a piece in the replacement board; a fresh drag remains available. Disabled board squares expose their disabled state to accessibility consumers.
- The `onBeforeUpdate` lifecycle hook clears transient input before rendering a changed position, editing mode or input permission. It compares those props with the current input context so selection renders and presentation-only updates preserve the gesture. `onBeforeUnmount` closes pending promotion. Neither boundary uses a watcher.
- Off-turn targets use `genCandidateMovesForPiece(displayedPosition, from)`; ordinary targets use `genLegalMovesForPiece(position, from, lastMove)`. Displayed pieces, capture markers and accessible square names share the projected board; canonical position stays untouched. Drag is offered only for eligible pieces.
- `_emitMove` forwards the offered raw reference. Right-click clears the entire queue; touch down/up on the same premoved piece captures a tap and the resulting click cancels once. Escape clears unfinished input first, then the queue. Modal focus owns the first Escape while promotion is open. External display/colour/input changes and unmount clear selection, drag, touch and promotion.
