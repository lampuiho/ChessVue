# TabbedView

## Purpose
Provide a reusable tab-strip wrapper for deterministic child-route navigation within the current router-view level.

## Consumes
- ordered tabs
- active tab identity
- closable and disabled state per tab
- current route base for the active router-view level
- `TabButton` for tab interaction rendering
- tab label and panel slots

## Emits
- `tabSelected`
- `tabClosed`

## Notes
- `TabbedView` handles route switching by appending the selected tab ID to the current router-view level, which matches child-route navigation.
- The component owns generic tab-to-route selection behaviour, but it does not validate domain-specific IDs or load store data.
- `GameTabs` should specialise `TabbedView` for game workspaces instead of owning generic tab-routing behaviour itself.
