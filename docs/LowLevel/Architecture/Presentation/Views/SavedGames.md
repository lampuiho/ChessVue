# SavedGamesView

Source: [`src/views/SavedGamesView.vue`](../../../../../src/views/SavedGamesView.vue)

## Purpose
Render the route-level library for internal save and load flows, plus file import and export.

## Routes
- `/saved-games/load` (`load-games`): the grouped game list with a preview of the selected game's latest save.
- `/saved-games/load/:name` (`load-game`): the selected game's snapshots, where `name` is the saved game's ID.
- `/saved-games/save/:name` (`save-game`): the named-save form for the open game whose ID is `name`, alongside that game's existing snapshots.

## Dependencies
- Stores: `SavedGamesStore` (`listSavedGames`, `loadGame`, `saveGame`, `deleteSave`, `deleteGame`, `importGame`, `exportGame`), `GamesStore` (`getGame`, `insertGame`), `SettingsStore` (board orientation), `UiStateStore` (`openTab`, `gameSession.activeGameId`).
- Domain reads: `SavedGameIndexService.getLatestSaveEntry`, `MoveApplicationService.genPosition` and `MoveHistoryService.getMoveSequence` for previews.
- Children: `NavigationFrame`, `Chessboard` (read-only preview with `input-disabled`, no coordinates or last-move highlight), `AppIcon`; mounted `ConfirmationModal` and `MessageModal`.
- Styles: `library.css`; navigation, fields and buttons from `navigation.css` and `shared.css`.

## Responsibilities
- Render navigation for Load and Save modes (Save is disabled without an active game), Import file, Export in save mode, and Close back to the active game or `/home`.
- On `/saved-games/load`, list each saved game with its snapshot count and latest save. Clicking selects a game; double-clicking loads its latest save; the chevron or *Select game* opens its snapshots. *Delete game* asks for confirmation and deletes every snapshot; open workspace games stay open.
- On the detail routes, list automatic saves first, then named saves under a separator. Selecting a snapshot shows its preview board and metadata (saved time, plies, players, clock, result). Load routes load a snapshot by double-click, the row's Load button or *Load selected*. Each snapshot has a delete action with confirmation.
- On the save route, show the current workspace and an `autofocus` save-name field seeded from the game name; Enter saves. Selecting an existing named snapshot copies its name into the field.
- Validate the save name before calling the store: blank names, the reserved name `auto`, path or control characters, a trailing dot and reserved device names are rejected with inline feedback, and Save stays disabled. The store receives only an accepted single file-name segment and does not repeat this form validation.
- Request overwrite confirmation when the name already exists in the group, or when the store reports `AlreadyExists`.
- After loading or importing a document, insert it with `GamesStore.insertGame`, open its tab and navigate to `/game/:id`.
- Keep business rules out of the view: latest-save choice, save grouping, overwrite handling, document serialisation and payload loading stay in `SavedGamesStore` and the domain services.

## Notes
- `/saved-games/load/:name` for an unknown game shows *Saved game not found*. Deleting a group's last save from that route replaces it with `/saved-games/load`.
- `/saved-games/save/:name` without a matching open game shows *No active game*; there is no redirect.
- Opening the library reads every group's latest document to build names and previews; an unreadable document falls back to a short game ID.
- Selection, refresh and successful route commits explicitly resolve the snapshot and start details delivery through an `OperationOwner`, which aborts superseded delivery, settles it before replacement and disposes on unmount. An uncancellable read's late success or failure is still handled but cannot overwrite current details. This view has no watchers ([code cleanup plan](../../../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions)).
- A `router.afterEach` hook runs after each successful saved-games route commit: it closes any pending confirmation, initialises the route and refreshes the selection, preserving the save-name draft. The hook is removed on unmount.
- Overwrite confirmation uses `dismissibleWhileWorking: false`, so dismissal and focus restoration wait until the write settles. Deletion confirmations capture the exact save or game identity.
- Import failures open `MessageModal` with its error variant; other failures appear in the footer feedback.
