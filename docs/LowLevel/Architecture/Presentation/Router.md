# Router

## Purpose
Define the baseline route map and route-guard responsibilities for the desktop shell.

## Routes
- `/home`
- `/game/:id`
- `/settings`
- `/settings/:category`

## Responsibilities
- route startup to home or restored session target
- reject invalid `/game/:id` routes and redirect to a valid fallback
- redirect `/settings` to `/settings/session`
- reject invalid `/settings/:category` routes and redirect to `/settings/session`
- preserve the active game route when leaving and returning from settings
- support route-backed settings-category navigation and game-tab navigation without pushing route composition into the tab primitive

## Dependencies
- `UiStateStore`
- `GamesStore`

## Notes
- The router does not load or mutate game data directly.
- `GameView` is the only baseline game workspace screen.
- `TabbedView` emits selected tab IDs only; `GameTabs` maps those IDs to `/game/:id`, while `SettingsView` maps category IDs to `/settings/:category`.
