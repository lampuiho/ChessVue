# Engine Runtime Ownership Flows

## Scope
This document covers the layer-2 and layer-1 runtime ownership behind `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, `SCN-ENGINE-01` to `SCN-ENGINE-03`, and the engine-runtime portions of the live move loop.

## Ownership Summary
- `GamesStore` decides when analysis or player-turn runtime work should happen.
- `EngineRuntimeService` owns only base runtime state on `IAssignedEngine.$`, explicit analysis-callback registration and teardown, process lifecycle, per-operation process-handle validity checks, runtime availability, and runtime last-error updates.
- `EngineClient` owns only client-private runtime state such as optional session initialisation, process-listener attachment, synced-position state, pending player-turn state, protocol I/O, and protocol parsing.
- Client-private session state on `engine.$.session` is optional until `EngineClient.initialiseEngine(...)` creates and initialises it after base runtime state already exists.
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
| `EngineRuntimeService._runInitialisedEngineOperation` |
| `EngineClient.syncPosition` |

| `EngineRuntimeService._runInitialisedEngineOperation` |
| --- |
| `EngineRuntimeService._assertBaseRuntime` |
| `EngineRuntimeService._assertProcessHandleOpen` |
| `EngineRuntimeService._initialiseEngine` |
| `EngineRuntimeService._runEngineOperation` |

| `EngineRuntimeService.subscribeToAnalysis` |
| --- |
| `EngineRuntimeService._createBaseRuntime` |
| `engine.$.analysisCallback = onUpdate` |
| `return unsubscribe closure` |

| `EngineRuntimeService._initialiseEngine` |
| --- |
| `EngineRuntimeService._setRuntimeAvailability` |
| `ProcessManager.spawnProcess` or `ProcessManager.assertProcessHandleOpen` |
| `EngineClient.initialiseEngine` |

| `EngineClient.initialiseEngine` |
| --- |
| `EngineClient._initialiseAssignedEngineSession` |
| `EngineClient._attachToProcess` |
| `EngineClient._writeCommandAndWait` |
| `EngineClient._writeCommand` |

| `EngineClient.syncPosition` |
| --- |
| `EngineClient._requireInitialisedSession` |
| `EngineClient._writeCommandAndWait` |
| `EngineClient._writeCommand` |

### Start Analysis Search
| `EngineRuntimeService.startAnalysis` |
| --- |
| `EngineRuntimeService._assertBaseRuntime` |
| `EngineRuntimeService._runInitialisedEngineOperation` |
| `EngineClient.startAnalysis` |

| `EngineClient.startAnalysis` |
| --- |
| `EngineClient._requireInitialisedSession` |
| `engine.$.analysisCallback = onUpdate` |
| `engine.$.analysisLines.clear()` |
| `EngineClient._writeCommand` |

### Stop Analysis Search
| `GamesStore.stopAnalysis` |
| --- |
| `GamesStore._stopAnalysisSearch` |

| `GamesStore._stopAnalysisSearch` |
| --- |
| `EngineRuntimeService.stopAnalysis` |

| `EngineRuntimeService.stopAnalysis` |
| --- |
| `EngineRuntimeService._runLiveEngineOperation` |
| `EngineClient.stopAnalysis` |

| `EngineClient.stopAnalysis` |
| --- |
| `EngineClient._requireSession` |
| `EngineClient._writeCommand` |

### Unregister Analysis Subscription
| `GameView._disposeAnalysisRuntimeBinding` |
| --- |
| returned unsubscribe closure from `EngineRuntimeService.subscribeToAnalysis(...)` |

### Streamed Analysis Update
| `EngineClient._consumeLine` |
| --- |
| parse expected streamed analysis output |
| update `engine.$.analysisLines` for the current engine |
| `EngineClient._buildAnalysisUpdate` |
| invoke `engine.$.analysisCallback` |

### Unexpected Analysis Output
| `EngineClient._consumeLine` |
| --- |
| ignore non-terminal output that is irrelevant to the current awaited or streaming operation |

- Failure rule: irrelevant non-terminal analysis output does not mutate runtime availability, does not stop the process, does not clear `engine.$.lastError`, and does not clear the last valid visible result.
- Failure rule: positively identified unexpected engine output or session/process failure is surfaced through the client/runtime failure path rather than through silent repair.

## Player Turn Runtime

### Prepare Player-Turn Runtime
| `GamesStore.requestPlayerMove` |
| --- |
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
| `EngineRuntimeService._runInitialisedEngineOperation` |
| `EngineClient.startPlayerTurn` |

| `EngineClient.startPlayerTurn` |
| --- |
| `EngineClient._requireInitialisedSession` |
| create pending player-turn state |
| `EngineClient._writeCommand` |

### Await Player-Turn Completion
| `EngineRuntimeService.awaitPlayerTurnMove` |
| --- |
| `EngineRuntimeService._runLiveEngineOperation` |
| `EngineClient.awaitPlayerTurnMove` |

| `EngineClient.awaitPlayerTurnMove` |
| --- |
| `EngineClient._requireSession` |
| await pending player-turn state |
| clear pending player-turn state |

### Unexpected Player-Turn Output
| `EngineClient._consumeLine` |
| --- |
| ignore non-terminal output that is irrelevant to the current awaited move |

- Failure rule: session/process failure rejects the pending player-turn state and follows the owning runtime-error path.
- Failure rule: stricter handling for positively identified unexpected terminal output is deferred until a dedicated debugging pass.

## Runtime Stop And Restart

### Stop Engine Runtime
| `EngineRuntimeService.stopEngine` |
| --- |
| `EngineClient.stopEngine` |
| `ProcessManager.stopProcess` |
| `EngineRuntimeService._clearAnalysisState` |
| `EngineRuntimeService._setRuntimeAvailability` |
| `engine.$.processHandle = undefined` |

| `EngineClient.stopEngine` |
| --- |
| `EngineClient._requireProcessHandle` |
| `EngineClient._getSession` |
| client-private session stop helper |

### Restart Engine Runtime After Explicit Retry Or Config Change
| `EngineRuntimeService.restartEngine` |
| --- |
| `EngineRuntimeService._createBaseRuntime` |
| `EngineRuntimeService._setRuntimeAvailability` |
| `EngineClient.stopEngine` |
| `ProcessManager.restartProcess` or `ProcessManager.spawnProcess` |
| `EngineRuntimeService._runEngineOperation` |
| `EngineClient.initialiseEngine` |

## Operation-Time Process Failure

### Process Handle Becomes Stale Before Or During A Runtime Operation
| `EngineRuntimeService.syncPosition` |
| --- |
| `EngineRuntimeService._runInitialisedEngineOperation` |
| `EngineRuntimeService._assertProcessHandleOpen` |
| `EngineRuntimeService._initialiseEngine` after `InvalidProcessHandle` |
| `EngineClient.syncPosition` |

- Failure rule: post-start engine termination is surfaced when the next runtime operation checks or uses the stored process handle.
- Recovery rule: `syncPosition(...)`, `startAnalysis(...)`, and `startPlayerTurn(...)` may recover once by re-running the explicit initialisation path only after `InvalidProcessHandle`. Base-runtime absence or missing initialisation is still surfaced as failure.
