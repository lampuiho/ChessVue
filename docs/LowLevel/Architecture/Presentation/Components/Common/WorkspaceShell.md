# WorkspaceShell

## Purpose
Provide a reusable layout shell for complex screens with named regions such as header, content, sidebars, and footer.

## Consumes
- header slot
- primary-content slot
- secondary-content slot
- footer slot

## Emits
- none directly

## Notes
- `GameWorkspaceShell` is the game-specific composition of this reusable shell.
- The shell exists to reduce deep layout nesting inside views.
- `WorkspaceShell` should prefer flexible region sizing through flexbox or grid and use usage-named `rem`-based spacing variables for shell gaps and padding.
