# Router

## Purpose
Define the baseline route map and route-guard responsibilities for the desktop shell.

## Routes
- `/home`
- `/game/:id`
- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`
- `/settings`
- `/settings/:category`

## Responsibilities
- route startup to a restored session target only when `gameSession.restorePreviousSession = true` and the stored session resolves to a valid route
- fall back to `/home` whenever session restore is disabled, missing, corrupt, or no longer valid
- reject invalid `/game/:id` routes and redirect to a valid fallback
- allow route entry to the grouped saved-games load surface at `/saved-games/load`
- allow route entry to `/saved-games/save/:name` only when the save flow has a valid current game context
- treat `/saved-games/load/:name` as the selected-game load surface and fall back to `/saved-games/load` when the selected target is invalid or unresolved
- redirect `/settings` to `/settings/session`
- reject invalid `/settings/:category` routes and redirect to `/settings/session`
- preserve the active game route when leaving and returning from settings
- keep saved-games routing route-owned, consistent with `SavedGamesView`
- support route-backed settings-category navigation and game-tab navigation without pushing route composition into the tab primitive

## Dependencies
- `UiStateStore`
- `GamesStore`

## Notes
- The router does not load or mutate game data directly.
- `GameView` is the only baseline game workspace screen.
- `SavedGamesView` is the baseline route-level save/load screen.
- `TabbedView` emits selected tab IDs only; `GameTabs` maps those IDs to `/game/:id`, while `SettingsView` maps category IDs to `/settings/:category`.
- Flow docs continue to show owner-private functions such as `Router._resolveStartupTarget`, `Router._restoreReturnRoute`, `Router._validateGameRoute`, and `Router._selectFallbackRoute`. If those share implementation with session-state coercion, that implementation is documented under `SessionNavigationUtility` in [UtilityIndex.md](../UtilityIndex.md).
