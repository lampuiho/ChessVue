# Chessboard

## Purpose
Render the visible board state and collect move or board-edit input.

## Consumes
- visible board position
- orientation and appearance settings
- current legal-move highlights supplied by the owning view/store layer

## Emits
- `moveAttempted`
- `promotionRequested`
- `boardEditConfirmed`
- `selectionCleared`

## Notes
- The component does not run move-legality rules itself.
- Board editing is enabled only when the workspace context allows it.
