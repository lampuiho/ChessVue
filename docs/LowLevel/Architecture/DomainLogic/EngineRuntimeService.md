# EngineRuntimeService

## Purpose
Own the layer-2 engine runtime boundary consumed by `GamesStore` for continuous analysis and engine-controlled turns.

## Public Interface
```ts
ensureSession(session: IEngineRuntimeSession, engine: IAssignedEngine): Promise<void>
configureSession(sessionId: string, options: IEngineOptionMap): Promise<void>
registerSession(sessionId: string, request: IEngineRegistrationRequest): Promise<void>
syncPosition(sessionId: string, positionState: IEnginePositionState): Promise<void>
startAnalysis(sessionId: string, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(sessionId: string): Promise<void>
startPlayerTurn(sessionId: string): Promise<void>
subscribeToAnalysis(sessionId: string, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
awaitPlayerTurnMove(sessionId: string): Promise<IMove>
getSession(sessionId: string): IEngineRuntimeSession | null
restartSession(session: IEngineRuntimeSession, engine: IAssignedEngine): Promise<void>
stopSession(sessionId: string): Promise<void>
```

## Responsibilities
- wrap `EngineClient` and `ProcessManager` so layer 3 consumes one engine-runtime service instead of platform adapters
- spawn, configure, register, sync, restart, and stop engine sessions using the captured assigned-engine snapshot from the game workspace
- subscribe to engine stdout, route raw lines through `EngineClient`, and write protocol commands to stdin through `ProcessManager`
- expose typed analysis callbacks plus promise-shaped player-turn completion without leaking UCI or raw process semantics upward
- isolate protocol-specific message composition, ready handshakes, raw process transport, and per-session callback fanout behind the layer-2 boundary
- support position supersession and deterministic new-game-boundary handling for analysis refresh and player-engine turns
- discard malformed analysis output messages without failing the whole session
- surface malformed player-turn output and other runtime exceptions to the owning caller's standard runtime-error path without inventing a response timeout or automatic reconnect

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
- `EngineRuntimeService` is the missing layer-2 engine-facing path described by the flow docs and high-level architecture.
- `GamesStore` owns runtime intent and session state, but it reaches process transport and protocol translation only through this service.
- `EngineRuntimeService` owns process lifecycle, stdin/stdout wiring, and typed runtime callback delivery for engine sessions.
- `EngineClient` remains the owner of UCI mapping, engine-facing FEN, and protocol parsing only.
- `startPlayerTurn` has no response timeout in the baseline. If the process stays alive but does not produce a valid move, the turn remains pending until a valid move arrives or the session exits unexpectedly.
- Player-turn completion is exposed as `awaitPlayerTurnMove(...)`, even if the implementation uses internal callbacks to resolve that promise.
- Session health checks use `getSession(...)` polling over `availability` and `lastError`, rather than a public session-event callback contract.
- Unexpected process exit is the only automatic disconnection trigger. Recovery stays manual through the owning retry flows.
- Analysis parse failures discard only the bad output message and keep the session alive. Player-turn parse failures and other runtime exceptions are surfaced to the owning standard error-handling path.
