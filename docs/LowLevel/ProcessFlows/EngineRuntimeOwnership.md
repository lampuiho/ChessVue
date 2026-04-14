# Engine Runtime Ownership Flows

## Scope
This document covers the layer-2 and layer-1 runtime ownership behind `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, `SCN-ENGINE-01` to `SCN-ENGINE-03`, and the engine-runtime portions of the live move loop.

## Ownership Summary
- `GamesStore` decides when analysis or player-turn runtime work should happen.
- `EngineRuntimeService` owns only base runtime state on `IAssignedEngine.$`, explicit analysis-subscriber registration and teardown, process lifecycle, unexpected-exit subscription, runtime availability, and runtime last-error updates.
- `EngineClient` owns only client-private runtime state such as optional protocol session initialisation, process-listener attachment, synced-position state, streamed analysis state, pending player-turn state, protocol I/O, and protocol parsing.
- `IAssignedUciEngineRuntime.session` is optional until the client runs `_initialiseSessionIfMissing(...)` after base runtime state already exists.
- Runtime state changes must happen through explicit owner-private steps. No flow in this document relies on hidden mutation, side tables, or `Map`-shaped runtime caches.

## Owner And Mutable State
- `EngineRuntimeService` may mutate:
  - `engine.$.processHandle`
  - `engine.$.availability`
  - `engine.$.lastError`
  - the object-attached analysis-subscriber list for that engine
  - the object-attached unexpected-exit unsubscribe handle for that engine
- `EngineClient` may mutate:
  - `engine.$.session`
  - the object-attached process-listener references for that engine
  - the current synced position state for that engine
  - the current analysis callback for that engine
  - the ordered analysis slots for that engine
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
| `EngineRuntimeService._ensureProcessHandleOpenOrRestartOnce` |
| `EngineRuntimeService._bindUnexpectedExit` |
| `EngineRuntimeService._setAvailabilityStarting` |
| `EngineRuntimeService._clearLastError` |
| `EngineClient.initialiseEngine` |
| `EngineRuntimeService._setAvailabilityReady` |
| `EngineClient.syncPosition` |

| `EngineRuntimeService.subscribeToAnalysis` |
| --- |
| `EngineRuntimeService._registerAnalysisSubscriber` |

| `EngineClient.initialiseEngine` |
| --- |
| `EngineClient._initialiseSessionIfMissing` |
| `EngineClient._attachProcessListeners` |
| `EngineClient._sendHandshake` |
| `EngineClient._sendConfiguredOptions` |
| `EngineClient._markSessionInitialised` |

| `EngineClient.syncPosition` |
| --- |
| `EngineClient._initialiseSessionIfMissing` |
| `EngineClient._storeSyncedPositionState` |
| `EngineClient._sendNewGameBoundaryIfRequired` |
| `EngineClient._sendPositionCommand` |

### Start Analysis Search
| `EngineRuntimeService.startAnalysis` |
| --- |
| `EngineRuntimeService._setAvailabilityRunning` |
| `EngineClient.startAnalysis` |

| `EngineClient.startAnalysis` |
| --- |
| `EngineClient._initialiseSessionIfMissing` |
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
| `EngineRuntimeService._unregisterAnalysisSubscriber` |

### Streamed Analysis Update
| `EngineClient._handleAnalysisInfoLine` |
| --- |
| `EngineClient._storeAnalysisSlot` |
| `EngineClient._emitAnalysisUpdate` |

| `EngineRuntimeService._forwardAnalysisUpdate` |
| --- |
| `GamesStore._applyAnalysisUpdate` |

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
| `EngineRuntimeService._setAvailabilityRunning` |
| `EngineClient.startPlayerTurn` |

| `EngineClient.startPlayerTurn` |
| --- |
| `EngineClient._initialiseSessionIfMissing` |
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
| `EngineRuntimeService._unbindUnexpectedExit` |
| `ProcessManager.stopProcess` |
| `EngineRuntimeService._clearProcessHandle` |
| `EngineRuntimeService._clearAnalysisSubscribers` |
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
| `EngineRuntimeService._unbindUnexpectedExit` |
| `ProcessManager.restartProcess` |
| `EngineRuntimeService._bindUnexpectedExit` |
| `EngineRuntimeService._setAvailabilityStarting` |
| `EngineRuntimeService._clearLastError` |
| `EngineClient.initialiseEngine` |
| `EngineRuntimeService._setAvailabilityReady` |

## Unexpected Exit

### Process Exit While Runtime Is Active
| `ProcessManager._notifyUnexpectedExit` |
| --- |
| `EngineClient._handleProcessExit` |
| `EngineRuntimeService._handleUnexpectedExit` |

| `EngineClient._handleProcessExit` |
| --- |
| `EngineClient._detachProcessListeners` |
| `EngineClient._resetSessionAfterFailure` |
| `EngineClient._clearAnalysisState` |
| `EngineClient._clearPendingPlayerTurn` |

| `EngineRuntimeService._handleUnexpectedExit` |
| --- |
| `EngineRuntimeService._unbindUnexpectedExit` |
| `EngineRuntimeService._clearProcessHandle` |
| `EngineRuntimeService._setAvailabilityFailed` |
| `EngineRuntimeService._setLastError` |

- Failure rule: unexpected exit is the only automatic disconnect trigger. Runtime state changes are explicit on both the service side and the client side.
- Recovery rule: base runtime absence is treated as a violated precondition and is surfaced as failure. A stale or closed `processHandle` may use one restart-oriented ensure path before that failure is surfaced.
