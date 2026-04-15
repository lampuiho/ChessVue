# Engine Runtime Ownership Flows

## Scope
This document covers the layer-2 and layer-1 runtime ownership behind `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, `SCN-ENGINE-01` to `SCN-ENGINE-03`, and the engine-runtime portions of the live move loop.

## Ownership Summary
- `GamesStore` decides when analysis or player-turn runtime work should happen.
- `EngineRuntimeService` owns only base runtime state on `IAssignedEngine.$`, explicit analysis-callback registration and teardown, process lifecycle, process-handle validity checks, runtime availability, and runtime last-error updates.
- `EngineClient` owns only client-private runtime state such as optional protocol session initialisation, process-listener attachment, synced-position state, pending player-turn state, protocol I/O, and protocol parsing.
- `IAssignedUciEngineRuntime.session` is optional until `EngineClient.initialiseEngine(...)` creates and initialises it after base runtime state already exists.
- Runtime state changes must happen through explicit owner-private steps. No flow in this document relies on hidden mutation or side tables.

## Owner And Mutable State
- `EngineRuntimeService` may mutate:
  - `engine.$.processHandle`
  - `engine.$.availability`
  - `engine.$.lastError`
  - `engine.$.analysisCallback`
  - `engine.$.analysisLines`
- `EngineClient` may mutate:
  - `engine.$.session`
  - the object-attached process-listener references for that engine
  - the current synced position state for that engine
  - the pending player-turn state for that engine
- `GamesStore` does not mutate lower-layer runtime state directly. It requests runtime work through explicit service calls.

## Analysis Runtime

### Prepare Analysis Runtime
| `GamesStore.refreshAnalysis` |
| --- |
| `GamesStore._buildEnginePositionState` |
| `GamesStore._syncAnalysisPosition` |
| `GamesStore._registerAnalysisSubscription` |
| `GamesStore._startAnalysisSearch` |

| `GamesStore._syncAnalysisPosition` |
| --- |
| `EngineRuntimeService.syncPosition` |

| `GamesStore._registerAnalysisSubscription` |
| --- |
| `EngineRuntimeService.subscribeToAnalysis` |

| `GamesStore._startAnalysisSearch` |
| --- |
| `EngineRuntimeService.startAnalysis` |

| `EngineRuntimeService.syncPosition` |
| --- |
| `EngineRuntimeService._assertBaseRuntime` |
| `EngineRuntimeService._assertProcessHandleOpen` |
| `EngineRuntimeService._retryInitialiseOnInvalidProcessHandle` |
| `EngineRuntimeService._setAvailabilityReady` |
| `EngineClient.syncPosition` |

| `EngineRuntimeService.subscribeToAnalysis` |
| --- |
| `EngineRuntimeService._registerAnalysisCallback` |

| `EngineClient.initialiseEngine` |
| --- |
| `EngineClient._initialiseAssignedEngineSession` |
| `EngineClient._attachProcessListeners` |
| `EngineClient._sendHandshake` |
| `EngineClient._sendConfiguredOptions` |
| `EngineClient._markSessionInitialised` |

| `EngineClient.syncPosition` |
| --- |
| `EngineClient._requireInitialisedSession` |
| `EngineClient._storeSyncedPositionState` |
| `EngineClient._sendNewGameBoundaryIfRequired` |
| `EngineClient._sendPositionCommand` |

### Start Analysis Search
| `EngineRuntimeService.startAnalysis` |
| --- |
| `EngineRuntimeService._assertBaseRuntime` |
| `EngineRuntimeService._assertProcessHandleOpen` |
| `EngineRuntimeService._retryInitialiseOnInvalidProcessHandle` |
| `EngineRuntimeService._setAvailabilityRunning` |
| `EngineClient.startAnalysis` |

| `EngineClient.startAnalysis` |
| --- |
| `EngineClient._requireInitialisedSession` |
| `EngineClient._setAnalysisCallback` |
| `EngineClient._clearAnalysisState` |
| `EngineClient._sendAnalysisOptions` |
| `EngineClient._sendStartAnalysisCommand` |

### Stop Analysis Search
| `GamesStore.stopAnalysis` |
| --- |
| `GamesStore._stopAnalysisSearch` |

| `GamesStore._stopAnalysisSearch` |
| --- |
| `EngineRuntimeService.stopAnalysis` |

| `EngineRuntimeService.stopAnalysis` |
| --- |
| `EngineClient.stopAnalysis` |
| `EngineRuntimeService._setAvailabilityReady` |

| `EngineClient.stopAnalysis` |
| --- |
| `EngineClient._sendStopAnalysisCommand` |
| `EngineClient._clearAnalysisState` |

### Unregister Analysis Subscription
| `GameView._disposeAnalysisRuntimeBinding` |
| --- |
| `EngineRuntimeService._unregisterAnalysisCallback` |

### Streamed Analysis Update
| `EngineClient._handleAnalysisInfoLine` |
| --- |
| `EngineClient._storeAnalysisSlot` |
| `EngineClient._emitAnalysisUpdate` |

### Malformed Analysis Output
| `EngineClient._handleAnalysisInfoLine` |
| --- |
| `EngineClient._discardMalformedAnalysisMessage` |

- Failure rule: malformed analysis output does not mutate runtime availability, does not stop the process, does not clear `engine.$.lastError`, and does not clear the last valid visible result.

## Player Turn Runtime

### Prepare Player-Turn Runtime
| `GamesStore.requestPlayerMove` |
| --- |
| `GamesStore._buildEnginePositionState` |
| `GamesStore._syncPlayerTurnPosition` |
| `GamesStore._startPlayerTurnSearch` |
| `GamesStore._awaitPlayerTurnMove` |

| `GamesStore._syncPlayerTurnPosition` |
| --- |
| `EngineRuntimeService.syncPosition` |

| `GamesStore._startPlayerTurnSearch` |
| --- |
| `EngineRuntimeService.startPlayerTurn` |

| `GamesStore._awaitPlayerTurnMove` |
| --- |
| `EngineRuntimeService.awaitPlayerTurnMove` |

### Begin Player-Turn Search
| `EngineRuntimeService.startPlayerTurn` |
| --- |
| `EngineRuntimeService._assertBaseRuntime` |
| `EngineRuntimeService._assertProcessHandleOpen` |
| `EngineRuntimeService._retryInitialiseOnInvalidProcessHandle` |
| `EngineRuntimeService._setAvailabilityRunning` |
| `EngineClient.startPlayerTurn` |

| `EngineClient.startPlayerTurn` |
| --- |
| `EngineClient._requireInitialisedSession` |
| `EngineClient._createPendingPlayerTurn` |
| `EngineClient._sendStartPlayerTurnCommand` |

### Await Player-Turn Move
| `EngineRuntimeService.awaitPlayerTurnMove` |
| --- |
| `EngineClient.awaitPlayerTurnMove` |
| `EngineRuntimeService._setAvailabilityReady` |

| `EngineClient.awaitPlayerTurnMove` |
| --- |
| `EngineClient._awaitPendingPlayerTurn` |
| `EngineClient._clearPendingPlayerTurn` |

### Malformed Player-Turn Output
| `EngineClient._handleBestMoveLineForPlayerTurn` |
| --- |
| `EngineClient._failPendingPlayerTurn` |
| `EngineClient._clearPendingPlayerTurn` |
| `EngineClient._resetSessionAfterFailure` |
| `EngineRuntimeService._setAvailabilityFailed` |
| `EngineRuntimeService._setLastError` |

- Failure rule: malformed player-turn output is a runtime failure. It clears the pending player-turn state and follows the owning runtime-error path rather than being discarded silently.

## Runtime Stop And Restart

### Stop Engine Runtime
| `EngineRuntimeService.stopEngine` |
| --- |
| `EngineClient.stopEngine` |
| `ProcessManager.stopProcess` |
| `EngineRuntimeService._clearProcessHandle` |
| `EngineRuntimeService._clearAnalysisState` |
| `EngineRuntimeService._setAvailabilityUnavailable` |
| `EngineRuntimeService._clearLastError` |

| `EngineClient.stopEngine` |
| --- |
| `EngineClient._detachProcessListeners` |
| `EngineClient._resetSessionAfterStop` |
| `EngineClient._clearAnalysisState` |
| `EngineClient._clearPendingPlayerTurn` |

### Restart Engine Runtime After Explicit Retry Or Config Change
| `EngineRuntimeService.restartEngine` |
| --- |
| `EngineClient.stopEngine` |
| `ProcessManager.restartProcess` |
| `EngineRuntimeService._setAvailabilityStarting` |
| `EngineRuntimeService._clearLastError` |
| `EngineClient.initialiseEngine` |
| `EngineRuntimeService._setAvailabilityReady` |

## Operation-Time Process Failure

### Process Handle Becomes Stale Before Or During A Runtime Operation
| `EngineRuntimeService.syncPosition` |
| --- |
| `EngineRuntimeService._assertProcessHandleOpen` |
| `EngineRuntimeService._catchInvalidProcessHandle` |
| `EngineRuntimeService.ensureReady` |
| `EngineClient.initialiseEngine` |
| `EngineClient.syncPosition` |

- Failure rule: post-start engine termination is surfaced when the next runtime operation checks or uses the stored process handle. Runtime state changes are explicit on the service side and the client side.
- Recovery rule: `registerEngine(...)`, `syncPosition(...)`, `startAnalysis(...)`, and `startPlayerTurn(...)` may recover once by re-running `ensureReady(...)` only after `invalidProcessHandle`. Base-runtime absence or missing initialisation is still surfaced as failure.
