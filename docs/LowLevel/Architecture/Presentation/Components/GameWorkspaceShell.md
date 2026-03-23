# GameWorkspaceShell

## Purpose
Provide the high-level region layout for the game workspace.

## Consumes
- menu slot
- tab slot
- board-column slot
- sidebar-panel slot
- sidebar-control slot

## Emits
- none directly

## Notes
- `GameView` uses `GameWorkspaceShell` to avoid large nested layout markup in the view itself.
- This component contains no HTML or template markup and adapts game-specific regions into the common `WorkspaceShell`.
- The layout keeps `GameControlPanel` fixed in the bottom region of the right sidebar rather than treating it as a full-width page footer.
- The board and sidebar regions should scale through flexible layout rules where practical, avoiding fixed widths outside genuine invariants such as the square board surface.
