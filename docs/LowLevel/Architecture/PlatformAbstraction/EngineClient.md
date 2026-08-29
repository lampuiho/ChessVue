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
startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMove, ponderMove: IMove): Promise<void>
awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>
stopEngine(engine: IAssignedEngine): Promise<void>
restartEngine(engine: IAssignedEngine): Promise<void>
```

## Responsibilities
- own protocol-specific session initialisation, ready handshakes, fixed unlicensed registration deferral, option discovery and application, position commands, and search start or stop
- talk to the engine through its own engine-communication boundary so upper layers never build or parse raw protocol strings
- translate ChessVue board and move structures into engine-facing protocol payloads internally
- translate engine output into app-meaningful analysis updates and awaited player moves before anything crosses the layer boundary
- return decoded player-search moves to the common `EngineRuntimeService.awaitPlayerTurnMove` guard without duplicating application legality checks
- isolate protocol-specific handshakes, move encoding, principal-variation parsing, and new-game-boundary rules from the rest of the architecture
- keep each per-engine protocol conversation deterministic through explicit session states that define which output is currently valid
- own client-private runtime state for the concrete engine conversation, including session initialisation, process-listener attachment, and a discriminated state context containing only the data valid for that protocol state

## Dependencies
- host-specific engine communication capability

## Notes
- `PlatformService` selects the concrete implementation through `EngineClientType`.
- The baseline implementation targets `UCI`, but callers never compose or parse UCI strings directly.
- The current NW.js concrete implementation is `NwjsUciEngineClient` for `EngineClientType.Uci`.
- If another protocol is ever introduced later, the protocol switch belongs inside `EngineClient`, not in `EngineRuntimeService`, stores, or views.
- `EngineClient` owns conversion between `IBoardPosition` / `IMove` and whatever position or move encoding the engine protocol requires, then returns protocol-neutral moves to the common `EngineRuntimeService.awaitPlayerTurnMove(...)` legality guard. **Why:** duplicating chess acceptance in each protocol client would allow implementations to disagree, while exposing raw output above this layer would leak UCI parsing and state into domain/state code. A new protocol may change syntax but must preserve this boundary.
- `EngineClient` acts on the in-game `IAssignedEngine` object and any runtime process handle already bound under `engine.$` by `EngineRuntimeService`.
- Concrete clients may narrow `IAssignedEngine` to protocol-specific subtypes and refine `engine.$` with richer client-private runtime state.
- That client-private refinement may include a protocol session object whose discriminated context owns the current search position, expected ponder move, handshake or stop completion, or pending player move only while its corresponding state is active.
- Those client-private fields remain internal to the concrete client implementation. They are not part of the shared `IAssignedEngineRuntime` contract and must not be relied on by upper layers.
- `session` is optional until `initialiseEngine(...)` creates and initialises it after base runtime state already exists.
- `initialiseEngine(...)` collects option declarations emitted during the protocol handshake. `getOptions(...)` exposes the cached declarations only after that explicit initialisation completes.
- Returned option metadata uses the protocol-neutral `IEngineOptionMeta` contract. It is not automatically copied into engine records or configured option maps.
- `startAnalysis(...)`, `startPlayerTurn(...)`, and `startPondering(...)` receive the canonical `IGame`, derive their purpose-specific position and search commands, and require an already initialised session. They must not initialise the engine implicitly.
- Licensed-engine credentials are out of scope. When a UCI engine reports `registration error`, the UCI client responds with `register later` without exposing registration through the generic client API.
- Client-private runtime state is created only through explicit mutation steps. The concrete UCI client uses session-state transitions, process-listener attachment, analysis-line storage, state-owned completions, and terminal-session replacement rather than clearing a bag of optional fields.
- The default runtime design here is explicit object-attached state. It does not use hidden side tables.
- The runtime ownership breakdown and state-mutation order are defined in [../../ProcessFlows/EngineRuntimeOwnership.md](../../ProcessFlows/EngineRuntimeOwnership.md).
- `startAnalysis(...)` uses the rendered path and player-turn search uses the live path. The client privately decides whether a changed game id or root position requires a fresh protocol game boundary.
- The UCI new-game boundary compares the game id and the root position's FEN value, not the `rootPosition` object identity. **Why:** board editing mutates the root in place, so reference equality cannot detect an effective change. FEN is appropriate here as the protocol projection, but remains unsuitable as the application's general structural identity because it also carries notation counters.
- `startPondering(...)` receives both the guarded engine move and its supplied ponder move. It builds the position from `game.rootPosition`, every move already represented by `game.livePath`, then the two supplied moves; it does not require commit first. **Why:** pause permits an accepted engine move to remain uncommitted, so waiting for `livePath` would prevent immediate pondering, while retaining the best move privately could outlive its turn and compete with game history.
- The transient array containing the preceding live sequence plus the two supplied moves is an intentional command-construction copy. **Why:** the protocol needs one stable payload without mutating the authoritative path or tree. The client retains only the expected opponent reply needed for the next hit comparison, not a player-search best move or committed-move history.
- Pondering uses the current `game.clockSnapshot`, which may still be pre-commit because the runtime begins the search immediately. On the next turn, `isPonderHit(game, expectedMove)` selects the path from the `Pondering` state. A hit selects the contextual `buildFindNextMoveCommands(game, expectedMove)` result. A miss awaits `_stopSearch(...)`, which sends `stop` and consumes the terminating stale `bestmove`, then follows the normal boundary path and calls `buildFindNextMoveCommands(game)` against the current root and live path. Both paths then use one shared `FindingMove` setup and result handler.
- Raw output is routed by session state rather than by whichever parser happens to accept the line. Expected handshake, analysis, player-move, and search-stop responses complete only their matching state transition. **Why:** UCI reuses shapes such as `bestmove` for analysis completion, player turns, ponder stops, and continuations; syntax alone cannot identify which pending operation may settle. Separate state-owned deferreds prevent a stale speculative result from satisfying a new turn.
- Command builders produce contextual payloads and do not decide session transitions. The UCI player-turn path selects hit or miss from the current state and `isPonderHit(...)`; it never inspects `ponderhit`, `stop`, or a command-array position to infer state.
- `EngineClient` owns the full protocol conversation over `NW.js`-style engine communication hooks.
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
