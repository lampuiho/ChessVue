# EngineRuntimeService

## Purpose
Own the layer-2 game-facing engine runtime boundary consumed by `GamesStore` for continuous analysis and engine-controlled turns.

## Public Interface
```ts
ensureReady(engine: IAssignedEngine): Promise<void>
syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>
startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(engine: IAssignedEngine): Promise<void>
startPlayerTurn(engine: IAssignedEngine): Promise<void>
subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>
isRuntimeAlive(engine: IAssignedEngine): boolean
restartEngine(engine: IAssignedEngine): Promise<void>
stopEngine(engine: IAssignedEngine): Promise<void>
```

## Responsibilities
- coordinate engine sessions in a game-facing shape so layer 3 consumes one runtime service instead of platform adapters
- assert that base runtime state already exists before lower-layer protocol work starts for actions that require it
- initialise, restart, and stop engine processes through `ProcessManager`
- check process-handle validity through `ProcessManager` before runtime actions that require a live engine process
- set runtime availability and runtime last error on the shared assigned-engine runtime state
- register and unregister the shared analysis callback on `engine.$`
- compose `ProcessManager` for process lifecycle and `EngineClient` for protocol conversation without layering one platform service through another
- expose typed streamed analysis updates plus promise-shaped player-turn completion without leaking UCI or engine-communication semantics upward

## Dependencies
- `ProcessManager`
- `EngineClient`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-SESSION-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `GamesStore` owns runtime intent and session usage, but it reaches protocol and process behaviour only through this service.
- `EngineRuntimeService` is a session-oriented coordinator, not a raw parser or command-builder hub.
- `EngineRuntimeService` owns process start, stop, restart, and process-handle validity checks through `ProcessManager`.
- `EngineRuntimeService` binds runtime process state directly onto `IAssignedEngine.$`, including the `processHandle` returned by `ProcessManager`.
- `EngineRuntimeService` relies on the shared `IAssignedEngineRuntime` fields under `engine.$` and does not refine that runtime namespace for its documented ownership.
- `EngineRuntimeService` owns only the mutable service state named in the runtime process-flow doc: base runtime creation, `processHandle`, `availability`, `lastError`, and analysis-callback registration and teardown.
- Base runtime existence is a precondition, not a lazy recovery path, for runtime actions that require it. If that precondition is violated, the service should assert and surface the failure rather than silently creating missing runtime state mid-flow.
- `ensureReady(...)` is the only runtime path that may spawn a missing engine process. Other runtime actions must first assert that a live process already exists.
- `syncPosition(...)`, `startAnalysis(...)`, and `startPlayerTurn(...)` may retry once through `ensureReady(...)` only when the stored process handle proves stale with `invalidProcessHandle`. They do not hide missing-initialisation failures.
- `EngineClient` owns UCI mapping, engine-facing FEN, engine-output interpretation, protocol sequencing, and client-private runtime state behind this service.
- Streamed analysis is surfaced through the shared runtime state on `engine.$`. `EngineRuntimeService` coordinates when that lower-layer analysis path is started, stopped, or subscribed to, but it is not the owner of client-private state such as `session`, current synced position, or pending player-turn state.
- `isRuntimeAlive(...)` is the only public runtime-health polling surface. Detailed runtime state stays internal on `engine.$`.
- If the stored `processHandle` is present but no longer valid, `EngineRuntimeService` surfaces that failure through the attempted runtime operation rather than handling it through background callbacks.
- `startPlayerTurn` has no response timeout in the baseline. If the process stays alive but does not produce a valid move, the turn remains pending until a valid move arrives or the session exits unexpectedly.
- Player-turn completion is exposed as `awaitPlayerTurnMove(...)`, even if the implementation uses internal callbacks to resolve that promise.
- Session health checks use `isRuntimeAlive(...)` polling rather than a public session-event callback contract.
- Unexpected process exit is observed when the next attempted runtime operation checks or uses the stored process handle. Recovery stays manual through the owning retry flows.
- Analysis parse failures discard only the bad protocol message and keep the session alive. Player-turn parse failures and other runtime exceptions are surfaced to the owning standard error-handling path.
- The default runtime design here is explicit object-attached state on `engine.$`. It does not use hidden side tables.
- Suggested owner-private mutation steps use mutation-obvious names such as `_assertBaseRuntime`, `_ensureProcessHandleOpen`, `_setAvailabilityStarting`, `_setAvailabilityReady`, `_setAvailabilityRunning`, `_setAvailabilityFailed`, `_clearLastError`, `_setLastError`, `_registerAnalysisCallback`, `_unregisterAnalysisCallback`, and `_clearAnalysisState`.
- The runtime ownership breakdown and state-mutation order are defined in [../../ProcessFlows/EngineRuntimeOwnership.md](../../ProcessFlows/EngineRuntimeOwnership.md).
