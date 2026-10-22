# Chessboard

## Purpose
Render the visible board state and collect move or board-edit input.

## Consumes
- visible board position
- orientation and appearance settings
- input-disabled and board-edit flags from the owning view
- last move for highlights and legal-move generation

## Emits
- `moveAttempted(move: IMoveRaw)`
- `chessPieceToggled`
- `chessPieceDeleted`
- `chessPieceMoved`
- `boardCleared`
- `boardReset`

## Notes
- `Chessboard.vue` renders the square buttons, piece glyphs, legal targets, promotion popover and setup palette directly in its template.
- Legal targets come from the shared chess utilities for the selected piece. Click, drag and native keyboard activation emit raw from/to coordinates and an explicit promotion choice when applicable. Canonical legal matching and `IMove` enrichment happen in `GameMoveComposable.makeMove`, after submission.
- The inline Pawn promotion group names each choice by moving colour and piece kind. Pending choices leave the canonical position unchanged; Cancel clears the local attempt and permits another selection. A shallow pending array owns the exact candidate objects; a detached old button cannot complete a replacement chooser.
- Board editing is enabled only when the workspace context allows it.
- The rendered board uses eight explicit equal grid rows and columns, including empty ranks, so legal click and drag targets retain their dimensions after moves and route changes.
- In board edit, the inline palette selects a colour and kind using accessible labels. Clicking a square emits `chessPieceToggled` with a `BoardId` and `IChessPiece`; right-click emits `chessPieceDeleted`; dragging emits `chessPieceMoved` with source and target IDs.
- Clear emits `boardCleared`; Reset emits `boardReset`. The owning view maps these to the guarded `GamesStore` actions, including `resetBoardToStartPosition(...)`, and applies edits immediately.
- Selection, pending drag and pending promotion clear when the position, editing mode or input permission changes. A drop from the previous context cannot move a piece in the replacement board; a fresh drag remains available. Disabled board squares expose their disabled state to accessibility consumers.
- One synchronous component-scoped watcher observes only the external position, editing-mode and input-disabled props and clears transient input. Engine replies and history navigation originate outside board actions, so this input boundary is an explicit exception in `scripts/CodeAuditPolicy.json`; it performs no gameplay or persistence work.
