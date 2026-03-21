# ChessVue Process Flows

## Purpose
This folder turns the committed low-level architecture into scenario-level execution flows.

It answers three questions for every committed scenario:

- which public low-level functions own the flow
- which private helper calls sit behind those public functions
- whether the public surface is strong enough to satisfy the scenario requirements

Only `Current` and `Planned` scenarios from [../../HighLevel/scenarios.md](../../HighLevel/scenarios.md) are in scope here. `Idea` scenarios remain out of baseline scope.

## Conventions
- Public calls use the low-level module names from `docs/LowLevel/Architecture`.
- Private helpers are design-only names with an underscore prefix, for example `_hydrateWorkspace`.
- Verification uses `Pass` when the documented public surface can satisfy the scenario without presentation code reaching directly into domain or platform layers.

## Folder Summary
- [StartupAndNavigation.md](StartupAndNavigation.md): startup, restore, game creation, tabbing, and route flows.
- [GameplayAndControl.md](GameplayAndControl.md): move input, history, clocks, control-panel flows, and engine-controlled live turns.
- [AnalysisAndSetup.md](AnalysisAndSetup.md): free analysis/setup, board editing, engine analysis, and analysis-line inspection.
- [PersistenceAndAdministration.md](PersistenceAndAdministration.md): autosave, import/export, settings, engine inventory, and deletion flows.

## Public Interface Verification
The architecture docs were tightened alongside this folder so every committed scenario now has an owning public entry point:

- `GamesStore` now covers startup restore, setup-to-live transition, takeback, clock reconciliation, and pause/resume flows.
- `MoveUpdateService` now exposes navigation, position lookup, takeback, and prune operations with scenario-aligned names.
- `TimeControlService` now exposes `getRemainingTime` so UI clock reads stay authoritative.
- `UiStateStore` now covers transient modal and panel flows without persisting them.
- `EnginesStore` now covers engine inventory maintenance, analysis runtime control, and player-engine turn control.
- `AnalysisStore` now acts as callback-only analysis state rather than an engine runtime controller.
- `EngineClient` now hides protocol strings behind concrete engine-session operations and typed analysis updates.

## Private Helper Catalogue
These helper families are the intended internal structure behind the public APIs.

### GamesStore
- `_loadRequestedDocuments`
- `_createWorkspace`
- `_validateCreateRequest`
- `_applyMoveByContext`
- `_rebuildClockFromHistory`
- `_finaliseResult`
- `_buildGameDocument`
- `_persistWorkspace`
- `_maybeRequestEngineTurn`

### AnalysisStore
- `_markStreamActive`
- `_mergeEngineSnapshot`
- `_markStreamComplete`
- `_markStreamUnavailable`
- `_retainSavedVisibleAnalysis`

### EnginesStore
- `_getConfiguredInventory`
- `_validateEngineRecord`
- `_assertAnalysisSelectionLimit`
- `_buildSession`
- `_startAnalysisSessions`
- `_bindAnalysisCallbacks`
- `_forwardAnalysisUpdate`
- `_startPlayerTurnSearch`
- `_restartAffectedSessions`
- `_stopMatchingSessions`

### EngineClient
- `_initialiseProtocolSession`
- `_applyEngineOptions`
- `_mapAnalysisRequest`
- `_parseProtocolOutput`
- `_emitTypedUpdate`

### SettingsStore
- `_loadStoredSnapshot`
- `_migrateSnapshotOrDefault`
- `_validatePatch`
- `_normaliseEngineInventory`
- `_persistSnapshot`

### UiStateStore
- `_loadStoredSession`
- `_coerceActiveRoute`
- `_coerceOpenTabs`
- `_upsertGameLayout`
- `_showModalState`
- `_clearModalState`

### MoveUpdateService
- `_createRootNode`
- `_appendChildNode`
- `_resolveNodePath`
- `_rewriteMainlineMarkers`
- `_pruneDescendants`
- `_rewindVisibleNode`

### TimeControlService
- `_initialiseTimedClock`
- `_applyElapsedTime`
- `_applyIncrement`
- `_clampExpiredClock`
- `_switchActiveColour`

### SerializationService
- `_parseJson`
- `_migrateBySchemaVersion`
- `_sanitiseSavedScreen`
- `_sanitiseVisibleAnalysis`

### FileIoAdapter And ProcessManager
- `FileIoAdapter`: `_openSaveDialog`, `_writeGameDocument`, `_openLoadDialog`, `_readGameDocument`
- `ProcessManager`: `_spawnChildProcess`, `_writeToStdin`, `_bindStdout`, `_bindExitHandler`, `_disposeProcess`

## Reading Order
1. Read [StartupAndNavigation.md](StartupAndNavigation.md) first.
2. Continue with [GameplayAndControl.md](GameplayAndControl.md) for the core move loop and player-engine turn flow.
3. Read [AnalysisAndSetup.md](AnalysisAndSetup.md) for engine analysis and setup-specific branching.
4. Finish with [PersistenceAndAdministration.md](PersistenceAndAdministration.md) for save/load and maintenance workflows.
