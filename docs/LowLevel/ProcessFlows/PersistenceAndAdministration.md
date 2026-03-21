# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`.

## Persistence And File I/O

### SCN-SAVE-01 - Autosave on State Mutation
- Public flow: `GamesStore.saveGame`, `SettingsStore.saveSettings`, and `UiStateStore.saveSession` from their owning mutation flows.
- Private design: `GamesStore._buildGameDocument` -> `_captureSavedScreen` -> `_captureVisibleAnalysis`; `SettingsStore._persistSnapshot`; `UiStateStore._saveSessionSnapshot`; shared debounce uses `_schedulePersistWrite`.
- Requirement verification: `Pass`. Game, settings, and session artefacts stay separated while still achieving eventual consistency.

### SCN-SAVE-02 - Manual Save Game to File
- Public flow: conditional `GamesStore.pauseGame(..., "menu")` -> `GamesStore.exportGame` -> `FileIoAdapter.saveGameDocument` -> conditional `GamesStore.resumeGame(..., "menu")`.
- Private design: `GamesStore._buildGameDocument` -> `_captureSavedScreen` -> `_exportGameDocument`; `FileIoAdapter._openSaveDialog` -> `_writeGameDocument`.
- Settings coverage: `session.autoPauseOnMenu` decides whether timed live games are paused for export. The menu pause owner is preserved so export return cannot auto-resume a manually paused game.
- Requirement verification: `Pass`. Export writes the same canonical document shape used by autosave and honours menu auto-pause policy.

### SCN-LOAD-01 - Load Valid Game from File
- Public flow: `GamesStore.importGame` -> `FileIoAdapter.loadGameDocument` -> `GamesStore.insertGame` -> `AnalysisStore.loadSavedVisibleAnalysis` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn`.
- Private design: `FileIoAdapter._openLoadDialog` -> `_readGameDocument`; `GamesStore._remapDuplicateIdIfNeeded` -> `_hydrateWorkspace` -> `_restoreSavedVisibleState`; `AnalysisStore._retainSavedVisibleAnalysis` -> `EnginesStore._startAnalysisSessions`.
- State/settings coverage: the saved screen is restored first, including a restored `historyReview`, paused state, or finished result. `analysis.resumeLiveAnalysisAfterRestore` decides whether continuous analysis restarts after the saved visible snapshot is shown. `_maybeRequestEngineTurn` is considered only after the workspace is fully restored and only when the restored state is `liveGame + currentPosition + ongoing + not paused` with an engine-controlled side to move.
- Requirement verification: `Pass`. Exact-screen restore happens before live analysis resumes, duplicate IDs are repaired before insertion, and engine-turn restart stays aligned with the restored live state.

### SCN-LOAD-02 - Load Invalid/Corrupt Game File
- Public flow: `GamesStore.importGame` -> `FileIoAdapter.loadGameDocument` failure -> `UiStateStore.showModal("importError")`.
- Private design: `FileIoAdapter._mapFileIoError`; `SerializationService._parseJson` and `_migrateBySchemaVersion` distinguish unsupported, corrupt, and partially recoverable files.
- Requirement verification: `Pass`. Failed import does not mutate the current session state.

## Settings And Engine Inventory

### SCN-SETTINGS-01 - Update Visual/UI Preferences
- Public flow: `SettingsStore.updateSettings` -> `SettingsStore.saveSettings`.
- Private design: `SettingsStore._validatePatch` -> `_normaliseEngineInventory` -> `_persistSnapshot`; appearance refresh uses `GameView._applyAppearanceProjection`.
- Requirement verification: `Pass`. Validation happens before persistence, and only committed settings fields are writable.

### SCN-SETTINGS-02 - Reset Settings to Defaults
- Public flow: `UiStateStore.showModal("resetSettings")` -> `SettingsStore.resetSettings`.
- Private design: `SettingsStore._defaultSettings` -> `_persistSnapshot`; cancel uses `UiStateStore.hideModal`.
- Requirement verification: `Pass`. Reset restores the authoritative default schema and persists it atomically.

### SCN-ENGINE-01 - Add Engine Configuration
- Public flow: `EnginesStore.addEngine`.
- Private design: `EnginesStore._validateEngineRecord` -> `_assertUniqueEngineId` -> `_persistInventoryThroughSettingsStore`.
- Requirement verification: `Pass`. Path and identity validation are explicit before the inventory is persisted.

### SCN-ENGINE-02 - Update or Remove Engine Configuration
- Public flow: `EnginesStore.updateEngine` or `EnginesStore.removeEngine`.
- Private design: update uses `_validateEngineRecord` -> `_persistInventoryThroughSettingsStore` -> `_restartAffectedSessions`; remove uses `_stopMatchingSessions` -> `_removeInventoryRecord`.
- Requirement verification: `Pass`. Running sessions are stopped or restarted before the inventory change is considered complete.

## Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Inactive Game
- Public flow: `UiStateStore.showModal("deleteGame")` -> `GamesStore.deleteGame` -> `UiStateStore.closeTab` -> `UiStateStore.saveSession`.
- Private design: `GamesStore._assertGameExists` -> `_stopGameSessions` -> `_removePersistedDocument`; `UiStateStore._coerceOpenTabs`.
- Requirement verification: `Pass`. Deletion removes runtime, persistence, and tab state together.

### SCN-LIFECYCLE-02 - Delete Active Game and Switch Context
- Public flow: `UiStateStore.showModal("deleteGame")` -> `GamesStore.deleteGame` -> `GamesStore.listGames` -> `UiStateStore.setActiveGame`.
- Private design: `GamesStore._selectFallbackGameId` -> `UiStateStore._coerceActiveRoute`; router return uses `_selectFallbackRoute`.
- Requirement verification: `Pass`. Active-game deletion cannot leave a dangling route or session pointer.
