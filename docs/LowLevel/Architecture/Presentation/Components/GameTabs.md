# GameTabs

## Purpose
Render open game tabs and allow deterministic switching between workspaces.

## Consumes
- ordered open games from `UiStateStore`
- active game identity

## Emits
- `tabSelected`
- `tabClosed`

## Notes
- The tab bar hides when only one game is open.
