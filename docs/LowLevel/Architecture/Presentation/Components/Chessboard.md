# Chessboard

Source: [`src/components/Chessboard.vue`](../../../../../src/components/Chessboard.vue)

## Purpose
Render a board position and collect move, premove-cancellation and board-edit input. It also serves as the read-only preview board in `SavedGamesView`.

## Interface
Props (defaults in brackets):

| Prop | Type | Meaning |
| --- | --- | --- |
| `position` | `IBoardPosition` | Canonical selected position, used for ordinary legality |
| `displayPosition?` | `IBoardPosition` | Premove projection for artwork, accessible labels and off-turn candidates |
| `premoveSquares?` | `ReadonlySet<BoardId>` | Pending premove endpoints, highlighted red |
| `premoveColour?` | `PlayerColour` | Eligible off-turn local colour; switches selection to premove candidates |
| `orientation?` | `BoardOrientation` [`White`] | Which side is at the bottom |
| `showCoordinates?` | `boolean` [`true`] | Rank and file labels |
| `highlightLastMove?` | `boolean` [`true`] | Last-move highlight |
| `lastMove?` | `IMove` | Highlight source and an input to legal-move generation (castling and en passant history) |
| `inputDisabled?` | `boolean` [`false`] | Disables all input and every square button |
| `boardEdit?` | `boolean` [`false`] | Board-edit mode with the piece palette |

Emits:
- `moveAttempted(move: IMoveRaw)`
- `premovesCancelled()`
- `chessPieceToggled(boardId: BoardId, piece: IChessPiece)`
- `chessPieceDeleted(boardId: BoardId)`
- `chessPieceMoved(from: BoardId, to: BoardId)`
- `boardCleared()`
- `boardReset()`

Slots: none.

## Dependencies
- Composables: `useModal` for the promotion chooser.
- Children: `ChessPiece`, `AppIcon`; mounted `PromotionModal`.
- Utility: `genLegalMovesForPiece`, `genCandidateMovesForPiece`.
- Styles: `board.css` (`.board-area`, `.board-grid`, `.board-square` and its modifiers, `.chess-piece`, `.coordinate`, `.move-dot`, `.piece-palette`).

## Rendering
- The board renders 64 square buttons directly in an eight-by-eight grid with explicit equal rows and columns, so legal click and drag targets keep their size after moves and route changes. Orientation reorders the squares. Each square's accessible name is its coordinate plus the displayed occupant's colour and kind.
- Square modifiers mark light and dark squares, selection, legal targets, capture targets, the last move and premove endpoints. Red premove fill takes precedence over the last-move background, which becomes an outline.
- Displayed pieces, capture markers and accessible names use `displayPosition` when supplied; the canonical position is never changed.
- **Planned:** board theme selection. Square colours are fixed in `board.css` in the initial phase.

## Input
- **Selection and moves.** Clicking a piece of the input colour (the premove colour when supplied, otherwise the side to move) selects it; clicking another of its pieces reselects; clicking the selected piece clears. Targets come from `genCandidateMovesForPiece(displayedPosition, from)` when a premove colour applies, otherwise from `genLegalMovesForPiece(position, from, lastMove)`. Click, drag and native keyboard activation all commit through the same target check and emit the offered raw move reference. Drag is offered only for eligible pieces. Canonical legality and `IMove` details are resolved by the store after submission.
- **Promotion.** When a target has several promotion candidates, the board opens `PromotionModal` with those exact raw candidates and the input colour, keeping the pending candidates and modal handle. A selection is accepted only if it is one of the pending candidates; a detached old chooser cannot complete a replacement. Cancel clears the attempt and permits another selection.
- **Premove cancellation.** Right-click clears the whole queue. On touch, pressing and releasing on the same premoved piece makes the resulting click cancel once instead of selecting. Escape clears unfinished input first, then the queue. `premovesCancelled` is emitted only when premove squares exist. While the promotion chooser is open its focus scope receives Escape first.
- **Board edit.** The palette selects a colour and a piece kind with accessible labels. Clicking a square emits `chessPieceToggled` with that piece; right-click emits `chessPieceDeleted`; dragging emits `chessPieceMoved`; *Clear* emits `boardCleared` and *Reset* emits `boardReset`. `GameView` maps these to the guarded `GamesStore` board-edit actions, which apply immediately.

## Lifecycle
`onBeforeUpdate` compares the current `position`, `displayPosition`, `premoveColour`, `boardEdit` and `inputDisabled` with the previous input context and clears selection, drag, touch tap and the pending promotion before a changed context renders. Selection-only renders and presentation-only prop changes keep the gesture. `onBeforeUnmount` clears the same state and closes a pending promotion. Neither boundary uses a watcher.

This replaced position and board-edit watchers ([code cleanup plan](../../../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition)). A drop or promotion begun on one board must not move a piece on its replacement, even when the replacement looks identical, so the comparison uses the actual prop objects. `GameView` keeps those objects stable across unrelated publications so evaluation updates do not cancel a gesture.

## Notes
- The parent owns game identity and mutation. The board renders a supplied position rather than the game's mutable root, so board-edit events target the game through `GameView` and the store's edit guards ([component simplification plan, retained events](../../../../ArchivedPlans/ComponentSimplificationPlan.md#retained-events-concrete-justifications)).
- Square rendering, the setup palette and promotion choice live here and in `PromotionModal`. The earlier `BoardSquare`, `PiecePalette`, `BoardGrid` and `SquareSurface` component proposals were never implemented.
- Premove presentation follows the [premove plan](../../../../ArchivedPlans/PreMovePlan%28ToDo%29.md#presentation); the raw-move boundary follows the [raw move submission design](../../../../ArchivedPlans/RawMoveSubmissionDesign.md).
