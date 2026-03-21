# GameTabs

## Purpose
Render open game tabs and allow deterministic switching between workspaces.

## Consumes
- ordered open games from `UiStateStore`
- active game identity
- `TabbedView` for shared tab-strip behaviour

## Emits
- `tabSelected`
- `tabClosed`

## Notes
- The tab bar hides when only one game is open.
- `GameTabs` is a game-specific adapter over the generic `TabbedView` pattern.
- In the game workspace, tab switching is route-driven rather than local-panel-driven, so selecting a tab updates the child-level route target for the current router-view level.
- `GameTabs` contains no HTML or template markup and binds tab state into `TabbedView`.
