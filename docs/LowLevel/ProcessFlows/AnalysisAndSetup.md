# Analysis And Setup Flows

## Scope
This document covers `SCN-FREE-ANALYSIS-01` to `SCN-ANALYSIS-05`.

## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context

#### Flow A - Create A Free Analysis Workspace
| `NewGameModal.createRequestedWithUnassignedSide` |
| --- |
| `GamesStore.createGame` |
| `GamesStore._createWorkspace` |
| `GamesStore._allowBothColoursForSetupMoves` |

| `GamesStore.createGame` |
| --- |
| `GamesStore._resolveWorkspaceKind` |
| `GamesStore._createWorkspace` |
| `GamesStore._allowBothColoursForSetupMoves` |

#### Flow B - Convert A Live Game Into Free Analysis / Setup
| `PlayerPanel.playerSelectionConfirmedAsNone` |
| --- |
| `GamesStore.reassignPlayer` |
| `GamesStore._switchWorkspaceToFreeAnalysisSetup` |
| `GamesStore._allowBothColoursForSetupMoves` |

| `GamesStore.reassignPlayer` |
| --- |
| `GamesStore._applyPlayerReassignment` |
| `GamesStore._switchWorkspaceToFreeAnalysisSetup` |
| `GamesStore._allowBothColoursForSetupMoves` |

#### Flow C - Refresh Analysis In The Free Analysis Workspace
| `Free analysis move committed` |
| --- |
| `GamesStore._refreshVisibleAnalysis` |
| `EnginesStore.startAnalysis` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |

- Requirement verification: `Pass`. A creation request with an unassigned side or a live-game reassignment to `none` yields a non-live workspace while preserving engine-driven analysis when configured.

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup

#### Flow A - Enter Board Edit
| `GameControlPanel.boardEditRequested` |
| --- |
| `GamesStore.enterBoardEdit` |
| `EnginesStore.stopAnalysis` |
| `GamesStore._suspendAnalysisForBoardEdit` |

| `GamesStore.enterBoardEdit` |
| --- |
| `GamesStore._assertBoardEditAllowed` |
| `GamesStore._snapshotPreEditState` |
| `GamesStore._suspendAnalysisForBoardEdit` |

| `EnginesStore.stopAnalysis` |
| --- |

#### Flow B - Confirm Board Edit
| `BoardEdit.confirmRequested` |
| --- |
| `GamesStore.confirmBoardEdit` |
| `MoveUpdateService.replaceBoardRoot` |
| `AnalysisStore.clearGameAnalysis` |
| `EnginesStore.startAnalysis` |

| `GamesStore.confirmBoardEdit` |
| --- |
| `GamesStore._confirmHistoryClearIfNeeded` |
| `GamesStore._replaceWorkspaceRoot` |
| `GamesStore._refreshVisibleAnalysis` |

| `MoveUpdateService.replaceBoardRoot` |
| --- |

| `AnalysisStore.clearGameAnalysis` |
| --- |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |

#### Flow C - Cancel Board Edit
| `BoardEdit.cancelRequested` |
| --- |
| `GamesStore.cancelBoardEdit` |
| `GamesStore._resumeAnalysisAfterBoardEditIfNeeded` |
| `EnginesStore.startAnalysis` |

| `GamesStore.cancelBoardEdit` |
| --- |
| `GamesStore._restorePreEditState` |
| `GamesStore._resumeAnalysisAfterBoardEditIfNeeded` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |

- UI surface coverage: free-analysis board editing reuses `PiecePalette` as the piece-choice surface and keeps that surface close to the active board-edit controls instead of treating it as a sidebar panel.
- State coverage: `boardEdit` is valid only inside `freeAnalysisSetup`. While active, engine analysis is suspended and `EnginesStore.startAnalysis` is blocked for that workspace.
- Process note: because board editing is restricted to `freeAnalysisSetup`, `GamesStore.confirmBoardEdit` replaces the root through `MoveUpdateService.replaceBoardRoot(..., null)` and clears prior move history in one mutation.
- Requirement verification: `Pass`. The public surface covers edit entry, confirm, cancel, history clearing, analysis suspension during edit, and analysis refresh afterwards.

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup

#### Flow
| `StartGameFromSetupModal.confirmed` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.startGameFromSetup` |
| `GamesStore._validateAssignedPlayers` |
| `GamesStore._validateAssignedEngines` |
| `GamesStore._retainPreparedMoveTree` |
| `GamesStore._initialiseLiveClock` |
| `GamesStore._switchWorkspaceKindToLiveGame` |
| `EnginesStore.startAnalysis` |
| `GamesStore._maybeRequestEngineTurn` |
| `UiStateStore.hideModal` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.startGameFromSetup` |
| --- |
| `GamesStore._validateSetupTransition` |
| `GamesStore._validateAssignedPlayers` |
| `GamesStore._validateAssignedEngines` |
| `GamesStore._retainPreparedMoveTree` |
| `GamesStore._initialiseLiveClock` |
| `GamesStore._switchWorkspaceKindToLiveGame` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |

| `UiStateStore.hideModal` |
| --- |

- State/settings coverage: the workspace may leave `freeAnalysisSetup` and enter `liveGame + currentPosition + ongoing` only when both sides are assigned. That transition applies a newly chosen time control, captures the per-game `showLiveAnalysisMoves` choice for the resulting live game, and initialises fresh live clock state.
- Requirement verification: `Pass`. Starting from setup preserves the prepared root and move tree while moving the workspace into live-game rules, and engine-controlled turns continue through the normal live-game gate.

## Analysis And Engine Runtime

### SCN-ANALYSIS-01 - Start Single Engine Analysis

#### Flow
| `Analysis requested for one engine` |
| --- |
| `EnginesStore.startAnalysis` |
| `EnginesStore.ensureAnalysisSessions` |
| `EngineClient.startSession` |
| `AnalysisStore.beginAnalysisStream` |
| `EngineClient.syncPosition` |
| `EngineClient.startAnalysis` |
| `EngineClient.subscribeToAnalysis` |
| `AnalysisStore.applyAnalysisUpdate` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |
| `EnginesStore._forwardAnalysisUpdate` |

| `EnginesStore.ensureAnalysisSessions` |
| --- |

| `EngineClient.startSession` |
| --- |

| `AnalysisStore.beginAnalysisStream` |
| --- |

| `EngineClient.syncPosition` |
| --- |

| `EngineClient.startAnalysis` |
| --- |

| `AnalysisStore.applyAnalysisUpdate` |
| --- |

- UI surface coverage: one engine group always shows score and engine state. It may also show up to `3` visible lines in `freeAnalysisSetup`, and in any `liveGame` context only when that game's `liveAnalysisOptions.showLiveAnalysisMoves = true`.
- State gate: `EnginesStore.startAnalysis` accepts `liveGame` and `freeAnalysisSetup` workspaces in `currentPosition`, `historyReview`, and `inGameAnalysis`. It is blocked while `interactionContext = boardEdit`.
- Requirement verification: `Pass`. Engine startup, streaming updates, ready callbacks, and position supersession are owned by the engine runtime boundary rather than the view.

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis

#### Flow
| `Analysis requested for multiple engines` |
| --- |
| `EnginesStore.startAnalysis` |
| `EnginesStore.validateAnalysisSelection` |
| `EnginesStore.ensureAnalysisSessions` |
| `EngineClient.syncPosition` |
| `EngineClient.startAnalysis` |
| `AnalysisStore._mergeEngineSnapshot` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._assertAnalysisSelectionLimit` |
| `EnginesStore._buildSessionPerEngine` |

| `EnginesStore.validateAnalysisSelection` |
| --- |

| `EnginesStore.ensureAnalysisSessions` |
| --- |

- UI surface coverage: the panel renders one independently foldable engine group per selected engine. Each group always shows score and engine state, and may additionally show up to `3` visible lines when the current workspace context allows rendered move targets.
- Requirement verification: `Pass`. The four-engine cap is enforced before processes start, and partial failure does not block healthy engines.

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis

#### Flow A - Stop Analysis Explicitly
| `AnalysisPanel.stopRequested` |
| --- |
| `EnginesStore.stopAnalysis` |
| `EngineClient.stopAnalysis` |
| `AnalysisStore.markAnalysisUnavailable` |

| `EnginesStore.stopAnalysis` |
| --- |
| `EnginesStore._stopMatchingSessions` |
| `EnginesStore._markEngineUnavailableInAnalysisStore` |

| `EngineClient.stopAnalysis` |
| --- |

| `AnalysisStore.markAnalysisUnavailable` |
| --- |

#### Flow B - Retry A Failed Engine
| `AnalysisPanel.retryRequested` |
| --- |
| `EnginesStore.retryAnalysis` |
| `EngineClient.restartSession` |
| `AnalysisStore.beginAnalysisStream` |

| `EnginesStore.retryAnalysis` |
| --- |
| `EnginesStore._restartSingleEngine` |
| `EnginesStore._bindAnalysisCallbacks` |

| `EngineClient.restartSession` |
| --- |

| `AnalysisStore.beginAnalysisStream` |
| --- |

- Requirement verification: `Pass`. Stop, crash, and retry behaviour is explicit at the runtime-owner boundary and preserves last-known visible output.

### SCN-ANALYSIS-04 - Click Suggested Move from Analysis Panel

#### Flow A - Free Analysis / Setup Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore._createOrReuseAnalysisBranch` |
| `GamesStore._refreshVisibleAnalysis` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applySelectedAnalysisMovePath` |
| `GamesStore._createOrReuseAnalysisBranch` |
| `GamesStore._refreshVisibleAnalysis` |

#### Flow B - Live Current-Position Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore._commitLiveMove` |
| `GamesStore._refreshVisibleAnalysis` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applySelectedAnalysisMovePath` |
| `GamesStore._commitLiveMove` |
| `GamesStore._refreshVisibleAnalysis` |

#### Flow C - Live History-Review Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore._applyHistoryMovePolicy` |
| `GamesStore._honourAnalysisBranchPolicy` |
| `GamesStore._refreshVisibleAnalysis` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applySelectedAnalysisMovePath` |
| `GamesStore._applyHistoryMovePolicy` |
| `GamesStore._honourAnalysisBranchPolicy` |
| `GamesStore._refreshVisibleAnalysis` |

#### Flow D - In-Game Analysis Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore._createOrReuseAnalysisBranch` |
| `GamesStore._refreshVisibleAnalysis` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applySelectedAnalysisMovePath` |
| `GamesStore._createOrReuseAnalysisBranch` |
| `GamesStore._refreshVisibleAnalysis` |

- State/settings coverage: `freeAnalysisSetup` always renders per-move engine targets. Any `liveGame` context renders engine move targets only when `liveAnalysisOptions.showLiveAnalysisMoves = true`.
- Requirement verification: `Pass`. Suggested moves are interactive only where the workspace policy allows them, and live-game suggestion clicks reuse the same context-specific move policy as ordinary move entry.

### SCN-ANALYSIS-05 - Add or Remove Per-Game Analysis Engine During Game

#### Flow A - Add An Analysis Engine
| `AnalysisPanel.analysisEngineAddRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.addAnalysisEngine` |
| `GamesStore._mutateAnalysisEngineRoster` |
| `EnginesStore.validateAnalysisSelection` |
| `GamesStore._refreshVisibleAnalysis` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.addAnalysisEngine` |
| --- |
| `GamesStore._assertAnalysisRosterMutable` |
| `GamesStore._mutateAnalysisEngineRoster` |
| `GamesStore._persistWorkspaceIfNeeded` |
| `GamesStore._refreshVisibleAnalysis` |

| `EnginesStore.validateAnalysisSelection` |
| --- |

#### Flow B - Remove An Analysis Engine
| `AnalysisPanel.analysisEngineRemoveRequested` |
| --- |
| `GamesStore.removeAnalysisEngine` |
| `EnginesStore.stopEngine` |
| `AnalysisStore.clearEngineAnalysis` |

| `GamesStore.removeAnalysisEngine` |
| --- |
| `GamesStore._mutateAnalysisEngineRoster` |
| `GamesStore._persistWorkspaceIfNeeded` |

| `EnginesStore.stopEngine` |
| --- |

| `AnalysisStore.clearEngineAnalysis` |
| --- |

- UI surface coverage: the analysis panel title owns the right-aligned `+` affordance for adding an engine to the current game, while each engine title row owns a right-aligned `-` affordance for removing that engine.
- State gate: roster add and remove are valid for `liveGame` and `freeAnalysisSetup` workspaces in `currentPosition`, `historyReview`, and `inGameAnalysis`.
- Requirement verification: `Pass`. Analysis-engine assignment stays per game, add and remove are both covered, and runtime start or stop remains delegated to the engine store.
