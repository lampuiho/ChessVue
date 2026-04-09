# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`.

## Persistence And File I/O

### SCN-SAVE-01 - Autosave Internal Save Entry

Case 1: autosave after `n` moves. Called at the end of `GamesStore.makeMove`; when committed move count since the last autosave reaches the configured threshold, the store calls `saveGame` with reserved name `"auto"` and `autoSave = true`.

#### Flow A - Check Move-Threshold Autosave
| `GamesStore.makeMove` |
| --- |
| `GamesStore._saveGameIfNMoveSinceLastAutoSave` |

| `GamesStore._saveGameIfNMoveSinceLastAutoSave` |
| --- |
| `GamesStore._getNoOfMoveSinceLastAutoSave` |
| `GamesStore._saveAutoSave` |

Case 2: autosave after quitting. When a runnable game session starts, it registers an app-close callback through `PlatformEventService`; when close-trigger autosave is enabled, that callback calls `saveGame` with reserved name `"auto"` and `autoSave = true` before shutdown completes.

#### Flow B - Register Close Autosave Callback
| `GamesStore._registerRunnableSessionSubscriptions` |
| --- |
| `PlatformEventService.subscribeToAppCloseRequested` |

#### Flow C - Check Close Autosave
| `GamesStore._handleAppCloseRequested` |
| --- |
| `GamesStore._saveGameOnCloseIfEnabled` |

| `GamesStore._saveGameOnCloseIfEnabled` |
| --- |
| `UserSettingService.getSettings` |
| `GamesStore._assertGameExists` |
| `GamesStore._saveAutoSave` |

#### Flow D - Autosave Game
| `GamesStore._saveAutoSave` |
| --- |
| `GamesStore.saveGame("auto", { autosave: true })` |

| `GamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.serialiseGame` |
| `SavedGameDocumentService.writeDocument` |

| `SerializationService.serialiseGame` |
| --- |
| `SerializationService._normalisePayload` |

- Settings coverage: `session.autosaveAfterMoveCount` gates move-threshold autosave, while `session.autosaveOnClose` separately gates close-trigger autosave. Runnable session ownership decides when the app-close callback is registered or disposed. `GamesStore.saveGame(..., { autosave: true })` is the only workspace-save owner for both trigger kinds.
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
| GamesStore._maybeAutoPauseForMenu |
| GamesStore._markPauseOwner |

| UiStateStore.setActiveRoute |
| --- |
| UiStateStore._rememberReturnRoute |

| SavedGamesStore.listSavedGames |
| --- |
| SavedGamesStore._resolveSaveRoot |
| SavedGameDocumentService.listManagedSaveEntries |
| SavedGameIndexService.projectSaveGroups |

- Route coverage: save routes through /saved-games/save/:name, opens directly into the selected game's save surface, and does not use the shared dialog family.
- Settings coverage: session.autoPauseOnMenu decides whether a timed live game is paused before routing into the save view, and the remembered pause owner is what later allows safe auto-resume.
- Requirement verification: `Pass`. The save flow is route-level and browse-first until the user confirms a save name, `SavedGamesStore` owns the grouped save-browser data, and `GamesStore` does not take over until the save target has been chosen.

### SCN-SAVE-03 - Confirm Internal Save Write

#### Flow
| SavedGamesView.saveRequested |
| --- |
| UiStateStore.showModal |
| GamesStore.saveGame |
| SavedGamesStore.listSavedGames |

| UiStateStore.showModal |
| --- |

| GamesStore.saveGame |
| --- |
| GamesStore._validateSaveName |
| GamesStore._buildPersistedWorkspace |
| SavedGameIndexService.getNamedSaveFilePath |
| SerializationService.serialiseGame |
| SavedGameDocumentService.writeDocument |

| SerializationService.serialiseGame |
| --- |
| SerializationService._normalisePayload |

- UI surface coverage: overwrite confirmation uses the shared dialog shell, while the save-name field and Cancel or Save action row remain route-owned by SavedGamesView.
- Requirement verification: `Pass`. Internal named-save writes stay inside `GamesStore` once the save route has resolved the target name, overwrite confirmation is explicit, and later recent-list queries can observe the new save without any same-layer store call.

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
| GamesStore._maybeAutoPauseForMenu |
| GamesStore._markPauseOwner |

| UiStateStore.setActiveRoute |
| --- |
| UiStateStore._rememberReturnRoute |

| SavedGamesStore.listSavedGames |
| --- |
| SavedGamesStore._resolveSaveRoot |
| SavedGameDocumentService.listManagedSaveEntries |
| SavedGameIndexService.projectSaveGroups |

#### Flow B - Load The Selected Internal Save
| SavedGamesView.loadRequested |
| --- |
| SavedGamesStore.getLoadFilePath |
| GamesStore.loadGame |
| UiStateStore.openTab |
| UiStateStore.setActiveGame |
| UiStateStore.saveGameSession |

| SavedGamesStore.getLoadFilePath |
| --- |
| SavedGamesStore._resolveSelectedSaveEntry |
| SavedGameIndexService.getAutosaveFilePath |
| SavedGameIndexService.getNamedSaveFilePath |

| GamesStore.loadGame |
| --- |
| SavedGameDocumentService.readDocument |
| SerializationService.deserialiseGame |
| GamesStore._remapDuplicateIdIfNeeded |
| GamesStore._hydrateWorkspace |

| UiStateStore.openTab |
| --- |
| UiStateStore._coerceOpenTabs |

| UiStateStore.setActiveGame |
| --- |
| UiStateStore._coerceActiveRoute |

| UiStateStore.saveGameSession |
| --- |
| SessionStateService.saveGameSession |

#### Flow C - Resume Analysis For The Loaded Workspace
| `SavedGamesView.onLoadRequested` |
| --- |
| GamesStore.refreshAnalysis |

| GamesStore.refreshAnalysis |
| --- |
| EnginesStore._startAnalysisSessions |
| EnginesStore._bindAnalysisCallbacks |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

#### Flow D - Request An Engine Turn For The Loaded Workspace
| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| GamesStore.getGame |
| GamesStore.requestPlayerMove |
| EnginesStore._handlePlayerTurnMove |

| GamesStore.requestPlayerMove |
| --- |
| EnginesStore._startPlayerTurnSearch |
| EnginesStore._bindPlayerTurnCallbacks |

| EnginesStore._handlePlayerTurnMove |
| --- |
| GamesStore.makeMove |

| GamesStore.makeMove |
| --- |
| GamesStore._assertMoveAllowed |
| GamesStore._resolveMoveContext |
| GamesStore._applyMoveByContext |
| GamesStore._persistWorkspaceIfNeeded |
| GameView._requestPlayerMoveIfNeeded |

- Route coverage: /saved-games/load shows grouped games, double-click latest-save loading, and Select, while /saved-games/load/:name switches the bottom-right action to Load for the selected game's save list.
- State/settings coverage: the restored workspace is shown before analysis resumes, `analysis.resumeLiveAnalysisAfterRestore` still gates continuous analysis restart, and `session.autoPauseOnMenu` controls the route-entry pause branch only.
- Requirement verification: `Pass`. Internal load stays distinct from external import, `SavedGamesStore` resolves the selected file path, `GamesStore` performs the actual load, and home-screen recents remain query-derived instead of being updated through same-layer store calls.

### SCN-EXPORT-01 - Export Game to External File

#### Flow
| MenuBar.exportGameRequested |
| --- |
| GamesStore.pauseGame |
| SavedGamesStore.exportGame |
| GamesStore.saveGame |
| GamesStore.resumeGame |

| GamesStore.pauseGame |
| --- |
| GamesStore._maybeAutoPauseForMenu |
| GamesStore._markPauseOwner |

| SavedGamesStore.exportGame |
| --- |
| SavedGamesStore._buildDefaultExportName |
| SavedGameDocumentService.selectExportFile |

| GamesStore.saveGame |
| --- |
| GamesStore._buildPersistedWorkspace |
| SerializationService.serialiseGame |
| SavedGameDocumentService.writeDocument |

| SerializationService.serialiseGame |
| --- |
| SerializationService._normalisePayload |

| GamesStore.resumeGame |
| --- |
| GamesStore._assertResumable |
| GamesStore._resumeClock |
| GameView._resumeIfMenuOwnedPause |

- Settings coverage: session.autoPauseOnMenu controls whether export pauses a timed live game before the external file dialog opens.
- Requirement verification: `Pass`. External export stays distinct from internal save slots, `SavedGamesStore` owns destination selection, `GamesStore` writes the canonical saved-game payload once, and the flow returns through the menu-owned pause path without mutating game state beyond the export side effect.

### SCN-IMPORT-01 - Import Valid Game from External File

#### Flow A - Import And Load The Workspace
| MenuBar.importGameRequested |
| --- |
| SavedGamesStore.importGame |
| GamesStore.loadGame |
| UiStateStore.openTab |
| UiStateStore.setActiveGame |
| UiStateStore.saveGameSession |

| SavedGamesStore.importGame |
| --- |
| SavedGameDocumentService.selectImportFile |

| GamesStore.loadGame |
| --- |
| SavedGameDocumentService.readDocument |
| SerializationService.deserialiseGame |
| GamesStore._remapDuplicateIdIfNeeded |
| GamesStore._hydrateWorkspace |

| UiStateStore.openTab |
| --- |
| UiStateStore._coerceOpenTabs |

| UiStateStore.setActiveGame |
| --- |
| UiStateStore._coerceActiveRoute |

| UiStateStore.saveGameSession |
| --- |
| SessionStateService.saveGameSession |

#### Flow B - Resume Analysis For The Imported Workspace
| `MenuBar.importGameRequested` |
| --- |
| GamesStore.refreshAnalysis |

| GamesStore.refreshAnalysis |
| --- |
| EnginesStore._startAnalysisSessions |
| EnginesStore._bindAnalysisCallbacks |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

#### Flow C - Request An Engine Turn For The Imported Workspace
| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| GamesStore.getGame |
| GamesStore.requestPlayerMove |
| EnginesStore._handlePlayerTurnMove |

| GamesStore.requestPlayerMove |
| --- |
| EnginesStore._startPlayerTurnSearch |
| EnginesStore._bindPlayerTurnCallbacks |

| EnginesStore._handlePlayerTurnMove |
| --- |
| GamesStore.makeMove |

| GamesStore.makeMove |
| --- |
| GamesStore._assertMoveAllowed |
| GamesStore._resolveMoveContext |
| GamesStore._applyMoveByContext |
| GamesStore._persistWorkspaceIfNeeded |
| GameView._requestPlayerMoveIfNeeded |

- Requirement verification: `Pass`. External import stays separate from internal save browsing, `SavedGamesStore` owns picker selection, `GamesStore` performs the actual load, duplicate IDs are repaired before insertion, and the restored game state is visible before analysis or engine-turn restart begins.

### SCN-IMPORT-02 - Reject Invalid External Game File

#### Flow
| MenuBar.importGameRequested |
| --- |
| SavedGamesStore.importGame |
| GamesStore.loadGame |
| UiStateStore.showModal |

| SavedGamesStore.importGame |
| --- |
| SavedGameDocumentService.selectImportFile |

| GamesStore.loadGame |
| --- |
| SavedGameDocumentService.readDocument |
| SerializationService.deserialiseGame |

| UiStateStore.showModal |
| --- |

- UI surface coverage: invalid external import uses the shared dialog shell as the acknowledge-only importError path.
- Requirement verification: `Pass`. Failed import does not mutate the current session state, and unsupported, corrupt, or incomplete documents stay isolated inside the state-management boundary.

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
| `UserSettingService._validateSettings` |
| `UserSettingService._writeSettingsSnapshot` |
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
- Settings coverage: `appearance.themeMode` is handled alongside the existing appearance fields. `ThemeMode.System` follows the layer-2 theme-resolution path, while `ThemeMode.Light` and `ThemeMode.Dark` force built-in app themes.
- Requirement verification: `Pass`. Validation happens before apply or persistence, only committed settings fields are writable, engine inventory stays inside the same settings draft model as the other fields, and accepted appearance changes refresh the shared app-theme variables immediately.

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
| `UserSettingService._defaultSettings` |
| `UserSettingService._writeSettingsSnapshot` |
| `UserSettingService._cacheAcceptedSettings` |

| `UiStateStore.hideModal` |
| --- |

- UI surface coverage: reset is triggered from the secondary settings action area and always routes through the shared confirmation dialog before the default snapshot is applied.
- Requirement verification: `Pass`. Reset restores the authoritative default schema, reprojects the default appearance state, and persists it atomically.

### SCN-ENGINE-01 - Add Engine Configuration

#### Flow A - Add And Apply The New Profile
| `EngineInventoryEditor.addRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.applySettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._mergeDraftPatch` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.applySettings` |
| --- |
| `UserSettingService.saveSettings` |
| `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._syncDraftToAccepted` |

#### Flow B - Add And Save The New Profile
| `EngineInventoryEditor.addRequested` |
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

- UI surface coverage: add opens the dedicated profile editor surface, where option rows may be added, edited, or removed before the draft is applied or saved.
- Requirement verification: `Pass`. Unique profile-name validation happens before the engine record becomes part of the accepted settings snapshot, while all other profile values are stored as entered.

### SCN-ENGINE-02 - Update or Remove Engine Configuration

#### Flow A - Update An Existing Profile
| `EngineInventoryEditor.editRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.applySettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._mergeDraftPatch` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.applySettings` |
| --- |
| `UserSettingService.saveSettings` |
| `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._syncDraftToAccepted` |

#### Flow B - Remove An Existing Profile
| `EngineInventoryEditor.deleteRequested` |
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

- UI surface coverage: copy, edit, and delete originate from the engine-profile row actions, with edit reopening the same dedicated profile editor surface and delete affecting the settings draft only.
- Requirement verification: `Pass`. Edit and remove operations remain consistent with `Cancel`, `Apply`, and `Save`, and open games keep their captured assigned-engine snapshots even when reusable profiles change.

## Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Inactive Game

#### Flow
| `GameTabs.deleteRequestedForInactiveGame` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.deleteGame` |
| `GamesStore._stopGameSessions` |
| `GamesStore._removePersistedDocument` |
| `UiStateStore.closeTab` |
| `UiStateStore.saveGameSession` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.deleteGame` |
| --- |
| `GamesStore._assertGameExists` |
| `GamesStore._disposePlatformEventSubscriptions` |
| `GamesStore._stopGameSessions` |
| `SavedGameDocumentService.deleteDocument` |

| `UiStateStore.closeTab` |
| --- |
| `UiStateStore._coerceOpenTabs` |

| `UiStateStore.saveGameSession` |
| --- |
| `SessionStateService.saveGameSession` |

- Requirement verification: `Pass`. Deletion removes runtime, persistence, and tab state together.

### SCN-LIFECYCLE-02 - Delete Active Game and Switch Context

#### Flow
| `GameTabs.deleteRequestedForActiveGame` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.deleteGame` |
| `GamesStore.listGames` |
| `UiStateStore.setActiveGame` |
| `Router._selectFallbackRoute` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.deleteGame` |
| --- |
| `GamesStore._assertGameExists` |
| `GamesStore._disposePlatformEventSubscriptions` |
| `GamesStore._selectFallbackGameId` |

| `GamesStore.listGames` |
| --- |

| `UiStateStore.setActiveGame` |
| --- |
| `UiStateStore._coerceActiveRoute` |

- Requirement verification: `Pass`. Active-game deletion cannot leave a dangling route or session pointer.









