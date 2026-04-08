# EngineClient

## Purpose
Expose protocol translation and parsing to `EngineRuntimeService` while hiding protocol-specific message formats such as UCI command strings.

## Public Interface
```ts
interface IEngineProtocolParseResult {
  analysisUpdate: IEngineAnalysisUpdate | null
  playerTurnMove: IMove | null
  sessionEvents: IEngineSessionEvent[]
}

buildSessionInitialisationCommands(session: IEngineRuntimeSession, engine: IAssignedEngine): string[]
buildConfigureCommands(options: IEngineOptionMap): string[]
buildRegistrationCommands(request: IEngineRegistrationRequest): string[]
buildPositionSyncCommands(positionState: IEnginePositionState): string[]
buildStartAnalysisCommands(request: IEngineAnalysisRequest): string[]
buildStartPlayerTurnCommands(): string[]
buildStopCommands(): string[]
parseOutputLine(sessionId: string, line: string): IEngineProtocolParseResult
requiresNewGameBoundary(positionState: IEnginePositionState): boolean
```

## Responsibilities
- provide protocol-hidden command building for analysis and engine-controlled play
- translate ChessVue board and move structures into the active engine protocol implementation
- parse raw process output into typed engine updates before `EngineRuntimeService` emits them
- own protocol setup, ready synchronisation rules, optional registration encoding, and search command building
- isolate protocol-specific handshakes, options, and search commands from the rest of the architecture

## Dependencies
- none beyond shared data interfaces

## Notes
- The baseline implementation targets `UCI`, but callers do not compose UCI command strings directly.
- If another protocol is ever introduced later, the protocol switch belongs inside `EngineClient`, not in stores or views.
- `EngineClient` owns conversion between `IBoardPosition` / `IMove` and whatever position or move encoding the engine protocol requires.
- `buildPositionSyncCommands(...)` receives ChessVue root-and-moves state, and the client decides whether it can continue the same game line or must establish a fresh game boundary.
- During the rewrite phase, `EngineClient` remains transport-agnostic while `EngineRuntimeService` connects its protocol commands and parsing to the mocked `NW.js`-style `ProcessManager`.
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
buildSessionInitialisationCommands -> emit `uci`, initial readiness commands, and any protocol setup payloads
buildConfigureCommands -> emit `setoption` commands
buildRegistrationCommands -> emit `register later` or `register name ... code ...`
buildPositionSyncCommands -> privately map `IEnginePositionState` into `position startpos moves ...` or `position fen ... moves ...`, plus any `ucinewgame` / `isready` sequence required by the protocol state
buildStartAnalysisCommands -> emit the analysis search command for the current request
buildStopCommands -> emit the protocol stop command
parseOutputLine -> turn `info`, `bestmove`, handshake, ready, copy-protection, and registration lines into typed parse results
```
