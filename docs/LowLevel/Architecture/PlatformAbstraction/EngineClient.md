# EngineClient

## Purpose
Expose concrete engine-session operations to `EngineRuntimeService` while hiding protocol-specific message formats such as UCI command strings.

## Public Interface
```ts
startSession(session: IEngineRuntimeSession, engine: IEngineRecord): Promise<void>
configureSession(sessionId: string, options: IEngineOptionMap): Promise<void>
registerSession(sessionId: string, request: IEngineRegistrationRequest): Promise<void>
syncPosition(sessionId: string, positionState: IEnginePositionState): Promise<void>
startAnalysis(sessionId: string, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(sessionId: string): Promise<void>
subscribeToAnalysis(sessionId: string, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
subscribeToSessionEvents(sessionId: string, onEvent: (event: IEngineSessionEvent) => void): () => void
restartSession(session: IEngineRuntimeSession, engine: IEngineRecord): Promise<void>
stopSession(sessionId: string): Promise<void>
```

## Responsibilities
- provide protocol-hidden engine operations for analysis and engine-controlled play
- translate ChessVue board and move structures into the active engine protocol implementation
- parse raw process output into typed engine updates before stores consume them
- own protocol setup, ready synchronisation, optional registration, and lifecycle callbacks
- isolate protocol-specific handshakes, options, and search commands from the rest of the architecture

## Dependencies
- `ProcessManager`

## Notes
- The baseline implementation targets `UCI`, but callers do not compose UCI command strings directly.
- If another protocol is ever introduced later, the protocol switch belongs inside `EngineClient`, not in stores or views.
- `subscribeToAnalysis` delivers typed updates so store logic can use normal references instead of string parsing.
- `EngineClient` owns conversion between `IBoardPosition` / `IMove` and whatever position or move encoding the engine protocol requires.
- `syncPosition` receives ChessVue root-and-moves state, and the client decides whether it can continue the same game line or must establish a fresh game boundary.
- During the rewrite phase, `EngineClient` sits on top of a mocked `NW.js`-style `ProcessManager`, so protocol logic can be implemented and tested before real child-process bindings exist.
- UCI move strings and engine-facing FEN are engine-boundary details only; they are derived lazily here and are not part of the canonical data contracts.
- Flow docs never expose `EngineClient` private utilities directly. If `EngineClient._mapBoardPositionToProtocolPosition` or `_shouldReuseCurrentGameLine` share contract-aware implementation with higher-level engine-position preparation, that implementation is documented under `EnginePositionMappingUtility` in [UtilityIndex.md](../UtilityIndex.md).

Example internal codec responsibilities:

```text
_mapBoardPositionToProtocolPosition
_mapProtocolMoveToMove
_mapProtocolPrincipalVariationToMoves
_shouldReuseCurrentGameLine
_emitSessionEvent
```

## Baseline UCI Mapping
The baseline implementation is expected to map its concrete methods roughly like this:

```text
startSession -> spawn process, send `uci`, receive `id` / `option` / `uciok`, then send `isready` and wait for `readyok`
configureSession -> set engine options
registerSession -> send `register later` or `register name ... code ...` and emit registration callbacks from engine responses
syncPosition -> privately map `IEnginePositionState` into `position startpos moves ...` or `position fen ... moves ...`; send `ucinewgame` plus `isready` only when the next search is from a different game or branch boundary
startAnalysis -> begin search for the current request
stopAnalysis -> stop the active search
subscribeToAnalysis -> parse `info` and `bestmove` output into `IMove` and `IAnalysisLine` values
subscribeToSessionEvents -> surface handshake, ready, copy-protection, and registration callbacks
```
