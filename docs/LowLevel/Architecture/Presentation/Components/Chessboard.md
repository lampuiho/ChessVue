# Chessboard

## Purpose
Render the visible board state and collect move or board-edit input.

## Consumes
- visible board position
- orientation and appearance settings
- input-disabled and board-edit flags from the owning view
- last move for highlights and legal-move generation

## Emits
- `moveAttempted`
- `chessPieceToggled`
- `chessPieceDeleted`
- `chessPieceMoved`
- `boardCleared`
- `boardReset`

## Notes
- `Chessboard.vue` renders the square buttons, piece glyphs, legal targets, promotion popover and setup palette directly in its template.
- Legal targets come from the shared chess utilities for the selected piece. Click and drag moves emit detailed legal moves; promotion waits for a selected kind or cancellation.
- Board editing is enabled only when the workspace context allows it.
- The rendered board uses eight explicit equal grid rows and columns, including empty ranks, so legal click and drag targets retain their dimensions after moves and route changes.
- In board edit, the inline palette selects a colour and kind using accessible labels. Clicking a square emits `chessPieceToggled` with a `BoardId` and `IChessPiece`; right-click emits `chessPieceDeleted`; dragging emits `chessPieceMoved` with source and target IDs.
- Clear emits `boardCleared`; Reset emits `boardReset`. The owning view maps these to the guarded `GamesStore` actions, including `resetBoardToStartPosition(...)`, and applies edits immediately.
- Selection and pending promotion clear when the position or editing mode changes. Disabled board squares expose their disabled state to accessibility consumers.
