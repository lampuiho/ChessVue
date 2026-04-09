# EngineClient

## Purpose
Own the full engine-protocol conversation with the engine while hiding protocol-specific details such as UCI strings, handshake ordering, and raw engine-output parsing from upper layers.

## Public Interface
```ts
initialiseEngine(engine: IAssignedEngine): Promise<void>
registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void>
syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>
startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>
stopAnalysis(engine: IAssignedEngine): Promise<void>
startPlayerTurn(engine: IAssignedEngine): Promise<void>
awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>
stopEngine(engine: IAssignedEngine): Promise<void>
restartEngine(engine: IAssignedEngine): Promise<void>
requiresNewGameBoundary(positionState: IEnginePositionState): boolean
```

## Responsibilities
- own protocol-specific session initialisation, ready handshakes, optional registration, option application, position sync, and search start or stop
- talk to the engine through its own engine-communication boundary so upper layers never build or parse raw protocol strings
- translate ChessVue board and move structures into engine-facing protocol payloads internally
- translate engine output into app-meaningful analysis updates and awaited player moves before anything crosses the layer boundary
- isolate protocol-specific handshakes, move encoding, principal-variation parsing, and new-game-boundary rules from the rest of the architecture
- keep per-engine protocol conversation deterministic even when positions are superseded or searches are restarted

## Dependencies
- host-specific engine communication capability

## Notes
- The baseline implementation targets `UCI`, but callers never compose or parse UCI strings directly.
- If another protocol is ever introduced later, the protocol switch belongs inside `EngineClient`, not in `EngineRuntimeService`, stores, or views.
- `EngineClient` owns conversion between `IBoardPosition` / `IMove` and whatever position or move encoding the engine protocol requires.
- `EngineClient` acts on the in-game `IAssignedEngine` object and any runtime process handle already bound under `engine.$` by `EngineRuntimeService`.
- `syncPosition(...)` receives ChessVue root-and-moves state, and the client decides whether it can continue the same game line or must establish a fresh game boundary.
- During the rewrite phase, `EngineClient` owns the full protocol conversation over mocked `NW.js`-style engine communication hooks.
- `EngineClient` does not call `ProcessManager`; layer-2 composition keeps process lifecycle and protocol conversation separate so layer-1 modules do not call one another.
- UCI move strings and engine-facing FEN are engine-boundary details only; they are derived lazily here and are not part of the canonical data contracts.
- Flow docs never expose `EngineClient` private helpers directly. If `_mapBoardPositionToProtocolPosition` or `_shouldReuseCurrentGameLine` share contract-aware implementation with higher-level engine-position preparation, that implementation is documented under `EnginePositionMappingUtility` in [UtilityIndex.md](../UtilityIndex.md).

Example internal protocol responsibilities:

```text
_sendUciHandshake
_sendSetOption
_sendRegister
_sendPosition
_sendGoInfinite
_sendGoMove
_readAnalysisStream
_readBestMove
_mapProtocolMoveToMove
_mapProtocolPrincipalVariationToMoves
_shouldReuseCurrentGameLine
```
