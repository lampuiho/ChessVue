# EngineClient

## Purpose
Own the full engine-protocol conversation with the engine while hiding protocol-specific details such as UCI strings, handshake ordering, and raw engine-output parsing from upper layers.

## Public Interface
```ts
getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[]
initialiseEngine(engine: IAssignedEngine): Promise<void>
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
- own protocol-specific session initialisation, ready handshakes, fixed unlicensed registration deferral, option discovery and application, position sync, and search start or stop
- talk to the engine through its own engine-communication boundary so upper layers never build or parse raw protocol strings
- translate ChessVue board and move structures into engine-facing protocol payloads internally
- translate engine output into app-meaningful analysis updates and awaited player moves before anything crosses the layer boundary
- isolate protocol-specific handshakes, move encoding, principal-variation parsing, and new-game-boundary rules from the rest of the architecture
- keep per-engine protocol conversation deterministic even when positions are superseded or searches are restarted
- own client-private runtime state for the concrete engine conversation, including optional session initialisation, process-listener attachment, current synced position, and pending player-turn state

## Dependencies
- host-specific engine communication capability

## Notes
- `PlatformService` selects the concrete implementation through `EngineClientType`.
- The baseline implementation targets `UCI`, but callers never compose or parse UCI strings directly.
- The current NW.js concrete implementation is `NwjsUciEngineClient` for `EngineClientType.Uci`.
- If another protocol is ever introduced later, the protocol switch belongs inside `EngineClient`, not in `EngineRuntimeService`, stores, or views.
- `EngineClient` owns conversion between `IBoardPosition` / `IMove` and whatever position or move encoding the engine protocol requires.
- `EngineClient` acts on the in-game `IAssignedEngine` object and any runtime process handle already bound under `engine.$` by `EngineRuntimeService`.
- Concrete clients may narrow `IAssignedEngine` to protocol-specific subtypes and refine `engine.$` with richer client-private runtime state.
- That client-private refinement may include fields such as a protocol session object, current synced position, attached listener references, or pending player-move state.
- Those client-private fields remain internal to the concrete client implementation. They are not part of the shared `IAssignedEngineRuntime` contract and must not be relied on by upper layers.
- `session` is optional until `initialiseEngine(...)` creates and initialises it after base runtime state already exists.
- `initialiseEngine(...)` collects option declarations emitted during the protocol handshake. `getOptions(...)` exposes the cached declarations only after that explicit initialisation completes.
- Returned option metadata uses the protocol-neutral `IEngineOptionMeta` contract. It is not automatically copied into engine records or configured option maps.
- `syncPosition(...)`, `startAnalysis(...)`, and `startPlayerTurn(...)` require an already initialised session and must not initialise the engine implicitly.
- Licensed-engine credentials are out of scope. When a UCI engine reports `registration error`, the UCI client responds with `register later` without exposing registration through the generic client API.
- Client-private runtime state is created only through explicit mutation steps. Suggested owner-private names include `_initialiseAssignedEngineSession`, `_attachProcessListeners`, `_detachProcessListeners`, `_storeSyncedPositionState`, `_clearAnalysisState`, `_storeAnalysisSlot`, `_createPendingPlayerTurn`, `_clearPendingPlayerTurn`, `_resetSessionAfterStop`, and `_resetSessionAfterFailure`.
- The default runtime design here is explicit object-attached state. It does not use hidden side tables.
- The runtime ownership breakdown and state-mutation order are defined in [../../ProcessFlows/EngineRuntimeOwnership.md](../../ProcessFlows/EngineRuntimeOwnership.md).
- `syncPosition(...)` receives ChessVue root-and-moves state, and the client decides whether it can continue the same game line or must establish a fresh game boundary.
- During the rewrite phase, `EngineClient` owns the full protocol conversation over mocked `NW.js`-style engine communication hooks.
- `EngineClient` does not call `ProcessManager`; layer-2 composition keeps process lifecycle and protocol conversation separate so layer-1 modules do not call one another.
- UCI move strings and engine-facing FEN are engine-boundary details only; they are derived lazily here and are not part of the canonical data contracts.
- Flow docs never expose `EngineClient` private helpers directly. If `_mapBoardPositionToProtocolPosition` or `_shouldReuseCurrentGameLine` ever become meaningfully shared with higher-level engine-position preparation, that shared behaviour should be documented in [UtilityIndex.md](../UtilityIndex.md); until then those helpers remain owner-private.

Example internal protocol responsibilities:

```text
_sendUciHandshake
_sendSetOption
_sendRegisterLater
_sendPosition
_sendGoInfinite
_sendGoMove
_readAnalysisStream
_readBestMove
_mapProtocolMoveToMove
_mapProtocolPrincipalVariationToMoves
_shouldReuseCurrentGameLine
```
