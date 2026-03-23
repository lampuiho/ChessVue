# TabbedView

## Purpose
Provide a reusable tab-strip wrapper for deterministic tab selection and close behaviour.

## Consumes
- ordered tabs
- active tab identity
- closable and disabled state per tab
- `TabButton` for tab interaction rendering
- tab label and panel slots

## Emits
- `tabSelected`
- `tabClosed`

## Notes
- `TabbedView` emits selected tab IDs only and does not compose or validate routes.
- Route mapping belongs to the owning feature, for example `GameTabs` mapping to `/game/:id` and `SettingsView` mapping to `/settings/:category`.
- `GameTabs` should specialise `TabbedView` for game workspaces instead of owning generic tab behaviour itself.
