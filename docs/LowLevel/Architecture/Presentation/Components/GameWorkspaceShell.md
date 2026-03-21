# GameWorkspaceShell

## Purpose
Provide the high-level region layout for the game workspace.

## Consumes
- header slot
- tab slot
- board slot
- side-panel slots
- footer or control slot

## Emits
- none directly

## Notes
- `GameView` uses `GameWorkspaceShell` to avoid large nested layout markup in the view itself.
- This component contains no HTML or template markup and adapts game-specific regions into the common `WorkspaceShell`.
