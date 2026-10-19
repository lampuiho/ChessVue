# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`.

## Persistence And File I/O

Storage failures preserve usable in-memory work. `App.saveSession` handles startup/navigation session-write rejection with a recoverable notice; a later successful navigation clears it. Router `afterEach` checkpoints each successful committed path change once; duplicate/query-only navigation is ignored. Layout writes retain the current in-memory folds and use GameView's existing action feedback. Settings accepts/caches a draft only after its write succeeds. SavedGamesView shows overwrite failures inside the confirmation, and refreshes deletion selection/routes in a finally path even if the target vanished or deletion was denied. Selection and refresh actions explicitly start details delivery through `OperationOwner`; replacement/unmount cancels it, including when the same snapshot is selected again. Late read success and failure remain handled without changing current details. The journey-only storage barrier verifies these boundaries without replacing the production browser file adapter.

### SCN-SAVE-01 - Autosave Internal Save Entry

Case 1: autosave after `n` moves. `GamesStore` counts new committed live moves per hydrated workspace. A positive configured interval queues `SavedGamesStore.saveGame(...)` with `targetKind: SaveGameTargetKind.Autosave` at each threshold; zero disables this trigger. The store retains `autosaveError` and emits failure through `onAutosaveFailed`; GameView's mounted consumer presents feedback and unsubscribes on unmount.

#### Flow A - Check Move-Threshold Autosave
| `GameMoveComposable._applyLiveMove` |
| --- |
| `GamesStore.moveCommitted` |

| `GamesStore.moveCommitted` |
| --- |
| `UserSettingService.getSettings` |
| `SavedGamesStore.saveGame` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

Case 2: autosave after quitting. Presentation registers a callback through `SavedGamesStore`; when close-trigger autosave is enabled, it calls `saveGame(...)` with `targetKind: SaveGameTargetKind.Autosave`. Browser lifecycle checkpoints remain best effort because tab shutdown cannot await asynchronous callbacks.

#### Flow B - Register Close Autosave Callback
| `App.onMounted` callback |
| --- |
| `SavedGamesStore.registerAutosaveOnClose` |

| `SavedGamesStore.registerAutosaveOnClose` |
| --- |
| `PlatformEventService.subscribeToAppCloseRequested` |

#### Flow C - Check Close Autosave
| `SavedGamesStore.registerAutosaveOnClose` callback |
| --- |
| `UserSettingService.getSettings` |
| `SavedGamesStore.saveGame` |

#### Flow D - Autosave Game
| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- Settings coverage: `gameSession.autosaveAfterMoveCount` gates move-threshold autosave, while `gameSession.autosaveOnClose` gates close-trigger autosave. Accepted settings coerce `gameSession.autosaveOnClose = true` whenever `gameSession.restorePreviousSession = true`, so reopenable prior-session tabs always have close-trigger autosave available. Presentation decides when close-trigger registration is active. `SavedGamesStore.saveGame(..., { targetKind: SaveGameTargetKind.Autosave })` is the write owner for both trigger kinds.
- Requirement verification: `Pass`. Autosave writes the dedicated internal save entry beneath the configured save root, leaves recent-game projection to later on-demand queries, and leaves in-memory game state intact when a write fails.

### SCN-SAVE-02 - Open Internal Save View

#### Flow
| MenuBar.saveGameRequested |
| --- |
| GamesStore.pauseGame |
| Router.push |
| UiStateStore.setActiveRoute |
| SavedGamesStore.listSavedGames |

| GamesStore.pauseGame |
| --- |
| GameClockComposable.pauseGame |
| GameClockComposable.pauseGame |

| UiStateStore.setActiveRoute |
| --- |
| UiStateStore._rememberReturnRoute |

| SavedGamesStore.listSavedGames |
| --- |
| `getSaveRootPath` |
| SerializationService.listManagedSaveEntries |
| SavedGameIndexService.projectSaveGroups |

- Route coverage: save routes through /saved-games/save/:name, opens directly into the selected game's save surface, and does not use the shared dialog family.
- Settings coverage: gameSession.autoPauseOnMenu decides whether a timed live game is paused before routing into the save view, and the remembered pause owner is what later allows safe auto-resume. While the save route is open, that paused game remains interaction-locked and any player-engine move that becomes ready stays deferred until return.
- Requirement verification: `Pass`. The save flow is route-level and browse-first until the user confirms a save name, `SavedGamesStore` owns both the grouped save-browser data and the eventual save write, and `GamesStore` is not involved because the active `IGame` payload is already in hand.

### SCN-SAVE-03 - Confirm Internal Save Write

#### Flow
| SavedGamesView save-name validation |
| --- |
| Keep Save disabled and show inline feedback until the value is an accepted single file-name segment |

| SavedGamesView.saveRequested |
| --- |
| UiStateStore.showModal |
| SavedGamesStore.saveGame |
| SavedGamesStore.listSavedGames |

| UiStateStore.showModal |
| --- |

| SavedGamesStore.saveGame |
| --- |
| SavedGameIndexService.getNamedSaveFilePath |
| SerializationService.writeGameDocument |

- UI surface coverage: overwrite confirmation uses the shared dialog shell, while the save-name field and Cancel or Save game action row remain route-owned by SavedGamesView. The view blocks blank, reserved, path-like, device, trailing-dot and control-character names before calling `SavedGamesStore.saveGame`; lower layers consume the accepted name without repeating form validation.
- Requirement verification: `Pass`. Internal named-save writes stay inside `SavedGamesStore` once the save route has resolved the validated target name, overwrite confirmation is explicit, and later recent-list queries can observe the new save without any same-layer store call.

### SCN-LOAD-01 - Load Valid Game from Internal Save View

#### Flow A - Open The Route-Level Load Surface
| MenuBar.loadGameRequested |
| --- |
| GamesStore.pauseGame |
| Router.push |
| UiStateStore.setActiveRoute |
| SavedGamesStore.listSavedGames |

| GamesStore.pauseGame |
| --- |
| GameClockComposable.pauseGame |
| GameClockComposable.pauseGame |

| UiStateStore.setActiveRoute |
| --- |
| UiStateStore._rememberReturnRoute |

| SavedGamesStore.listSavedGames |
| --- |
| `getSaveRootPath` |
| SerializationService.listManagedSaveEntries |
| SavedGameIndexService.projectSaveGroups |

#### Flow B - Load The Selected Internal Save
| SavedGamesView.loadRequested |
| --- |
| SavedGamesStore.loadGame |
| GamesStore.insertGame |
| UiStateStore.openTab |
| UiStateStore.setActiveGame |
| UiStateStore.saveGameSession |

| SavedGamesStore.loadGame |
| --- |
| `getTargetEntry` |
| SavedGameIndexService.getLatestSaveEntryForGame |
| SerializationService.readGameDocument |

| GamesStore.insertGame |
| --- |
| GameWorkspaceComposable.repairDuplicateGameId |
| GameWorkspaceComposable.hydrateAndInsertGame |

| UiStateStore.openTab |
| --- |
| UiStateStore._coerceOpenTabs |

| UiStateStore.setActiveGame |
| --- |
| UiStateStore._coerceActiveRoute |

| UiStateStore.saveGameSession |
| --- |
| SerializationService.writeGameSessionDocument |

#### Flow C - Resume Analysis For The Loaded Workspace
| `SavedGamesView.onLoadRequested` |
| --- |
| GamesStore.refreshAnalysis |

| GamesStore.refreshAnalysis |
| --- |
| GameAnalysisComposable.refreshAnalysisForGame |
| GameAnalysisComposable.startAnalysisSeat |
| GameAnalysisComposable.subscribeToAnalysis |

| GameAnalysisComposable.startAnalysisSeat |
| --- |
| EngineRuntimeService.ensureReady |
| EngineRuntimeService.startAnalysis |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GameAnalysisComposable.subscribeToAnalysis callback` |

#### Flow D - Request An Engine Turn For The Loaded Workspace
| GamePlayerTurnComposable.requestPlayerMoveIfNeeded |
| --- |
| GamePlayerTurnComposable.requestPlayerMove |
| GamePlayerTurnComposable.playerMoveHandler |

| GamePlayerTurnComposable.requestPlayerMoveIfNeeded |
| --- |
| GamePlayerTurnComposable.requestPlayerMove |
| GamePlayerTurnComposable.playerMoveHandler |

| GamePlayerTurnComposable.requestEngineMove |
| --- |
| EngineRuntimeService.ensureReady |
| EngineRuntimeService.startPlayerTurn |
| EngineRuntimeService.awaitPlayerTurnMove |

| GamePlayerTurnComposable.playerMoveHandler |
| --- |
| GameMoveComposable.commitLiveMove |

- Route coverage: /saved-games/load shows grouped games, double-click latest-save loading, and Select, while /saved-games/load/:name switches the bottom-right action to Load for the selected game's save list.
- State/settings coverage: the restored workspace is shown before analysis resumes, `analysis.resumeLiveAnalysisAfterRestore` still gates continuous analysis restart, and `gameSession.autoPauseOnMenu` controls the route-entry pause branch only. Any already validated player-engine move that became ready on the previously active paused game during the load flow remains deferred until that game's paired resume path confirms that the live turn is ready; the return path does not repeat legality or pondering because the pause did not change that game's live position.
- Session-restore note: startup restore reuses the same saved-document load plus `GamesStore.insertGame(...)` hydration path but targets only the latest available managed save entry for each `gameId` recorded in the persisted session snapshot.
- Requirement verification: `Pass`. Internal load stays distinct from external import, `SavedGamesStore` performs the actual saved-document load, `GamesStore.insertGame(...)` performs runtime insertion and hydration, and home-screen recents remain query-derived instead of being updated through same-layer store calls.

### SCN-EXPORT-01 - Export Game to External File

#### Flow
| MenuBar.exportGameRequested |
| --- |
| GamesStore.pauseGame |
| SavedGamesStore.exportGame |
| GamesStore.resumeGame |

| GamesStore.pauseGame |
| --- |
| GameClockComposable.pauseGame |
| GameClockComposable.pauseGame |

| SavedGamesStore.exportGame |
| --- |
| `SavedGamesStore.exportGame` |
| SerializationService.selectExportFile |
| SerializationService.writeGameDocument |

| GamesStore.resumeGame |
| --- |
| GameClockComposable.resumeGame |
| GameClockComposable.resumeGame |
| GameView._resumeIfMenuOwnedPause |

- Picker cancellation returns no path and writes nothing; the view shows success only after a completed write. Other picker failures remain errors.
- Settings coverage: gameSession.autoPauseOnMenu controls whether export pauses a timed live game before the external file dialog opens. While paused for export, the game surface is interaction-locked and any player-engine move that becomes ready remains deferred until return.
- Requirement verification: `Pass`. External export stays distinct from internal save slots, `SavedGamesStore` owns both destination selection and canonical saved-game payload write, and the flow returns through the menu-owned pause path without mutating game state beyond the export side effect.

### SCN-IMPORT-01 - Import Valid Game from External File

#### Flow A - Import And Load The Workspace
| MenuBar.importGameRequested |
| --- |
| SavedGamesStore.importGame |
| GamesStore.insertGame |
| UiStateStore.openTab |
| UiStateStore.setActiveGame |
| UiStateStore.saveGameSession |

| SavedGamesStore.importGame |
| --- |
| SerializationService.selectImportFile |
| SerializationService.readGameDocument |
| Assign fresh app-generated game ID |

| GamesStore.insertGame |
| --- |
| GameWorkspaceComposable.repairDuplicateGameId |
| GameWorkspaceComposable.hydrateAndInsertGame |

| UiStateStore.openTab |
| --- |
| UiStateStore._coerceOpenTabs |

| UiStateStore.setActiveGame |
| --- |
| UiStateStore._coerceActiveRoute |

| UiStateStore.saveGameSession |
| --- |
| SerializationService.writeGameSessionDocument |

#### Flow B - Resume Analysis For The Imported Workspace
| `MenuBar.importGameRequested` |
| --- |
| GamesStore.refreshAnalysis |

| GamesStore.refreshAnalysis |
| --- |
| GameAnalysisComposable.refreshAnalysisForGame |
| GameAnalysisComposable.startAnalysisSeat |
| GameAnalysisComposable.subscribeToAnalysis |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GameAnalysisComposable.subscribeToAnalysis callback` |

#### Flow C - Request An Engine Turn For The Imported Workspace
| GamePlayerTurnComposable.requestPlayerMoveIfNeeded |
| --- |
| GamePlayerTurnComposable.requestPlayerMove |
| GamePlayerTurnComposable.playerMoveHandler |

| GamePlayerTurnComposable.requestEngineMove |
| --- |
| EngineRuntimeService.ensureReady |
| EngineRuntimeService.startPlayerTurn |
| EngineRuntimeService.awaitPlayerTurnMove |

- Requirement verification: `Pass`. External import stays separate from internal save browsing, `SavedGamesStore` owns picker selection, saved-document read, and replacement of the external metadata ID before returning the payload; `GamesStore.insertGame(...)` then performs ordinary insertion-time collision repair, and the restored game state is visible before analysis or engine-turn restart begins.

### SCN-IMPORT-02 - Reject Invalid External Game File

#### Flow
| MenuBar.importGameRequested |
| --- |
| SavedGamesStore.importGame |
| UiStateStore.showModal |

| SavedGamesStore.importGame |
| --- |
| SerializationService.selectImportFile |
| SerializationService.readGameDocument |

| UiStateStore.showModal |
| --- |

- UI surface coverage: invalid external import uses the shared dialog shell as the acknowledge-only importError path.
- Requirement verification: `Pass`. Failed import does not mutate the current session state, and unsupported, corrupt, or incomplete documents stay isolated inside the saved-game loading boundary before any active-workspace insertion occurs.

## Settings And Engine Inventory

### SCN-SETTINGS-01 - Update Visual/UI Preferences

#### Flow A - Apply Accepted Settings
| `SettingsView.applyRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.applySettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._mergeDraftPatch` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.applySettings` |
| --- |
| `UserSettingService.saveSettings` |
| `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._syncDraftToAccepted` |
| `SettingsStore._resolveThemeMode` |
| `UserSettingService.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |

| `UserSettingService.saveSettings` |
| --- |
| `SerializationService.serialiseSettings` |
| `SerializationService.deserialiseSettings` |
| `SerializationService.writeSettingsDocument` |
| `UserSettingService._cacheAcceptedSettings` |

#### Flow B - Save Accepted Settings
| `SettingsView.saveRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.saveSettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._mergeDraftPatch` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.saveSettings` |
| --- |
| `UserSettingService.saveSettings` |
| `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._syncDraftToAccepted` |
| `SettingsStore._resolveThemeMode` |
| `UserSettingService.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |

- UI surface coverage: category tabs switch the active settings section, `Cancel`, `Save`, and `Apply` stay in the primary bottom-right row, and the secondary reset action area remains outside that primary commit row.
- Route coverage: settings categories are routed through `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`, with `/settings` redirecting to `/settings/session`.
- Settings coverage: `appearance.themeMode` is the only app-chrome theme setting in the baseline. `ThemeMode.System` lets CSS follow the system colour scheme, while `ThemeMode.Light` and `ThemeMode.Dark` force the corresponding configured profile snapshot; profiles themselves are not persisted settings.
- Requirement verification: `Pass`. Validation happens before apply or persistence, only committed user-setting fields are writable through `SettingsStore`, engine-profile edits are staged in `SettingsStore` and accepted profiles are exposed by `EnginesStore`, and accepted appearance changes refresh both shared app-theme variable banks immediately.

### SCN-SETTINGS-02 - Reset Settings to Defaults

#### Flow
| `SettingsView.resetRequested` |
| --- |
| `UiStateStore.showModal` |
| `SettingsStore.resetSettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |
| `UiStateStore.hideModal` |

| `UiStateStore.showModal` |
| --- |

| `SettingsStore.resetSettings` |
| --- |
| `UserSettingService.resetSettings` |
| `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._syncDraftToAccepted` |
| `SettingsStore._resolveThemeMode` |
| `UserSettingService.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |

| `UserSettingService.resetSettings` |
| --- |
| `UserSettingService._createDefaultSettingsSnapshot` |
| `SerializationService.writeSettingsDocument` |
| `UserSettingService._cacheAcceptedSettings` |

| `UiStateStore.hideModal` |
| --- |

- UI surface coverage: reset is triggered from the secondary settings action area and always routes through the shared confirmation dialog before the default snapshot is applied.
- Requirement verification: `Pass`. Reset restores the authoritative default schema, reprojects the default appearance state, and persists it atomically.

### SCN-ENGINE-01 - Add Engine Configuration

#### Current flow
| Step | Owner |
| --- | --- |
| Open the profile editor and edit name/path/options | `SettingsView.openEngineEditor`, `addOption` |
| Validate the name and convert supported option values | `SettingsView.saveEngine` |
| Stage the record without writing settings | `SettingsStore.draftSettings.analysis.engineInventory` |
| Apply or Save Settings; validate and persist the entire draft | `SettingsStore.applySettings` / `saveSettings`, `UserSettingService.saveSettings` |
| Expose accepted profiles in future selectors | `EnginesStore.listConfiguredEngines` |

The current UI uses a name/value table, without option discovery controls. `EnginesStore.loadOptionMeta` / `refreshOptionMeta` separately initialise a temporary engine, read metadata, stop it in `finally` and cache metadata by profile identity/transport. Discovery does not merge engine defaults into configured values. The profile editor converts true/false to booleans and non-empty finite numeric strings to numbers; text and empty strings remain strings.

Verification: [JRN-SETTINGS-07/08/10](../../../journeys/definitions/settings/ScenarioReview.md#jrn-settings-07) cover staged profile saves, uniqueness, selector refresh, reload, typed values and UCI initialisation. The former EnginesStore-owned editor/save flow described a planned boundary rather than the current implementation.

### SCN-ENGINE-02 - Update or Remove Engine Configuration

| Step | Owner |
| --- | --- |
| Copy with a fresh ID and unique suggested name | `SettingsView.copyEngine` |
| Edit a detached form; Cancel leaves the draft record intact | `SettingsView.openEngineEditor` / `saveEngine` |
| Remove a reusable profile from the draft | `SettingsView.removeEngine` |
| Commit the settings draft for future assignments | `SettingsStore.applySettings` / `saveSettings` |
| Keep existing copied in-game configuration until explicitly replaced | `ModalHost.confirmPlayerSelection`, `GamesStore.reassignPlayer` |

Verification: [JRN-SETTINGS-08/09](../../../journeys/definitions/settings/ScenarioReview.md#jrn-settings-09) cover editor cancellation, distinct copy identities, renamed/removed inventory choices, Keep existing, continued engine play and restoration. Profile removal never searches open games to replace their player payloads.

## Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Managed Save Entry

#### Flow
| `SavedGamesView.deleteRequested` |
| --- |
| `UiStateStore.showModal` |
| `SavedGamesStore.deleteSave` |
| `SavedGamesStore.listSavedGames` |

| `UiStateStore.showModal` |
| --- |

| `SavedGamesStore.deleteSave` |
| --- |
| `getTargetEntry` |
| `SerializationService.deleteDocument` |

| `SavedGamesStore.listSavedGames` |
| --- |
| `getSaveRootPath` |
| `SerializationService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |

- Requirement verification: `Pass`. Deletion of a managed save target stays inside the saved-games ownership boundary, refreshes the grouped save view, and does not require `GamesStore` to mutate the current in-memory workspace collection.

### SCN-LIFECYCLE-02 - Delete Selected Save and Recoerce Saved-Games Context

#### Flow
| `SavedGamesView.deleteRequestedForSelectedGame` |
| --- |
| `UiStateStore.showModal` |
| `SavedGamesStore.deleteSave` |
| `SavedGamesStore.listSavedGames` |
| `UiStateStore.setActiveRoute` |
| `Router._selectSavedGamesFallback` |

| `UiStateStore.showModal` |
| --- |

| `SavedGamesStore.deleteSave` |
| --- |
| `getTargetEntry` |
| `SerializationService.deleteDocument` |

| `SavedGamesStore.listSavedGames` |
| --- |
| `getSaveRootPath` |
| `SerializationService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |

| `UiStateStore.setActiveRoute` |
| --- |
| `UiStateStore._coerceActiveRoute` |

- Requirement verification: `Pass`. Deleting the selected managed save cannot leave the saved-games route pointing at missing selection state, and the fallback stays inside the saved-games surface instead of forcing `GamesStore` to remove an open workspace.









