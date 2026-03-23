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
- `UiStateStore` now covers transient modal flows plus independently persisted game-session and layout state.
- `RecentGameStore` now owns home recent-history loading, deduped recent-entry persistence, and reopen routing across autosave and manual-file targets.
- `EnginesStore` now covers analysis runtime control and player-engine turn control for already assigned engine participants.
- `AnalysisStore` now acts as callback-only analysis state rather than an engine runtime controller.
- `EngineClient` now hides protocol strings behind concrete engine-session operations and typed analysis updates.

## State And Settings Coverage Matrix
This matrix is the compact cross-check for the public entry points that decide whether play continues, switches to analysis-only behaviour, or becomes a no-op.

| Entry point | Accepted workspace kinds | Accepted interaction contexts | Clock/result gate | Settings that alter branch | Outcome |
| --- | --- | --- | --- | --- | --- |
| `GamesStore.makeMove` | `liveGame`, `freeAnalysisSetup` | `currentPosition`, `historyReview`, `inGameAnalysis` | blocks live progression when paused or final | `gameplay.takebackPolicy`, `gameplay.confirmMainlineRewrite`, `gameplay.analysisBranchExitBehaviour`, `gameplay.promotionPolicy` | live move, analysis move, history rewrite, or blocked action |
| `GamesStore.pauseGame` | `liveGame` | `currentPosition` | timed + ongoing only | none | explicit pause with stored owner |
| `GamesStore.resumeGame` | `liveGame` | `currentPosition` | timed + paused + ongoing only | none | explicit resume when the same owner is allowed to resume |
| `GamesStore.enterInGameAnalysis` | `liveGame` | `currentPosition` | ongoing or timeout-final with `resultReason = timeout` | none | switch to analysis-only live-game exploration without reopening live progression |
| `GamesStore.startGameFromSetup` | `freeAnalysisSetup` | `currentPosition` | result must remain `ongoing` | none beyond engine validation rules | transition to `liveGame` or reject unsupported setup |
| `GamesStore.importGame` | imported payload decides | restored `currentPosition` or `historyReview` | restored paused/final state is preserved | `analysis.resumeLiveAnalysisAfterRestore` | restore persisted game state first, then optional live analysis and optional engine turn |
| `GamesStore._maybeRequestEngineTurn` | `liveGame` | `currentPosition` only | ongoing + not paused + not expired | none | request one engine-controlled live turn or no-op |
| `EnginesStore.startAnalysis` | `liveGame`, `freeAnalysisSetup` | `currentPosition`, `historyReview`, `inGameAnalysis` | allowed during paused and finished review, blocked during `boardEdit` | `analysis.resumeLiveAnalysisAfterRestore` affects restore flows only | continuous analysis callbacks until stopped or completed |
| `EnginesStore.startPlayerTurn` | `liveGame` | `currentPosition` only | ongoing + not paused + not expired | none | one turn-scoped engine move search or strict rejection |

## Private Helper Catalogue
These helper families are the intended internal structure behind the public APIs.

### GamesStore
- `_loadRequestedDocuments`
- `_createWorkspace`
- `_validateCreateRequest`
- `_applyMoveByContext`
- `_rebuildClockFromHistory`
- `_finaliseResult`
- `_buildPersistedWorkspace`
- `_persistWorkspace`
- `_maybeRequestEngineTurn`

### AnalysisStore
- `_markStreamActive`
- `_mergeEngineSnapshot`
- `_markStreamComplete`
- `_markStreamUnavailable`

### EnginesStore
- `_getConfiguredInventory`
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
- `_resolveThemeMode`
- `_buildAppearanceProjection`
- `_subscribeToSystemThemeChanges`
- `_validatePatch`
- `_normaliseEngineInventory`
- `_applyAcceptedSettings`
- `_discardPendingSettings`
- `_persistSnapshot`

### RecentGameStore
- `_loadStoredSnapshot`
- `_resetCorruptSnapshot`
- `_upsertRecentEntry`
- `_sortMostRecentFirst`
- `_dropStaleEntry`
- `_openAutosavedGame`
- `_openManualFileGame`

### UiStateStore
- `_loadStoredGameSession`
- `_loadStoredLayoutState`
- `_resetInvalidGameSession`
- `_resetInvalidLayoutState`
- `_saveGameSessionSnapshot`
- `_saveLayoutState`
- `_coerceActiveRoute`
- `_coerceOpenTabs`
- `_coerceLayoutState`
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

### FileIoAdapter And ProcessManager
- `FileIoAdapter`: `_openSaveDialog`, `_writeGame`, `_openLoadDialog`, `_readGame`
- `ProcessManager`: `_spawnChildProcess`, `_writeToStdin`, `_bindStdout`, `_bindExitHandler`, `_disposeProcess`

## Reading Order
1. Read [StartupAndNavigation.md](StartupAndNavigation.md) first.
2. Continue with [GameplayAndControl.md](GameplayAndControl.md) for the core move loop and player-engine turn flow.
3. Read [AnalysisAndSetup.md](AnalysisAndSetup.md) for engine analysis and setup-specific branching.
4. Finish with [PersistenceAndAdministration.md](PersistenceAndAdministration.md) for save/load and maintenance workflows.


