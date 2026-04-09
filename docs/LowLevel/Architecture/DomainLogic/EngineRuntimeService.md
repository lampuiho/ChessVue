# EngineRuntimeService

## Purpose
Own the layer-2 game-facing engine runtime boundary consumed by `GamesStore` for continuous analysis and engine-controlled turns.

## Public Interface
```ts
ensureReady(engine: IAssignedEngine): Promise<void>
registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void>
syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>
startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(engine: IAssignedEngine): Promise<void>
startPlayerTurn(engine: IAssignedEngine): Promise<void>
subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>
getRuntime(engine: IAssignedEngine): IAssignedEngineRuntime | null
restartEngine(engine: IAssignedEngine): Promise<void>
stopEngine(engine: IAssignedEngine): Promise<void>
```

## Responsibilities
- coordinate engine sessions in a game-facing shape so layer 3 consumes one runtime service instead of platform adapters
- keep runtime engine state, analysis subscriptions, availability, and last-error bookkeeping in layer 2
- compose `ProcessManager` for process lifecycle and `EngineClient` for protocol conversation without layering one platform service through another
- expose typed streamed analysis updates plus promise-shaped player-turn completion without leaking UCI or engine-communication semantics upward
- support position supersession and deterministic new-game-boundary handling for analysis refresh and player-engine turns
- surface malformed player-turn output, start failure, unexpected exit, and other runtime exceptions to the owning caller's standard runtime-error path without inventing a response timeout or automatic reconnect

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
- `EngineRuntimeService` owns process start, stop, restart, and unexpected-exit handling through `ProcessManager`.
- `EngineRuntimeService` binds runtime process state directly onto `IAssignedEngine.$`, including the `processHandle` returned by `ProcessManager`.
- `EngineClient` owns UCI mapping, engine-facing FEN, engine-output interpretation, and protocol sequencing behind this service.
- `getRuntime(...)` is the polling surface for health checks. It returns the current runtime view already stored under `engine.$`.
- `startPlayerTurn` has no response timeout in the baseline. If the process stays alive but does not produce a valid move, the turn remains pending until a valid move arrives or the session exits unexpectedly.
- Player-turn completion is exposed as `awaitPlayerTurnMove(...)`, even if the implementation uses internal callbacks to resolve that promise.
- Session health checks use `getRuntime(...)` polling over `availability` and `lastError`, rather than a public session-event callback contract.
- Unexpected process exit is the only automatic disconnection trigger. Recovery stays manual through the owning retry flows.
- Analysis parse failures discard only the bad protocol message and keep the session alive. Player-turn parse failures and other runtime exceptions are surfaced to the owning standard error-handling path.
