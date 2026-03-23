# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`.

## Persistence And File I/O

### SCN-SAVE-01 - Autosave on State Mutation
- Public flow: `GamesStore.saveGame`, `RecentGameStore.recordAutosavedGame`, `SettingsStore.saveSettings`, `UiStateStore.saveGameSession`, and `UiStateStore.saveLayoutState` from their owning mutation flows.
- Private design: `GamesStore._buildPersistedWorkspace`; `RecentGameStore._upsertRecentEntry` -> `_sortMostRecentFirst`; `SettingsStore._persistSnapshot`; `UiStateStore._saveGameSessionSnapshot`; `UiStateStore._saveLayoutState`; shared debounce uses `_schedulePersistWrite`.
- Requirement verification: `Pass`. Game, recent-games, settings, game-session, and UI-layout artefacts stay separated while still achieving eventual consistency.

### SCN-SAVE-02 - Manual Save Game to File
- Public flow: conditional `GamesStore.pauseGame(..., "menu")` -> `GamesStore.exportGame` -> `FileIoAdapter.saveGame` -> `RecentGameStore.recordManuallySavedGame` -> conditional `GamesStore.resumeGame(..., "menu")`.
- Private design: `GamesStore._buildPersistedWorkspace` -> `_exportGame`; `FileIoAdapter._openSaveDialog` -> `_writeGame`; `RecentGameStore._upsertRecentEntry` -> `_sortMostRecentFirst`.
- Settings coverage: `session.autoPauseOnMenu` decides whether timed live games are paused for export. The menu pause owner is preserved so export return cannot auto-resume a manually paused game.
- Requirement verification: `Pass`. Export writes the same canonical document shape used by autosave, returns the final file path for recent-history metadata, and honours menu auto-pause policy.

### SCN-LOAD-01 - Load Valid Game from File
- Public flow: `GamesStore.importGame` -> `FileIoAdapter.loadGame` -> `GamesStore.insertGame` -> `RecentGameStore.recordManuallySavedGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn`.
- Private design: `FileIoAdapter._openLoadDialog` -> `_readGame`; `GamesStore._remapDuplicateIdIfNeeded` -> `_hydrateWorkspace`; `RecentGameStore._upsertRecentEntry` uses the chosen `filePath` after duplicate-ID repair -> `_sortMostRecentFirst`; `EnginesStore._startAnalysisSessions`.
- State/settings coverage: the game workspace is restored first, including a restored `historyReview`, paused state, or finished result. `analysis.resumeLiveAnalysisAfterRestore` decides whether continuous analysis restarts after the persisted game state is shown. `_maybeRequestEngineTurn` is considered only after the workspace is fully restored and only when the restored state is `liveGame + currentPosition + ongoing + not paused` with an engine-controlled side to move.
- Requirement verification: `Pass`. Game-state restore happens before live analysis resumes, duplicate IDs are repaired before the recent-entry write, and engine-turn restart stays aligned with the restored live state.

### SCN-LOAD-02 - Load Invalid/Corrupt Game File
- Public flow: `GamesStore.importGame` -> `FileIoAdapter.loadGame` failure -> `UiStateStore.showModal({ kind: "importError" })`.
- Private design: `FileIoAdapter._mapFileIoError`; `SerializationService._parseJson` and `_migrateBySchemaVersion` distinguish unsupported and corrupt files.
- UI surface coverage: import failure uses the shared dialog shell; partial-recovery cases may expose continue or cancel actions, while unrecoverable cases reduce to acknowledge-and-close behaviour.
- Requirement verification: `Pass`. Failed import does not mutate the current session state.

## Settings And Engine Inventory

### SCN-SETTINGS-01 - Update Visual/UI Preferences
- Public flow: `SettingsStore.updateSettings` -> `SettingsStore.applySettings` or `SettingsStore.saveSettings`.
- Private design: `SettingsStore._validatePatch` -> `_normaliseEngineInventory` -> `_projectPendingSettings`; apply uses `_applyAcceptedSettingsProjection` -> `_resolveThemeMode` -> `_buildAppearanceProjection`; save uses `_persistSnapshot`; accepted appearance refresh is consumed by the root app-shell appearance host.
- UI surface coverage: category tabs switch the active settings section, Cancel, Save, and Apply stay in the primary bottom-right row, and the secondary reset action area remains outside that primary commit row.
- Route coverage: settings categories are routed through `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`, with `/settings` redirecting to `/settings/session`.
- Settings coverage: `appearance.themeMode` is handled alongside the existing appearance fields. `system` follows `SystemThemeAdapter`, while `light` and `dark` force built-in app themes. The appearance category also contains layout-related presentation preferences such as `uiScalePercent`, board orientation, coordinate visibility, and last-move highlighting. The accepted appearance projection includes a reactive semantic CSS-variable map so shared UI chrome updates immediately without a restart.
- Requirement verification: `Pass`. Validation happens before apply or persistence, only committed settings fields are writable, and accepted appearance changes refresh the shared app-theme variables immediately.

### SCN-SETTINGS-02 - Reset Settings to Defaults
- Public flow: `UiStateStore.showModal({ kind: "resetSettings" })` -> `SettingsStore.resetSettings`.
- Private design: `SettingsStore._defaultSettings` -> `_resolveThemeMode` -> `_buildAppearanceProjection` -> `_persistSnapshot`; cancel uses `UiStateStore.hideModal`.
- UI surface coverage: reset is triggered from the secondary settings action area and always routes through the shared confirmation dialog before the default snapshot is applied.
- Requirement verification: `Pass`. Reset restores the authoritative default schema, reprojects the default appearance state, and persists it atomically.

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
- Public flow: `UiStateStore.showModal({ kind: "deleteGame" })` -> `GamesStore.deleteGame` -> `UiStateStore.closeTab` -> `UiStateStore.saveGameSession`.
- Private design: `GamesStore._assertGameExists` -> `_stopGameSessions` -> `_removePersistedDocument`; `UiStateStore._coerceOpenTabs`.
- Requirement verification: `Pass`. Deletion removes runtime, persistence, and tab state together.

### SCN-LIFECYCLE-02 - Delete Active Game and Switch Context
- Public flow: `UiStateStore.showModal({ kind: "deleteGame" })` -> `GamesStore.deleteGame` -> `GamesStore.listGames` -> `UiStateStore.setActiveGame`.
- Private design: `GamesStore._selectFallbackGameId` -> `UiStateStore._coerceActiveRoute`; router return uses `_selectFallbackRoute`.
- Requirement verification: `Pass`. Active-game deletion cannot leave a dangling route or session pointer.


