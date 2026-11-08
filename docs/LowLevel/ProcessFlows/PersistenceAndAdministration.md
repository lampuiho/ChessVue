# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`. It also records implemented flows that have no scenario ID yet: saved-game previews, whole saved-game deletion, panel-layout persistence and browser engine package import, details and removal.

Startup reads, session checkpoints and the game-menu pause boundary are in [StartupAndNavigation.md](StartupAndNavigation.md). Engine option discovery and runtime ownership are in [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md).

## Storage Ownership And Failure Policy
- `SavedGamesStore` owns managed-save listing, save, load, restore lookup, deletion, external import/export and close-trigger autosave registration. `SavedGameIndexService` owns folder and file-name rules (`<saveRootPath>/<gameId>/auto.json` and `<saveRootPath>/<gameId>/<saveName>.json`) and latest-save selection. `SerializationService` owns game, session and layout document conversion and their storage calls. `UserSettingService` owns the settings document directly through its private `_readSettingsDocument` and `_writeSettingsDocument` helpers. `EnginePackageService` owns browser engine package files.
- Storage failures preserve usable in-memory work. `App._saveSession` turns a rejected session write into a recoverable notice that the next successful checkpoint clears. `HistoryPanel` and `AnalysisPanel` keep their changed fold state when a layout write fails and show their own inline error. `SettingsStore` accepts and caches a draft only after its write succeeds. `SavedGamesView` shows overwrite failures inside the confirmation, and refreshes its groups and selection in a `finally` path after a deletion attempt, even when the target vanished or deletion was denied.
- `SavedGamesView` starts snapshot-details delivery through an `OperationOwner` from explicit selection, route-activation and refresh actions; replacement and unmount cancel it, including when the same snapshot is selected again, and a late read success or failure cannot change the current details. This replaced the earlier selection watchers; see [async ownership decisions](../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions). The journey-only `changeManagedFile` helper in `journeys/JourneyStorageControl.ts` simulates external file changes through `BrowserFileSystem` without replacing the production adapter.

## Platform Storage Branches
Every flow below calls the `IStorageAdapter` or `IPlatformService` surface. These tables expand the two targets selected in [Bootstrap Flow B](StartupAndNavigation.md#flow-b---select-the-platform-service). Paths are relative strings such as `saves`, `settings.json`, `game-session.json` and `layout-state.json`: NW.js resolves them against the process working directory; the browser stores them as keys in one `localStorage` index, `chessvue:files:v1`.

### Managed Documents

#### Flow A - NW.js Managed Documents
| `NwjsStorageAdapter.readTextFile` |
| --- |
| `fs.promises.readFile` |
| `TextDecoder.decode` (UTF-8, fatal) |

| `NwjsStorageAdapter.writeTextFile` |
| --- |
| `fs.promises.mkdir` (`ensureParentDirectory`) |
| `fs.promises.writeFile` (flag `w` with `overwrite`, otherwise `wx`) |

| `NwjsStorageAdapter.listDirectory` |
| --- |
| `fs.promises.readdir` |
| `fs.promises.stat` (each file, for `lastModifiedUtc`) |

| `NwjsStorageAdapter.deleteFile` |
| --- |
| `fs.promises.unlink` |

#### Flow B - Browser Managed Documents
| `BrowserStorageAdapter.readTextFile` |
| --- |
| `imports.get(path)` (transient import token) |
| `BrowserFileSystem.readTextFile` |

| `BrowserStorageAdapter.writeTextFile` |
| --- |
| `downloads.get(path)` (transient download token) |
| `BrowserFileSystem.writeTextFile` |

| `BrowserFileSystem.writeTextFile` |
| --- |
| `BrowserFileSystem._read` |
| `BrowserFileSystem._ensureDirectory` (`ensureParentDirectory`) |
| `BrowserFileSystem._write` |

| `BrowserStorageAdapter.listDirectory` |
| --- |
| `BrowserFileSystem.listDirectory` |

| `BrowserStorageAdapter.deleteFile` |
| --- |
| `BrowserFileSystem.deleteFile` |

- Both adapters map failures to `IPlatformError` kinds: `NotFound`, `AlreadyExists`, `PermissionDenied` and `InvalidDocument`. `BrowserFileSystem` rereads the index for every operation, gives each written file a strictly increasing `modifiedAt`, reports a quota or storage exception as `PermissionDenied` and an unreadable index as `InvalidDocument`.

### External File Pickers

#### Flow A - NW.js Pickers
| `NwjsStorageAdapter.showOpenDialog` |
| --- |
| `NwjsStorageAdapter._createFileInput` (`nwworkingdir`) |
| `NwjsStorageAdapter._resolveFileDialog` |

| `NwjsStorageAdapter.showSaveDialog` |
| --- |
| `NwjsStorageAdapter._createFileInput` (`nwsaveas`, `nwworkingdir`) |
| `NwjsStorageAdapter._resolveFileDialog` |

#### Flow B - Browser Pickers
| `BrowserStorageAdapter.showOpenDialog` |
| --- |
| `BrowserStorageAdapter._selectFile` |
| `BrowserStorageAdapter._readFile` |

| `BrowserStorageAdapter.showSaveDialog` |
| --- |

| `BrowserStorageAdapter.writeTextFile` (download token) |
| --- |
| `BrowserStorageAdapter._download` |

- NW.js returns the selected native path; dismissing either dialog rejects with `PlatformErrorKind.Cancelled`. The browser open picker reads the chosen file immediately as strict UTF-8 into an opaque `browser-import:<uuid>/<name>` token that the next `readTextFile` consumes. The browser save picker cannot show a dialog: it returns a `browser-download:<uuid>/<name>` token at once, and the next `writeTextFile` to that token downloads the JSON through a Blob link, subject to the browser's download preferences. Browser pickers ignore desktop start directories.

### App-Close Dispatch

#### Flow A - NW.js Window Close
| `NwjsPlatformService.subscribeToAppCloseRequested` |
| --- |
| `NwjsPlatformService._attachWindowCloseListener` (first subscription) |
| `NwjsPlatformService._registerCallback` |

| NW.js window `close` listener (`_close`) |
| --- |
| `NwjsPlatformService.triggerAppCloseRequested` |
| `NwjsPlatformService._disposeProcessManagers` |
| `nw.App.quit` or `nativeWindow.close(true)` |

#### Flow B - Browser Checkpoint
| `BrowserPlatformService.subscribeToAppCloseRequested` |
| --- |
| `BrowserPlatformService._register` |

| `BrowserPlatformService._checkpoint` (`pagehide`, or `visibilitychange` to hidden) |
| --- |
| `BrowserPlatformService.triggerAppCloseRequested` |

- NW.js awaits each registered callback in order before stopping engine processes and quitting; one callback failure is collected and does not block later callbacks. The browser dispatches the same callbacks at every page-hide or hidden-visibility checkpoint, including an ordinary tab switch, but cannot hold a closing tab open for asynchronous work, so close-trigger autosave there is best effort and failures are only logged.

## Persistence And File I/O

### SCN-SAVE-01 - Autosave Internal Save Entry

#### Flow A - Move-Threshold Autosave
| `GameMoveComposable._applyLiveMove` or `GameMoveComposable._advanceRenderedAnalysisBranch` |
| --- |
| `GameRecordComposable.moveCommitted` |

| `GameRecordComposable.moveCommitted` |
| --- |
| `UserSettingService.getSettings` |
| `SavedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.Autosave })` (queued) |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGamesStore._getSaveRootPath` |
| `SavedGamesStore._getTargetPath` |
| `SerializationService.writeGameDocument` |

| `SavedGamesStore._getTargetPath` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |

| `SerializationService.writeGameDocument` |
| --- |
| `SerializationService.serialiseGame` |
| `IStorageAdapter.writeTextFile` (`ensureParentDirectory: true`) |

#### Flow B - Report An Autosave Failure
| `GameView` setup |
| --- |
| `GamesStore.onAutosaveFailed` |

| `GamesStore.onAutosaveFailed` |
| --- |
| `GameRecordComposable.onAutosaveFailed` |

| `GameRecordComposable.moveCommitted` queued failure |
| --- |
| each listener registered through `onAutosaveFailed` |

| `GameView` failure listener |
| --- |
| `GameView._showNotice` |

| `GameView` `onBeforeUnmount` |
| --- |
| `disposeAutosaveNotice` |

#### Flow C - Register Close-Trigger Autosave
| `App` startup callback (`onMounted`) |
| --- |
| `SavedGamesStore.registerAutosaveOnClose(() => GamesStore.listGames())` |

| `SavedGamesStore.registerAutosaveOnClose` |
| --- |
| `SavedGamesStore.disposeAutosaveOnClose` |
| `PlatformEventService.subscribeToAppCloseRequested('SavedGamesStore', callback, 'autosave-on-close')` |

| `PlatformEventService.subscribeToAppCloseRequested` |
| --- |
| `IPlatformService.subscribeToAppCloseRequested` |

#### Flow D - Close-Trigger Autosave
| `SavedGamesStore.registerAutosaveOnClose` callback |
| --- |
| `UserSettingService.getSettingsOrDefault` |
| `SavedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.Autosave })` (each game) |

- Move threshold: `moveCommitted` runs after every committed live mainline move and every new analysis-branch move, so both live play and exploration count. It keeps a per-game count in a `WeakMap`; when the accepted `gameSession.autosaveAfterMoveCount` is positive and the count reaches it, it appends one save to a serial queue and returns without waiting. The live canonical game is serialised when the queued save runs. Zero disables the trigger. A success clears `autosaveError`; a failure sets it and calls each registered listener, and the queue stays settled for later saves.
- Close trigger: the callback reads the accepted `gameSession.autosaveOnClose` and saves every game in `GamesStore.listGames()` in order, including games whose tabs were closed. Accepted settings force `autosaveOnClose = true` while `restorePreviousSession = true`. Delivery differs by target as described in [App-Close Dispatch](#app-close-dispatch).
- Autosave targets `auto.json` in the game's folder and always overwrites. A failed write leaves the in-memory game unchanged.
- Requirement verification: `Pass (layer exception)`. Both triggers write through `SavedGamesStore.saveGame` and layer-2 services, and recent games are re-derived on the next query. The move-threshold trigger is a deliberate same-layer call from the `GamesStore` record composable into `SavedGamesStore`, resolved lazily inside the queued save so the stores are not initialised in a cycle; its rationale is recorded in [SDR-F02](../../ArchivedPlans/StoreDependencyFunctionFlows.md#sdr-f02-recording-and-autosave).

### SCN-SAVE-02 - Open Internal Save View

#### Flow A - Route From The Game Menu
| `GameView` `saveGameRequested` handler |
| --- |
| `GameView._run` |
| `GameView._handleMenuInterruptionRequested` |
| `router.push('/saved-games/save/' + gameId)` |

| `App` route checkpoint (`router.afterEach` callback) |
| --- |
| `UiStateStore.setActiveRoute` |
| `App._saveSession` |

#### Flow B - Route From The Game-Over Prompt
| `GameResultModal._save` |
| --- |
| `emit('dismissed')` |
| `router.push('/saved-games/save/' + gameId)` |

#### Flow C - Build The Library And Previews
| `SavedGamesView` `onMounted` |
| --- |
| `SavedGamesView._refreshGroups` |

| `SavedGamesView._refreshGroups` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SavedGamesStore.loadGame(gameId)` (each group) |
| `SavedGamesView._summariseGame` |
| `SavedGamesView._initialiseRoute` |
| `SavedGamesView._refreshSelection` |

| `SavedGamesStore.listSavedGames` |
| --- |
| `SavedGamesStore._getSaveRootPath` |
| `SavedGamesStore._listManagedSaveGroups` |

| `SavedGamesStore.loadGame` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SavedGamesStore._getTargetEntry` |
| `SavedGamesStore._readManagedGame` |

| `SavedGamesStore._getTargetEntry` |
| --- |
| `SavedGameIndexService.getLatestSaveEntry` (no save name) |

| `SavedGamesStore._readManagedGame` |
| --- |
| `SerializationService.readGameDocument` |

| `SavedGamesView._summariseGame` |
| --- |
| `SavedGamesView._genPreviewPosition` |

| `SavedGamesView._genPreviewPosition` |
| --- |
| `MoveHistoryService.getMoveSequence` |
| `MoveApplicationService.genPosition` |

#### Flow D - Show Snapshot Details
| `SavedGamesView._refreshSelection` |
| --- |
| `SavedGameIndexService.getLatestSaveEntry` (no current selection) |
| `SavedGamesView._loadDetails` |

| `SavedGamesView._selectSave` |
| --- |
| `SavedGamesView._loadDetails` |

| `SavedGamesView._loadDetails` |
| --- |
| `OperationOwner.run` |
| `SavedGamesStore.loadGame(gameId, saveName)` |

#### Flow E - Switch Library Mode In Place
| `SavedGamesView` route activation (`router.afterEach` callback) |
| --- |
| `SavedGamesView._closeConfirmation` |
| `SavedGamesView._initialiseRoute` |
| `SavedGamesView._refreshSelection` |

- Entry: the Save action in `MenuBar` routes to the displayed game's save page after the menu pause; the game-over prompt's Save for analysis action (`GameResultModal._save`) routes there directly, without a pause, because the game has already ended; the library's own Save navigation action routes to `/saved-games/save/:activeGameId` and is disabled without an active game. The three saved-game routes share the mounted `SavedGamesView`, so route changes between them run Flow E instead of remounting; the view removes that router hook on unmount.
- Previews: every group's latest snapshot is read once per refresh to show its name, ply count and board in the selected-game preview, and a group that cannot be read keeps a placeholder name. Snapshot details read the selected entry and render its board, players, clock and result. The preview projects the stored `renderedPath`, because saved documents carry no board runtime.
- Save surface: the saves list shows the automatic save first, then a "Named saves" separator. Selecting a named save copies its name into the field. The name field is prefilled from the active game's name with path characters replaced, and the footer offers Cancel and Save game. With no active game the page shows "No active game" and Save and Export are disabled.
- Pause: while the save route is open the interrupted game stays paused under `PauseReason.Menu`; returning to the game completes it as in [Game Menu Interruption](StartupAndNavigation.md#game-menu-interruption).
- Requirement verification: `Pass (layer exception)`. The save surface is route-level and browse-first, and `SavedGamesStore` owns listing and reads. Preview projection calls `MoveHistoryService` and `MoveApplicationService` directly from the view, and selection fallback calls `SavedGameIndexService.getLatestSaveEntry` directly; both are read-only presentation-to-domain calls with no store wrapper.

### SCN-SAVE-03 - Confirm Internal Save Write

#### Flow A - Write A New Named Save
| `SavedGamesView._saveGame` |
| --- |
| `SavedGamesView._run` |
| `SavedGamesView._writeSave(game, saveName, false)` |

| `SavedGamesView._writeSave` |
| --- |
| `SavedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.ManagedSave, saveName, overwrite })` |
| `SavedGamesView._refreshGroups` |
| `SavedGamesView._refreshSelection` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGamesStore._getSaveRootPath` |
| `SavedGamesStore._getTargetPath` |
| `SerializationService.writeGameDocument(path, game, overwrite)` |

| `SavedGamesStore._getTargetPath` |
| --- |
| `SavedGameIndexService.getNamedSaveFilePath` |

#### Flow B - Confirm Overwrite Of A Listed Save
| `SavedGamesView._saveGame` |
| --- |
| `SavedGamesView._run` |
| `SavedGamesView._requestOverwrite` |

| `SavedGamesView._requestOverwrite` |
| --- |
| `useModal().open(ConfirmationModal, { confirm: _confirmOverwrite, dismissibleWhileWorking: false })` |

| `ConfirmationModal._confirm` |
| --- |
| `useModalAction.run` |
| `SavedGamesView._confirmOverwrite` |

| `SavedGamesView._confirmOverwrite` |
| --- |
| `SavedGamesView._writeSave(game, saveName, true, signal)` |

#### Flow C - Storage Reports An Unlisted Collision
| `SavedGamesView._saveGame` |
| --- |
| `SavedGamesView._writeSave(game, saveName, false)` |
| `SavedGamesView._requestOverwrite` |

- Validation: `SavedGamesView.saveNameError` keeps Save disabled and shows inline feedback for a blank name, `auto`, path or control characters, a trailing dot and reserved device names; Enter in the field uses the same guard. `SavedGameIndexService` repeats the segment rule and the `auto` reservation as an ownership boundary. `_saveGame` also ignores requests while loading, working or while an overwrite confirmation is open.
- Collision: a name already in the listed group asks for confirmation before writing. A collision the list did not know about surfaces as `PlatformErrorKind.AlreadyExists` from the non-overwriting write and opens the same confirmation. Cancel writes nothing. An overwrite failure is shown inside the confirmation, which stays open for retry because `_confirmOverwrite` rethrows.
- Success refreshes the groups, selects the new save and shows "Saved “name”." on the save route.
- Requirement verification: `Pass`. The view resolves only a validated name; target-path rules and the write stay in `SavedGamesStore` and layer-2 services.

### SCN-LOAD-01 - Load Valid Game from Internal Save View

#### Flow A - Open The Grouped Library
| `GameView` `loadGameRequested` handler |
| --- |
| `GameView._run` |
| `GameView._handleMenuInterruptionRequested` |
| `router.push('/saved-games/load')` |

| `SavedGamesView` `onMounted` |
| --- |
| `SavedGamesView._refreshGroups` |

#### Flow B - Select A Game And Open Its Snapshots
| `SavedGamesView._openGroup` |
| --- |
| `router.push('/saved-games/load/' + gameId)` |

| `SavedGamesView` route activation (`router.afterEach` callback) |
| --- |
| `SavedGamesView._closeConfirmation` |
| `SavedGamesView._initialiseRoute` |
| `SavedGamesView._refreshSelection` |

#### Flow C - Load A Snapshot
| `SavedGamesView._loadGame(gameId, saveName?)` |
| --- |
| `SavedGamesView._run` |
| `SavedGamesStore.loadGame` |
| `GamesStore.insertGame` |
| `UiStateStore.openTab` |
| `router.push('/game/' + id)` |

| `GamesStore.insertGame` |
| --- |
| `GameWorkspaceComposable.insertGame` |

- Entry: the game menu pauses the displayed game before routing; Home's Load game card, Home's View all link and the recovery notice route to `/saved-games/load` directly. The grouped list initially selects the active game's group, otherwise the first group; single click selects and previews, double click loads that game's latest save, and Select game opens `/saved-games/load/:name`. On that route the footer offers Load selected, each row offers Load, and double-clicking a row loads it. A missing group shows "Saved game not found".
- Load: `SavedGamesStore.loadGame` resolves the named entry, or the latest entry when no name is given, reads it and writes the group folder name into `metadata.id`. `GamesStore.insertGame` then hydrates and inserts it, requests a due live turn and restarts analysis under `analysis.resumeLiveAnalysisAfterRestore`, exactly as in [SCN-SESSION-02](StartupAndNavigation.md#scn-session-02---restore-previous-session). `insertGame` resolves only after any restarted analysis seats have started (each seat's start failure is caught and shown on that seat), so the view routes to the game after engine startup. The game route checkpoint then saves the session. A read or insertion failure shows the error in the footer and keeps open workspaces unchanged.
- Duplicate identity: when the loaded group's id is already in the workspace, `GameWorkspaceComposable._repairDuplicateGameId` gives the loaded document a fresh id, so the existing workspace is not replaced and the loaded snapshot opens as a separate tab whose later saves go to a new folder.
- The previously displayed game stays paused under `PauseReason.Menu` until it is activated again.
- Requirement verification: `Pass`. Internal load stays separate from external import, `SavedGamesStore` performs the document read and `GamesStore.insertGame` performs insertion and hydration.

### SCN-EXPORT-01 - Export Game to External File

#### Flow
| `SavedGamesView._exportCurrent` |
| --- |
| `SavedGamesView._run` |
| `SavedGamesStore.exportGame` |

| `SavedGamesStore.exportGame` |
| --- |
| `SerializationService.selectExportFile(gameId + '.json')` |
| `SavedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.ExternalFile, filePath, overwrite: true })` |

| `SerializationService.selectExportFile` |
| --- |
| `IStorageAdapter.showSaveDialog` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGamesStore._getSaveRootPath` |
| `SavedGamesStore._getTargetPath` |
| `SerializationService.writeGameDocument(filePath, game, true)` |

- Entry: Export is a navigation action on the save route only, so it applies to the routed active game and inherits the menu pause taken when the save route opened; it adds no pause of its own.
- `PlatformErrorKind.Cancelled` from the picker returns `undefined` and writes nothing; other picker failures and write failures show in the footer. "Game exported." appears only after the write completes. The exported document is the same canonical payload as managed saves. On the browser target the picker returns a download token immediately and the write triggers the download, as described in [External File Pickers](#external-file-pickers).
- Requirement verification: `Pass`. External export stays distinct from managed saves, and destination selection and the write are owned by `SavedGamesStore` through layer-2 services.

### SCN-IMPORT-01 - Import Valid Game from External File

#### Flow
| `SavedGamesView._importGame` |
| --- |
| `SavedGamesView._run(action, true)` |
| `SavedGamesStore.importGame` |
| `GamesStore.insertGame` |
| `UiStateStore.openTab` |
| `router.push('/game/' + id)` |

| `SavedGamesStore.importGame` |
| --- |
| `SavedGamesStore._getSaveRootPath` |
| `SerializationService.selectImportFile(saveRootPath)` |
| `SerializationService.readGameDocument` |
| `crypto.randomUUID` |

| `SerializationService.selectImportFile` |
| --- |
| `IStorageAdapter.showOpenDialog` |

| `GamesStore.insertGame` |
| --- |
| `GameWorkspaceComposable.insertGame` |

- Entry: Import file is a navigation action in both library modes. A cancelled picker returns `undefined` and nothing changes.
- `SavedGamesStore` replaces the imported `metadata.id` with a fresh id before returning, so external metadata never becomes a managed folder name. Insertion, turn request and analysis restart follow `GamesStore.insertGame` as for internal load, including its wait for analysis-seat start before the route changes.
- Requirement verification: `Pass`. The picker, document read and identity replacement stay in `SavedGamesStore`; workspace insertion stays in `GamesStore`.

### SCN-IMPORT-02 - Reject Invalid External Game File

#### Flow
| `SavedGamesView._importGame` |
| --- |
| `SavedGamesView._run(action, true)` |
| `SavedGamesStore.importGame` |
| `useModal().open(MessageModal, { title: 'Could not import game', error: true })` |

| `SavedGamesStore.importGame` |
| --- |
| `SerializationService.selectImportFile` |
| `SerializationService.readGameDocument` |

- Malformed JSON, an unsupported `schemaVersion`, a schema failure or an unresolvable move-tree path rejects inside `SerializationService.deserialiseGame`; on the browser target invalid UTF-8 rejects in the picker. The import-specific `_run` branch shows the message in an acknowledge-only `MessageModal` instead of the footer. Nothing is inserted, opened or written.
- Requirement verification: `Pass`. Rejection happens inside the saved-game loading boundary before any workspace insertion.

## Settings And Engine Inventory

### SCN-SETTINGS-01 - Update Visual/UI Preferences

#### Flow A - Apply Settings
| `SettingsView._applySettings(false)` |
| --- |
| `SettingsStore.applySettings` |
| `emit('appearanceChanged')` |

| `SettingsStore.applySettings` |
| --- |
| `SettingsStore._saveDraftSettings` |

| `SettingsStore._saveDraftSettings` |
| --- |
| `SettingsStore.loadSettings` |
| `UserSettingService.saveSettings` |
| `SettingsStore._acceptSettings` |

| `UserSettingService.saveSettings` |
| --- |
| `settingsSnapshotSchema.parse` |
| `UserSettingService._coerceSettingsSnapshot` |
| `UserSettingService._writeSettingsDocument` |
| `UserSettingService._cacheAcceptedSettings` |

| `UserSettingService._writeSettingsDocument` |
| --- |
| `UserSettingService._serialiseSettings` |
| `IStorageAdapter.writeTextFile(BuildConfig.persistence.settingsPath)` (`overwrite: true`) |

| `App` `appearanceChanged` handler |
| --- |
| `App._applyAppearance` |

#### Flow B - Save Settings And Leave
| `SettingsView._applySettings(true)` |
| --- |
| `SettingsStore.saveSettings` |
| `emit('appearanceChanged')` |
| `router.push(returnRoute)` |

| `SettingsStore.saveSettings` |
| --- |
| `SettingsStore._saveDraftSettings` |

#### Flow C - Rejected Write
| `SettingsView._applySettings` |
| --- |
| `SettingsStore.applySettings` or `SettingsStore.saveSettings` |

- Draft editing: Settings controls bind with `v-model` directly to `SettingsStore.draftSettings`, which `_acceptSettings` cloned from the accepted snapshot; `SettingsStore.updateSettings` exists but no view calls it. `SettingsStore.hasPendingChanges` compares the draft with the accepted snapshot and enables Save and Apply changes and the Unsaved changes badge. The draft survives category switches because the store, not the view, owns it.
- Categories: Session holds restore, menu auto-pause, save folder, autosave interval and save-on-close (disabled while restore is on). Gameplay holds the quick-game defaults (name, random colours, both players, Use free analysis, clock, takebacks, live analysis moves, analysis profiles) and the analysis-branch exit behaviour. Appearance holds theme mode, board orientation, coordinates, last-move highlight and interface scale. Engines holds browser package management, resume-after-restore and engine profiles.
- Validation: the view blocks Apply and Save while `getGameCreationError` rejects the draft game defaults. `UserSettingService.saveSettings` validates the whole snapshot with `settingsSnapshotSchema`, applies the coercions (`autosaveOnClose` forced on with restore, trimmed default name), writes, and only then caches it; `SettingsStore` accepts the returned snapshot and re-clones the draft.
- Appearance: only a successful Apply, Save or Reset emits `appearanceChanged`, which `App` handles through its `RouterView`. Draft edits and failed writes emit nothing. `appearance.themeMode` chooses `ThemeMode.System`, `Light` or `Dark`; profiles are configuration, not settings, and CSS follows later host changes in system mode without rewriting settings.
- Rejected write: the error shows in the settings footer, the previous accepted settings remain in force and the draft stays editable for an explicit retry; Save does not leave.
- Requirement verification: `Pass`. Validation precedes persistence, acceptance follows only a successful write, and the appearance effect runs at an explicit event boundary.

### SCN-SETTINGS-02 - Reset Settings to Defaults

#### Flow
| `SettingsView._requestResetSettings` |
| --- |
| `useModal().open(ConfirmationModal, { danger: true, confirm: _resetSettings })` |

| `SettingsView._resetSettings` (confirm callback) |
| --- |
| `SettingsStore.resetSettings` |
| `emit('appearanceChanged')` |

| `SettingsStore.resetSettings` |
| --- |
| `SettingsStore.loadSettings` |
| `UserSettingService.resetSettings` |
| `SettingsStore._acceptSettings` |

| `UserSettingService.resetSettings` |
| --- |
| `UserSettingService._createDefaultSettingsSnapshot` |
| `UserSettingService._writeSettingsDocument` |
| `UserSettingService._cacheAcceptedSettings` |

- Reset is the danger footer action of the navigation frame and always confirms first. Cancel changes nothing. A write failure is shown inside the confirmation through `useModalAction` and leaves the accepted settings unchanged. Reset replaces the whole settings snapshot, including engine profiles and quick-game defaults, but does not touch stored engine packages, saves, the session or the layout.
- Requirement verification: `Pass`. The default schema is built, persisted and accepted through `UserSettingService`, then the appearance is reapplied.

### SCN-ENGINE-01 - Add Engine Configuration

#### Flow A - Open The Profile Route
| `SettingsView._openEngineEditor()` |
| --- |
| `router.push({ name: 'engine-profile-new', params: { category: 'engines' } })` |

| `EngineProfileView` `onMounted` |
| --- |
| `EngineProfileView._load` |

| `EngineProfileView._load` |
| --- |
| `SettingsStore.loadSettings` |
| `EngineProfileView._refreshPackages` |

| `EngineProfileView._refreshPackages` |
| --- |
| `EnginesStore.refreshPackages` |

#### Flow B - Choose A Desktop Executable Or Script
| `EngineProfileView._browseEngineFile` |
| --- |
| `EnginesStore.browseEngineFile(entryPath)` |

| `EnginesStore.browseEngineFile` |
| --- |
| `EnginePackageService.browseEngineFile` |

| `EnginePackageService.browseEngineFile` |
| --- |
| `IStorageAdapter.showOpenDialog` |

#### Flow C - Choose A Browser Package Entry
| `EngineProfileView` entry-script select |
| --- |
| `EnginesStore.listPackages` |
| `EnginesStore.getPackage` (`packagePath` query hint) |

| `EngineProfileView._useIncludedEngine` |
| --- |

#### Flow D - Stage The Profile In The Settings Draft
| `EngineProfileView._saveEngine` |
| --- |
| `EngineProfileView._engineOptions` |
| `SettingsStore.draftSettings.analysis.engineInventory` (push or replace) |
| `router.replace({ name: 'settings', params: { category: 'engines' } })` |

#### Flow E - Commit And Expose The Profile
| `SettingsView._applySettings` |
| --- |
| `SettingsStore.applySettings` or `SettingsStore.saveSettings` |

| `EnginesStore.listConfiguredEngines` |
| --- |
| `UserSettingService.getSettings` |

- Routes: the engine child routes render inside the mounted `SettingsView` through a `RouterView` keyed by `route.fullPath`, so changing profile or query replaces the form owner while the settings draft and dirty-leave guard stay with the parent; the Settings footer is hidden while a child route is shown. Package hints also open this route from `SettingsView._createPackageProfile`, `EnginePackageImportView._createProfile` and `EnginePackageDetailsView._createProfile` with a `packagePath` query. A direct URL initialises itself through `_load`. Route rationale: [EngineManagementUiDesign](../../ArchivedPlans/EngineManagementUiDesign.md#routes-and-view-ownership).
- Host difference: `EnginesStore.canInstallPackages` is true only on the browser target. There the interface defaults to `EngineClientType.UciWorker`, the desktop executable choice is disabled and the entry is chosen from stored package files. On NW.js the interface defaults to `EngineClientType.Uci` and Browse uses the native open dialog; cancelling it leaves the field unchanged. Whenever the interface is Browser UCI Worker, Use included Stockfish fills the bundled worker entry on either host.
- Staging: `_saveEngine` rejects an empty name or a name used by another draft profile, converts option values (`true` and `false` to booleans, non-empty finite numeric strings to numbers, everything else unchanged as text) and writes the record into the draft. Nothing is persisted, no engine starts and no availability check runs until Apply or Save. Cancel and Back leave the draft unchanged.
- Discovery: the editor uses a name/value option table. `EnginesStore.loadOptionMeta` and `refreshOptionMeta` provide cached option metadata through `EngineRuntimeService.getOptions` (see [EngineRuntimeOwnership](EngineRuntimeOwnership.md#option-metadata-discovery)), but no current view calls them.
- Verification: [JRN-SETTINGS-07/08/10](../../../journeys/definitions/settings/ScenarioReview.md#jrn-settings-07) cover staged saves, uniqueness, selector refresh, reload, typed values and UCI initialisation. Requirement verification: `Pass`. Profiles are staged in the settings draft, persisted through `SettingsStore` and exposed by `EnginesStore` from the accepted inventory.

### SCN-ENGINE-02 - Update or Remove Engine Configuration

#### Flow A - Edit A Profile
| `SettingsView._openEngineEditor(engine)` |
| --- |
| `router.push({ name: 'engine-profile-edit', params: { category: 'engines', profileId } })` |

| `EngineProfileView._load` |
| --- |
| `SettingsStore.loadSettings` |
| `EngineProfileView._refreshPackages` |

| `EngineProfileView._saveEngine` |
| --- |
| `EngineProfileView._engineOptions` |
| `SettingsStore.draftSettings.analysis.engineInventory` (replace by id) |
| `router.replace({ name: 'settings', params: { category: 'engines' } })` |

#### Flow B - Copy A Profile
| `SettingsView._copyEngine(engine)` |
| --- |
| `router.push({ name: 'engine-profile-copy', params: { category: 'engines', profileId } })` |

| `EngineProfileView._load` |
| --- |
| `SettingsStore.loadSettings` |
| `EngineProfileView._copyName` |
| `EngineProfileView._refreshPackages` |

#### Flow C - Remove A Profile
| `SettingsView._removeEngine(index)` |
| --- |
| `SettingsStore.draftSettings.analysis.engineInventory` (splice) |

#### Flow D - Leave The Editor Without Staging
| `EngineProfileView._back` |
| --- |
| `router.push({ name: 'settings', params: { category: 'engines' } })` |

- The editor copies the selected draft record into a local form. Copy gives it a fresh `crypto.randomUUID()` id and the first free "name copy", "name copy 2", … display name. A profile id missing from the draft shows "Profile not found". Every change, including removal, stays in the draft until Apply or Save from `SCN-SETTINGS-01`.
- Existing games, saved quick-game defaults and per-game analysis seats hold copied engine payloads, so editing, renaming or deleting a profile never changes them; profile removal does not search open games. Replacing an assignment is the explicit `PlayerSelectionModal` and `GamesStore.reassignPlayer` path in [SCN-ENGINE-03](GameplayAndControl.md#scn-engine-03---change-player-assignment-during-game).
- Verification: [JRN-SETTINGS-08/09](../../../journeys/definitions/settings/ScenarioReview.md#jrn-settings-09) cover editor cancellation, distinct copy identities, renamed and removed inventory choices, Keep existing and continued engine play. Requirement verification: `Pass`.

### Engine Package Management
These implemented flows have no scenario ID in [scenarios.md](../../HighLevel/scenarios.md). `EnginePackageService` stores imported package files in IndexedDB (`chessvue-engines`, store `files`) through the shared `WorkerScriptLoader` utility under the `engine-files/<name>` root, rather than through `IStorageAdapter`, so the stored bytes can later be loaded by the engine worker; see [stored-script loading options](../../ArchivedPlans/EngineInstallationReworkPlan.md#stored-script-loading-options). Import and removal exist only on the browser target; NW.js lists the bundled Stockfish folder alone.

#### Flow A - List Package Folders
| `SettingsView._loadEnginePackages` (`onMounted` or `onBeforeRouteUpdate` on the engines category, Refresh) |
| --- |
| `EnginesStore.refreshPackages` |

| `EnginesStore.refreshPackages` |
| --- |
| `EnginesStore._queuePackageWork` |
| `EnginesStore._readPackages` |

| `EnginesStore._readPackages` |
| --- |
| `EnginePackageService.listPackages` |

| `EnginePackageService.listPackages` |
| --- |
| `EnginePackageService.canInstall` |
| `WorkerScriptLoader.listRoots` |
| `WorkerScriptLoader.listFiles` (each root) |

#### Flow B - Read And Install An Archive
| `EnginePackageImportView` `onMounted` |
| --- |
| `EnginePackageImportView._refreshPackages` |

| `EnginePackageImportView._refreshPackages` |
| --- |
| `EnginesStore.refreshPackages` |

| `EnginePackageImportView._chooseArchive` |
| --- |
| `OperationOwner.run` |
| `File.arrayBuffer` |
| `EnginesStore.readArchive` |

| `EnginesStore.readArchive` |
| --- |
| `EnginePackageService.readArchive` |

| `EnginePackageService.readArchive` |
| --- |
| `EnginePackageService._decodeArchive` |
| `EnginePackageService._validatePackageFiles` |

| `EnginePackageImportView._install` |
| --- |
| `OperationOwner.run` |
| `EnginesStore.installPackage(engineName, archive, signal)` |

| `EnginesStore.installPackage` |
| --- |
| `EnginesStore._queuePackageWork` |
| `EnginePackageService.install` |
| `EnginePackageService.listPackages` |

| `EnginePackageService.install` |
| --- |
| `EnginePackageService.canInstall` |
| `EnginePackageService._validatePackageFiles` |
| `WorkerScriptLoader.writeFiles` |

#### Flow C - Leave The Import Route
| `EnginePackageImportView._settleFileAction` (`onBeforeRouteLeave`, `onBeforeRouteUpdate`) |
| --- |
| awaited install action, or `OperationOwner.cancel` |

#### Flow D - Show Package Details
| `SettingsView._openPackage(packagePath)` |
| --- |
| `router.push({ name: 'engine-package-details', params: { category: 'engines' }, query: { packagePath } })` |

| `EnginePackageDetailsView._load` (`onMounted`, Refresh folders) |
| --- |
| `SettingsStore.loadSettings` |
| `EnginesStore.refreshPackages` |

| `EnginePackageDetailsView._readReferences` |
| --- |
| `SettingsStore.settings` and `SettingsStore.draftSettings` (defaults and profiles) |
| `GamesStore.listGames` (players and analysis seats) |

#### Flow E - Remove Imported Package Files
| `EnginePackageDetailsView._removePackage` |
| --- |
| `useModal().open(ConfirmationModal, { dismissibleWhileWorking: false, confirm: _confirmRemovePackage })` |

| `EnginePackageDetailsView._confirmRemovePackage` |
| --- |
| `EnginesStore.removePackage(packagePath, _readReferences)` |
| `router.replace({ name: 'settings', params: { category: 'engines' } })` |

| `EnginesStore.removePackage` |
| --- |
| `EnginesStore._queuePackageWork` |
| `EnginePackageService.remove(packagePath, readReferences())` |
| `EnginePackageService.listPackages` |

| `EnginePackageService.remove` |
| --- |
| `EnginePackageService.canInstall` |
| `EnginePackageService._assertPackageUnreferenced` |
| `WorkerScriptLoader.removeFiles` |

- Ownership: `EnginesStore` serialises every package read, install and removal on one queue and shares an in-flight refresh, so a list never interleaves with a write. Install and removal refresh the list themselves; if that refresh fails after a committed write, the store reports a distinct `PlatformError` (`refreshEnginePackagesAfterInstall` or `refreshEnginePackagesAfterRemove`) so the view never reissues the write. The import view then keeps the saved path and offers Refresh folders before Create profile.
- Import gating: Install stays disabled until package discovery has succeeded, an archive has been decoded and the folder name is valid and unique against the loaded list. The archive is read under the view's `OperationOwner`; a new choice or route departure cancels the read, while a started install is awaited before navigation continues. Decoding rejects unsafe or duplicate paths and file/folder conflicts. The installed folder is a package only; profiles are created separately.
- References and removal: details list every accepted and draft quick-game default, accepted and draft profile, and every game in `GamesStore` (including closed tabs) whose worker entry lies under the package path. Only imported (`EngineInstallationSource.User`) packages offer Remove files. The queued removal reads references again when it starts and rejects with their names while any remain, so a draft-only change must be applied first; profiles and games are never retargeted automatically. Design and recovery rules: [EngineManagementUiDesign](../../ArchivedPlans/EngineManagementUiDesign.md#browser-details-removal-and-recovery).
- Verification: not scenario-owned. Layering follows view → `EnginesStore` → `EnginePackageService`; the IndexedDB boundary is the documented utility exception above.

### Panel Layout Persistence
These implemented flows support the independent UI-layout artefact in `SCN-SESSION-02` and have no separate scenario ID.

#### Flow A - Fold A Panel Section
| `HistoryPanel._toggleSection` or `AnalysisPanel._toggleSection` |
| --- |
| `UiStateStore.setSectionCollapsed` |
| `UiStateStore.saveLayoutState` |

| `UiStateStore.saveLayoutState` |
| --- |
| `UiStateStore.loadLayoutState` |
| `SerializationService.writeUiLayoutDocument(BuildConfig.persistence.layoutStatePath)` |

| `SerializationService.writeUiLayoutDocument` |
| --- |
| `SerializationService.serialiseUiLayoutState` |
| `IStorageAdapter.writeTextFile` (`overwrite: true`) |

#### Flow B - Fold Or Remove An Analysis Engine Section
| `AnalysisPanel._toggleEngine` |
| --- |
| `UiStateStore.setAnalysisEngineExpanded` |
| `UiStateStore.saveLayoutState` |

| `AnalysisPanel._remove` |
| --- |
| `GamesStore.removeAnalysisEngine` |
| `UiStateStore.setLayoutState` |
| `UiStateStore.saveLayoutState` |

- The changed in-memory layout stays in force when the write fails, and the owning panel shows the error inline.

## Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Managed Save Entry

#### Flow
| `SavedGamesView._requestDelete(entry)` |
| --- |
| `useModal().open(ConfirmationModal, { danger: true, confirm: _confirmDelete })` |

| `SavedGamesView._confirmDelete` |
| --- |
| `SavedGamesView._run` |
| `SavedGamesStore.deleteSave(gameId, saveName)` |
| `SavedGamesView._refreshGroups` |

| `SavedGamesStore.deleteSave` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SavedGamesStore._getTargetEntry` |
| `SerializationService.deleteDocument` |

| `SerializationService.deleteDocument` |
| --- |
| `IStorageAdapter.deleteFile` |

- Every snapshot row, including the automatic save, has a Delete save action on both the save and snapshot routes. A target that disappeared before deletion rejects in `_getTargetEntry` or the adapter; because `_run` reports the error in the footer, the confirmation still closes and the `finally` refresh runs, so the list matches storage without claiming deletion.
- Deleting a save never touches an open workspace in `GamesStore`.
- Requirement verification: `Pass`.

### SCN-LIFECYCLE-02 - Delete Selected Save and Switch Saved-Games Context

#### Flow A - Fall Back Within The Selected Game
| `SavedGamesView._confirmDelete` |
| --- |
| `SavedGamesStore.deleteSave` |
| `SavedGamesView._refreshGroups` |

| `SavedGamesView._refreshGroups` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SavedGamesView._initialiseRoute` |
| `SavedGamesView._refreshSelection` |

#### Flow B - Last Save Of The Routed Game Removed
| `SavedGamesView._confirmDelete` |
| --- |
| `SavedGamesStore.deleteSave` |
| `SavedGamesView._refreshGroups` |
| `router.replace('/saved-games/load')` |

| `App` route checkpoint (`router.afterEach` callback) |
| --- |
| `UiStateStore.setActiveRoute` |
| `App._saveSession` |

#### Flow C - Delete A Whole Saved Game
| `SavedGamesView._requestDeleteGame(gameId)` |
| --- |
| `useModal().open(ConfirmationModal, { danger: true, confirm: _confirmDeleteGame })` |

| `SavedGamesView._confirmDeleteGame` |
| --- |
| `SavedGamesView._run` |
| `SavedGamesStore.deleteGame` |
| `SavedGamesView._refreshGroups` |

| `SavedGamesStore.deleteGame` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SerializationService.deleteDocument` (each save) |

- Fallback: `_refreshSelection` keeps the selected save when it still exists, otherwise selects the group's latest save. When the routed group has no saves left on `/saved-games/load/:name`, the view replaces the route with the grouped list, and the session checkpoint records it; the save route stays on the active game's empty save list. Deleting the selected whole game clears the grouped selection so `_initialiseRoute` picks the active game's group or the first remaining group.
- Whole-game deletion is the grouped list's Delete game footer action (Flow C, implemented without its own scenario ID). It removes every snapshot in the game folder; games open in the workspace stay open.
- Requirement verification: `Pass`. No saved-games route or selection is left pointing at a missing save, and route repair goes through the router and the shared session checkpoint rather than a direct store call from the view.
