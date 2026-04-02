# SavedGamesView

## Purpose
Render the route-level ChessVue saved-games surface for internal save and load flows.

## Routes
- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`

## Responsibilities
- render the top-level `Save` and `Load` route tabs
- render the grouped game list for `/saved-games/load`
- render the selected game's save-list screen for `/saved-games/save/:name` and `/saved-games/load/:name`
- forward click selection, double-click latest-load path resolution, and picker requests to `SavedGamesStore`
- forward the confirmed `Save` and `Load` execution actions to `GamesStore` once the flow has resolved the target path
- keep all business rules such as latest-save choice, save grouping, overwrite handling, and payload save or load execution out of the view layer

## Notes
- `/saved-games/load` uses `Cancel` and `Select` in the bottom-right action row.
- Clicking a game on `/saved-games/load` selects it only.
- Double-clicking a game on `/saved-games/load` resolves that game's latest save and loads it immediately.
- `/saved-games/load/:name` replaces the `Select` action with `Load`.
- `/saved-games/save/:name` keeps the save-name text box focused on open and uses `Cancel` plus `Save`.
