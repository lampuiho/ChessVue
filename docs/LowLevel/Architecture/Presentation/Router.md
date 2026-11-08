# Router

Source: [`src/router/index.ts`](../../../../src/router/index.ts)

## Purpose
Define the route map shared by the browser and NW.js targets. The router module only declares routes and redirects; it registers no global guards. Startup restore, session checkpoints, route validation and leave confirmations are owned by `App` and the route views listed under [Responsibilities](#responsibilities).

## Routes
| Path | Name | View | Notes |
| --- | --- | --- | --- |
| `/` | — | redirect | `/home` |
| `/home` | `home` | `HomeView` | |
| `/game/:id` | `game` | `GameView` | `id` is the workspace game ID |
| `/saved-games/save/:name` | `save-game` | `SavedGamesView` | `name` carries the ID of the game being saved |
| `/saved-games/load` | `load-games` | `SavedGamesView` | Grouped library list |
| `/saved-games/load/:name` | `load-game` | `SavedGamesView` | `name` carries the saved game's ID |
| `/settings` | — | redirect | `/settings/session` |
| `/settings/:category(session\|gameplay\|appearance\|engines)` | `settings` | `SettingsView` | Parent of the engine routes below |
| `/settings/:category(engines)/profiles/new` | `engine-profile-new` | `EngineProfileView` | Optional `packagePath` query hint |
| `/settings/:category(engines)/profiles/:profileId/edit` | `engine-profile-edit` | `EngineProfileView` | |
| `/settings/:category(engines)/profiles/:profileId/copy` | `engine-profile-copy` | `EngineProfileView` | |
| `/settings/:category(engines)/packages/import` | `engine-package-import` | `EnginePackageImportView` | |
| `/settings/:category(engines)/packages/details` | `engine-package-details` | `EnginePackageDetailsView` | Required `packagePath` query |
| `/:pathMatch(.*)*` | — | redirect | `/home`, including unknown settings categories |

Every view is a lazy `import()`, so each route loads its own chunk and the engine-management views load only when visited.

## History and Base Path
The router uses `createWebHistory(import.meta.env.BASE_URL)`. Vite's `base` comes from `CHESSVUE_BASE_PATH` and defaults to `/`. The GitHub Pages workflow builds the browser target with the repository base path and copies `index.html` to `404.html`, so direct app URLs under that path load the application and the router resolves them against the base. Local development and the NW.js host serve the app at `/`. Using the build base as the history base keeps route URLs and built asset URLs under the same prefix; hard-coding `/` would break every route on a project site served below the domain root.

## Nested Engine Routes
The engine-management views are children of the `settings` route. Their absolute paths keep the `:category` parameter but constrain it to `engines`, so `SettingsView` stays mounted and renders the child through a `RouterView` keyed by `route.fullPath`. When no child matches, Settings shows its normal category content.

This replaced an `EngineProfileModal` opened from Settings. Profile forms, repeated option rows and import review are page-sized and need direct URLs, Back/Forward and reload, which a modal handle that closes on route changes cannot provide. Keeping the parent mounted preserves the Settings draft and its dirty-leave confirmation, so child navigation neither applies nor discards settings. Keying the outlet by full path ends the previous form owner when the edited profile or query changes. See the [engine management UI design](../../../ArchivedPlans/EngineManagementUiDesign.md#routes-and-view-ownership). The invariant is that the URL alone selects the mounted engine view, with no hidden editor state.

## Responsibilities
| Responsibility | Owner |
| --- | --- |
| Restore the stored committed route at startup when `gameSession.restorePreviousSession` is on and the app opened at its home entry | `App` `onMounted` |
| Close stored tabs and record `/home` when restore is off | `App._restoreWorkspace` |
| Replace an unknown `/game/:id` at startup with the first restorable open game or `/home` | `App` `onMounted` |
| Replace an unknown `/game/:id` during navigation | `GameView._activateGame`, from `onMounted` (`router.replace`) and `onBeforeRouteUpdate` (returns the fallback route) |
| Record the active route after each successful committed navigation | `App` `router.afterEach` → `UiStateStore.setActiveGame` / `setActiveRoute`, then `saveGameSession` |
| Coerce persisted session routes and open tabs | `UiStateStore` private helpers (see [UiStateStore](../StateManagement/UiStateStore.md)) |
| Redirect unknown paths and unknown settings categories | Catch-all redirect to `/home` |
| `/saved-games/save/:name` without a matching open game | `SavedGamesView` shows *No active game* and disables Save; no redirect |
| `/saved-games/load/:name` for an unknown saved game | `SavedGamesView` shows *Saved game not found*; deleting a group's last save replaces the route with `/saved-games/load` |
| Confirm leaving Settings with unapplied changes | `SettingsView` `onBeforeRouteLeave` |
| Return from Settings or Saved games to the active game, else `/home` | `returnRoute` in `SettingsView` and `SavedGamesView`, from `UiStateStore.gameSession.activeGameId` |
| Cancel game playback and close a pending continuation when leaving or switching game routes | `GameView` route hooks |
| Cancel late quick-game UI delivery | `useQuickGame` route hooks |
| Settle an engine package file action before leaving | `EnginePackageImportView` route hooks |
| Initialise the library after a saved-games route commits | `SavedGamesView` `router.afterEach` |

## Notes
- Committed routes recorded in the session are `/home`, `/game/:id`, `/saved-games/load`, `/saved-games/load/:name`, `/saved-games/save/:name` and `/settings/:category`. Redirects and engine child routes are not recorded, so the session keeps the last committed Settings category.
- Startup restore runs in `App` after the stores load because it needs the loaded settings, session snapshot and restored games.
- Game-tab selection requests `/game/:id` through `useGameTabActions.select`; the App checkpoint publishes the selection only after navigation succeeds. Settings categories navigate to `/settings/:category` from the Settings navigation frame.
- The router does not load or mutate game data. `GameView` is the only game workspace screen and `SavedGamesView` the only save/load screen.
- Earlier docs named private router functions such as `Router._resolveStartupTarget`, `Router._restoreReturnRoute`, `Router._validateGameRoute` and `Router._selectFallbackRoute`. They do not exist; their responsibilities belong to the owners in the table above.
