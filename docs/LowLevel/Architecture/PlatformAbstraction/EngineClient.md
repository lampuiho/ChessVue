# EngineClient

## Purpose
Expose concrete engine-session operations to stores while hiding protocol-specific message formats such as UCI command strings.

## Public Interface
```ts
startSession(session: IEngineRuntimeSession, engine: IEngineRecord): Promise<void>
configureSession(sessionId: string, options: IEngineOptionMap): Promise<void>
setPosition(sessionId: string, position: IBoardPosition): Promise<void>
startAnalysis(sessionId: string, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(sessionId: string): Promise<void>
subscribeToAnalysis(sessionId: string, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
restartSession(session: IEngineRuntimeSession, engine: IEngineRecord): Promise<void>
stopSession(sessionId: string): Promise<void>
```

## Responsibilities
- provide protocol-hidden engine operations for analysis and engine-controlled play
- translate ChessVue board and move structures into the active engine protocol implementation
- parse raw process output into typed engine updates before stores consume them
- isolate protocol-specific handshakes, options, and search commands from the rest of the architecture

## Dependencies
- `ProcessManager`

## Notes
- The baseline implementation targets `UCI`, but callers do not compose UCI command strings directly.
- If another protocol is ever introduced later, the protocol switch belongs inside `EngineClient`, not in stores or views.
- `subscribeToAnalysis` delivers typed updates so store logic can use normal references instead of string parsing.
- `EngineClient` owns conversion between `IBoardPosition` / `IMove` and whatever position or move encoding the engine protocol requires.

Example internal helper responsibilities:

```text
_mapBoardPositionToProtocolPosition
_mapProtocolMoveToMove
_mapProtocolPrincipalVariationToMoves
```

## Baseline UCI Mapping
The baseline implementation is expected to map its concrete methods roughly like this:

```text
startSession -> spawn process, run protocol handshake, apply initial options
configureSession -> set engine options
setPosition -> map `IBoardPosition` into UCI position state and load it into the engine session
startAnalysis -> begin search for the current request
stopAnalysis -> stop the active search
subscribeToAnalysis -> parse `info` and `bestmove` output into `IMove` and `IAnalysisLine` values
```
