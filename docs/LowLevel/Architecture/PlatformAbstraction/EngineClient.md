# EngineClient

## Purpose
Own the full engine-protocol conversation with the engine while hiding protocol-specific details such as UCI strings, handshake ordering, and raw engine-output parsing from upper layers.

## Public Interface
```ts
getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[]
initialiseEngine(engine: IAssignedEngine): Promise<void>
startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>
stopAnalysis(engine: IAssignedEngine): Promise<void>
startPlayerTurn(engine: IAssignedEngine, game: IGame): Promise<void>
startPondering(engine: IAssignedEngine, game: IGame, ponderMove: IMove): Promise<void>
awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>
stopEngine(engine: IAssignedEngine): Promise<void>
restartEngine(engine: IAssignedEngine): Promise<void>
```

## Responsibilities
- own protocol-specific session initialisation, ready handshakes, fixed unlicensed registration deferral, option discovery and application, position commands, and search start or stop
- talk to the engine through its own engine-communication boundary so upper layers never build or parse raw protocol strings
- translate ChessVue board and move structures into engine-facing protocol payloads internally
- translate engine output into app-meaningful analysis updates and awaited player moves before anything crosses the layer boundary
- isolate protocol-specific handshakes, move encoding, principal-variation parsing, and new-game-boundary rules from the rest of the architecture
- keep each per-engine protocol conversation deterministic through explicit session states that define which output is currently valid
- own client-private runtime state for the concrete engine conversation, including optional session initialisation, process-listener attachment, current search position, expected ponder move, and pending player-turn state

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
- That client-private refinement may include fields such as a protocol session object, current search position, expected ponder move, attached listener references, or pending player-move state.
- Those client-private fields remain internal to the concrete client implementation. They are not part of the shared `IAssignedEngineRuntime` contract and must not be relied on by upper layers.
- `session` is optional until `initialiseEngine(...)` creates and initialises it after base runtime state already exists.
- `initialiseEngine(...)` collects option declarations emitted during the protocol handshake. `getOptions(...)` exposes the cached declarations only after that explicit initialisation completes.
- Returned option metadata uses the protocol-neutral `IEngineOptionMeta` contract. It is not automatically copied into engine records or configured option maps.
- `startAnalysis(...)`, `startPlayerTurn(...)`, and `startPondering(...)` receive the canonical `IGame`, derive their purpose-specific position and search commands, and require an already initialised session. They must not initialise the engine implicitly.
- Licensed-engine credentials are out of scope. When a UCI engine reports `registration error`, the UCI client responds with `register later` without exposing registration through the generic client API.
- Client-private runtime state is created only through explicit mutation steps. The concrete UCI client uses session-state transitions, process-listener attachment, analysis-line storage, pending player-turn completion, and explicit reset or failure helpers.
- The default runtime design here is explicit object-attached state. It does not use hidden side tables.
- The runtime ownership breakdown and state-mutation order are defined in [../../ProcessFlows/EngineRuntimeOwnership.md](../../ProcessFlows/EngineRuntimeOwnership.md).
- `startAnalysis(...)` uses the rendered path. Player-turn and ponder operations use the live path. The client privately decides whether a changed game id or root position requires a fresh protocol game boundary.
- `startPondering(...)` starts a speculative search for the supplied reply after a player-engine result includes a ponder move. On the next turn, `startPlayerTurn(...)` emits `ponderhit` when that reply matches the latest live move; otherwise it sends `stop`, consumes the terminating stale `bestmove`, and only then starts a fresh position search.
- Raw output is routed by session state rather than by whichever parser happens to accept the line. Expected handshake, analysis, player-move, and search-stop responses complete only their matching state transition.
- During the rewrite phase, `EngineClient` owns the full protocol conversation over mocked `NW.js`-style engine communication hooks.
- `EngineClient` does not call `ProcessManager`; layer-2 composition keeps process lifecycle and protocol conversation separate so layer-1 modules do not call one another.
- UCI move strings and engine-facing FEN are engine-boundary details only. Move strings are read from or lazily cached in `IMove.$.uci`; FEN is derived when the position command is built.
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
