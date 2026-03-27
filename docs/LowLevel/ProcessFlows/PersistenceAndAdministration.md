# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`.

## Persistence And File I/O

### SCN-SAVE-01 - Autosave Internal Save Entry

#### Flow
| Owning mutation committed |
| --- |
| SavedGamesStore.autosaveGame |

| SavedGamesStore.autosaveGame |
| --- |
| SavedGamesStore._shouldAutosaveForTrigger |
| SavedGameIndexService.getAutosaveFilePath |
| SerializationService.serialiseGame |
| SavedGamesStore._writeManagedSaveDocument |
| SavedGamesStore._emitRecentAutosaveRefresh |

| SerializationService.serialiseGame |
| --- |
| SerializationService._normalisePayload |

- Settings coverage: session.autosaveAfterMoveCount gates move-threshold autosave, while session.autosaveOnClose separately gates close-trigger autosave. SavedGamesStore.autosaveGame(..., trigger) is the only persistence owner for both trigger kinds.
- Requirement verification: Pass. Autosave writes the dedicated internal save entry beneath the configured save root, keeps recent metadata separate, and leaves in-memory game state intact when a write fails.

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
| SavedGamesStore._enumerateManagedSaveEntries |
| SavedGameIndexService.projectSaveGroups |

- Route coverage: save routes through /saved-games/save/:name, opens directly into the selected game's save surface, and does not use the shared dialog family.
- Settings coverage: session.autoPauseOnMenu decides whether a timed live game is paused before routing into the save view, and the remembered pause owner is what later allows safe auto-resume.
- Requirement verification: Pass. The save flow is route-level, ready-only until the user confirms a save name, and SavedGamesStore owns the grouped save-browser data instead of GamesStore.

### SCN-SAVE-03 - Confirm Internal Save Write

#### Flow
| SavedGamesView.saveRequested |
| --- |
| UiStateStore.showModal |
| SavedGamesStore.saveGameAs |
| SavedGamesStore.listSavedGames |

| UiStateStore.showModal |
| --- |

| SavedGamesStore.saveGameAs |
| --- |
| SavedGamesStore._validateSaveName |
| SavedGameIndexService.getNamedSaveFilePath |
| SerializationService.serialiseGame |
| SavedGamesStore._writeManagedSaveDocument |
| SavedGamesStore._emitRecentSavedGameRefresh |

| SerializationService.serialiseGame |
| --- |
| SerializationService._normalisePayload |

- UI surface coverage: overwrite confirmation uses the shared dialog shell, while the save-name field and Cancel or Save action row remain route-owned by SavedGamesView.
- Requirement verification: Pass. Internal named-save writes stay inside SavedGamesStore, overwrite confirmation is explicit, and recent metadata updates only after a successful save-file write.

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
| SavedGamesStore._enumerateManagedSaveEntries |
| SavedGameIndexService.projectSaveGroups |

#### Flow B - Load The Selected Internal Save
| SavedGamesView.loadRequested |
| --- |
| SavedGamesStore.loadSavedGame |
| GamesStore.insertGame |
| UiStateStore.openTab |
| UiStateStore.setActiveGame |
| UiStateStore.saveGameSession |

| SavedGamesStore.loadSavedGame |
| --- |
| SavedGamesStore._readManagedSaveDocument |
| SerializationService.deserialiseGame |
| SavedGamesStore._remapDuplicateIdIfNeeded |
| SavedGamesStore._emitRecentSavedGameRefresh |

| SerializationService.deserialiseGame |
| --- |
| SerializationService._detectGameDocumentShape |

| GamesStore.insertGame |
| --- |
| GamesStore._hydrateWorkspace |

| UiStateStore.openTab |
| --- |
| UiStateStore._coerceOpenTabs |

| UiStateStore.setActiveGame |
| --- |
| UiStateStore._coerceActiveRoute |

| UiStateStore.saveGameSession |
| --- |
| UiStateStore._saveGameSessionSnapshot |

#### Flow C - Resume Analysis For The Loaded Workspace
| Loaded workspace ready for analysis resume |
| --- |
| EnginesStore.startAnalysis |

| EnginesStore.startAnalysis |
| --- |
| EnginesStore._startAnalysisSessions |
| EnginesStore._bindAnalysisCallbacks |
| EnginesStore._forwardAnalysisUpdate |

#### Flow D - Request An Engine Turn For The Loaded Workspace
| Loaded live current position ready for engine move |
| --- |
| GamesStore._maybeRequestEngineTurn |
| EnginesStore.startPlayerTurn |
| GamesStore.makeMove |

| EnginesStore.startPlayerTurn |
| --- |
| EnginesStore._startPlayerTurnSearch |
| EnginesStore._bindPlayerTurnCallbacks |

| GamesStore.makeMove |
| --- |
| GamesStore._assertMoveAllowed |
| GamesStore._resolveMoveContext |
| GamesStore._applyMoveByContext |
| GamesStore._persistWorkspaceIfNeeded |
| GamesStore._maybeRequestEngineTurn |

- Route coverage: /saved-games/load shows grouped games, double-click latest-save loading, and Select, while /saved-games/load/:name switches the bottom-right action to Load for the selected game's save list.
- State/settings coverage: the restored workspace is shown before analysis resumes, `analysis.resumeLiveAnalysisAfterRestore` still gates continuous analysis restart, and `session.autoPauseOnMenu` controls the route-entry pause branch only.
- Requirement verification: Pass. Internal load stays distinct from external import, duplicate IDs are repaired before insertion, and recent metadata plus shell routing stay coordinated through SavedGamesStore, GamesStore, and UiStateStore.

### SCN-EXPORT-01 - Export Game to External File

#### Flow
| MenuBar.exportGameRequested |
| --- |
| GamesStore.pauseGame |
| SavedGamesStore.exportGame |
| GamesStore.resumeGame |

| GamesStore.pauseGame |
| --- |
| GamesStore._maybeAutoPauseForMenu |
| GamesStore._markPauseOwner |

| SavedGamesStore.exportGame |
| --- |
| SavedGamesStore._captureWorkspaceSnapshot |
| SerializationService.serialiseGame |
| SavedGamesStore._writeExternalExportDocument |
| SavedGamesStore._emitRecentSavedGameRefresh |

| SerializationService.serialiseGame |
| --- |
| SerializationService._normalisePayload |

| GamesStore.resumeGame |
| --- |
| GamesStore._assertResumable |
| GamesStore._resumeClock |
| GamesStore._resumeIfMenuOwnedPause |

- Settings coverage: session.autoPauseOnMenu controls whether export pauses a timed live game before the external file dialog opens.
- Requirement verification: Pass. External export stays distinct from internal save slots, writes the canonical saved-game payload once, and returns through the menu-owned pause path without mutating game state beyond the export side effect.

### SCN-IMPORT-01 - Import Valid Game from External File

#### Flow A - Import And Insert The Workspace
| MenuBar.importGameRequested |
| --- |
| SavedGamesStore.importGame |
| GamesStore.insertGame |
| UiStateStore.openTab |
| UiStateStore.setActiveGame |
| UiStateStore.saveGameSession |

| SavedGamesStore.importGame |
| --- |
| SavedGamesStore._readExternalImportDocument |
| SerializationService.deserialiseGame |
| SavedGamesStore._remapDuplicateIdIfNeeded |
| SavedGamesStore._emitRecentSavedGameRefresh |

| SerializationService.deserialiseGame |
| --- |
| SerializationService._detectGameDocumentShape |

| GamesStore.insertGame |
| --- |
| GamesStore._hydrateWorkspace |

| UiStateStore.openTab |
| --- |
| UiStateStore._coerceOpenTabs |

| UiStateStore.setActiveGame |
| --- |
| UiStateStore._coerceActiveRoute |

| UiStateStore.saveGameSession |
| --- |
| UiStateStore._saveGameSessionSnapshot |

#### Flow B - Resume Analysis For The Imported Workspace
| Imported workspace ready for analysis resume |
| --- |
| EnginesStore.startAnalysis |

| EnginesStore.startAnalysis |
| --- |
| EnginesStore._startAnalysisSessions |
| EnginesStore._bindAnalysisCallbacks |
| EnginesStore._forwardAnalysisUpdate |

#### Flow C - Request An Engine Turn For The Imported Workspace
| Imported live current position ready for engine move |
| --- |
| GamesStore._maybeRequestEngineTurn |
| EnginesStore.startPlayerTurn |
| GamesStore.makeMove |

| EnginesStore.startPlayerTurn |
| --- |
| EnginesStore._startPlayerTurnSearch |
| EnginesStore._bindPlayerTurnCallbacks |

| GamesStore.makeMove |
| --- |
| GamesStore._assertMoveAllowed |
| GamesStore._resolveMoveContext |
| GamesStore._applyMoveByContext |
| GamesStore._persistWorkspaceIfNeeded |
| GamesStore._maybeRequestEngineTurn |

- Requirement verification: Pass. External import stays separate from internal save browsing, duplicate IDs are repaired before insertion, and the restored game state is visible before analysis or engine-turn restart begins.

### SCN-IMPORT-02 - Reject Invalid External Game File

#### Flow
| MenuBar.importGameRequested |
| --- |
| SavedGamesStore.importGame |
| UiStateStore.showModal |

| SavedGamesStore.importGame |
| --- |
| SavedGamesStore._readExternalImportDocument |
| SerializationService.deserialiseGame |

| SerializationService.deserialiseGame |
| --- |
| SerializationService._detectGameDocumentShape |

| UiStateStore.showModal |
| --- |

- UI surface coverage: invalid external import uses the shared dialog shell as the acknowledge-only importError path.
- Requirement verification: Pass. Failed import does not mutate the current session state, and unsupported, corrupt, or incomplete documents stay isolated inside the state-management boundary.

## Settings And Engine Inventory

### SCN-SETTINGS-01 - Update Visual/UI Preferences

#### Flow A - Apply Accepted Settings
| `SettingsView.applyRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.applySettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._validatePatch` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.applySettings` |
| --- |
| `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |

#### Flow B - Save Accepted Settings
| `SettingsView.saveRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.saveSettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._validatePatch` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.saveSettings` |
| --- |
| `SettingsStore._persistSnapshot` |

- UI surface coverage: category tabs switch the active settings section, `Cancel`, `Save`, and `Apply` stay in the primary bottom-right row, and the secondary reset action area remains outside that primary commit row.
- Route coverage: settings categories are routed through `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`, with `/settings` redirecting to `/settings/session`.
- Settings coverage: `appearance.themeMode` is handled alongside the existing appearance fields. `system` follows the layer-2 theme-resolution path, while `light` and `dark` force built-in app themes.
- Requirement verification: `Pass`. Validation happens before apply or persistence, only committed settings fields are writable, engine inventory stays inside the same settings draft model as the other fields, and accepted appearance changes refresh the shared app-theme variables immediately.

### SCN-SETTINGS-02 - Reset Settings to Defaults

#### Flow
| `SettingsView.resetRequested` |
| --- |
| `UiStateStore.showModal` |
| `SettingsStore.resetSettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |
| `SettingsStore._persistSnapshot` |
| `UiStateStore.hideModal` |

| `UiStateStore.showModal` |
| --- |

| `SettingsStore.resetSettings` |
| --- |
| `SettingsStore._defaultSettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |
| `SettingsStore._persistSnapshot` |

| `UiStateStore.hideModal` |
| --- |

- UI surface coverage: reset is triggered from the secondary settings action area and always routes through the shared confirmation dialog before the default snapshot is applied.
- Requirement verification: `Pass`. Reset restores the authoritative default schema, reprojects the default appearance state, and persists it atomically.

### SCN-ENGINE-01 - Add Engine Configuration

#### Flow A - Add And Apply The New Profile
| `EngineInventoryEditor.addRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.applySettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._validatePatch` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.applySettings` |
| --- |
| `SettingsStore._applyAcceptedSettings` |

#### Flow B - Add And Save The New Profile
| `EngineInventoryEditor.addRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.saveSettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._validatePatch` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.saveSettings` |
| --- |
| `SettingsStore._persistSnapshot` |

- UI surface coverage: add opens the dedicated profile editor surface, where option rows may be added, edited, or removed before the draft is applied or saved.
- Requirement verification: `Pass`. Unique profile-name validation happens before the engine record becomes part of the accepted settings snapshot, while all other profile values are stored as entered.

### SCN-ENGINE-02 - Update or Remove Engine Configuration

#### Flow A - Update An Existing Profile
| `EngineInventoryEditor.editRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.applySettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._validatePatch` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.applySettings` |
| --- |
| `SettingsStore._applyAcceptedSettings` |

#### Flow B - Remove An Existing Profile
| `EngineInventoryEditor.deleteRequested` |
| --- |
| `SettingsStore.updateSettings` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |
| `SettingsStore.saveSettings` |

| `SettingsStore.updateSettings` |
| --- |
| `SettingsStore._validatePatch` |
| `SettingsStore._normaliseEngineInventory` |
| `SettingsStore._projectPendingSettings` |

| `SettingsStore.saveSettings` |
| --- |
| `SettingsStore._persistSnapshot` |

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
| `GamesStore._stopGameSessions` |
| `GamesStore._removePersistedDocument` |

| `UiStateStore.closeTab` |
| --- |
| `UiStateStore._coerceOpenTabs` |

| `UiStateStore.saveGameSession` |
| --- |
| `UiStateStore._saveGameSessionSnapshot` |

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
| `GamesStore._selectFallbackGameId` |

| `GamesStore.listGames` |
| --- |

| `UiStateStore.setActiveGame` |
| --- |
| `UiStateStore._coerceActiveRoute` |

- Requirement verification: `Pass`. Active-game deletion cannot leave a dangling route or session pointer.









