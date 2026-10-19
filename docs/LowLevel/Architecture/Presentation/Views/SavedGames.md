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
- validate the managed save-name field and emit a save request only for an accepted single file-name segment
- forward click selection, double-click latest-load requests, save requests, delete requests, import requests, export requests, and picker requests to `SavedGamesStore`
- forward loaded saved-game payloads into `GamesStore.insertGame(...)` once `SavedGamesStore` has completed the document read
- keep all business rules such as latest-save choice, save grouping, overwrite handling, document serialisation, and payload loading out of the view layer

## Notes
- `/saved-games/load` uses `Cancel` and `Select` in the bottom-right action row.
- Clicking a game on `/saved-games/load` selects it only.
- Double-clicking a game on `/saved-games/load` resolves that game's latest save and loads it immediately.
- `/saved-games/load/:name` replaces the `Select` action with `Load`.
- `/saved-games/save/:name` keeps the save-name text box focused on open and uses `Cancel` plus `Save`.
- The `Save` action is disabled with inline feedback while the name is blank, reserved, or path-like. The store receives only an accepted value and does not repeat this form validation.
- Selection, refresh and successful route-commit actions explicitly resolve the snapshot and start details delivery. `OperationOwner` aborts superseded delivery, settles before replacement and disposes on unmount; underlying read success/rejection remains handled. This view has no watchers.
- Saved-route activation clears pending overwrite intent and preserves the save-name draft. The router callback is removed on unmount.
