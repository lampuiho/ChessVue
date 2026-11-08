# EngineClient

## Purpose
Own the full engine-protocol conversation while hiding protocol-specific details such as UCI strings, handshake ordering and raw engine-output parsing from upper layers.

## Public Interface
```ts
// src/contracts/platform/IEngineClient.ts
interface IEngineClient {
  getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[];
  initialiseEngine(engine: IAssignedEngine): Promise<void>;
  startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: EngineAnalysisUpdateHandler): Promise<void>;
  stopAnalysis(engine: IAssignedEngine): Promise<void>;
  startPlayerTurn(engine: IAssignedEngine, game: IGame): Promise<void>;
  startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMoveRaw, ponderMove: IMoveRaw): Promise<void>;
  awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>;
  stopEngine(engine: IAssignedEngine): Promise<void>;
  restartEngine(engine: IAssignedEngine): Promise<void>;
}

// src/contracts/Engine.ts
type EngineAnalysisUpdateHandler = (update: IEngineAnalysisUpdate) => boolean | void;
```

## Responsibilities
- own protocol session initialisation, readiness handshakes, fixed unlicensed registration deferral, option discovery and application, position commands, and search start or stop
- talk to the engine only through the `IProcess` stored on `engine.$.process`, so upper layers never build or parse raw protocol strings
- translate ChessVue board and move structures into protocol payloads, and engine output into detailed moves and analysis updates, before anything crosses the layer boundary
- return decoded player-search moves and analysis updates to the common `EngineRuntimeService` guards without duplicating application legality checks
- keep each per-engine conversation deterministic through explicit session states that define which output is currently valid
- own client-private runtime state, including the session, its process-listener attachment and a discriminated state context holding only the data valid in that state

## Dependencies
- the `IProcess` stream and event subset
- `UciUtility` command builders and parsers
- `GameRuleUtility` (`cloneBoardPosition`, `genDetailedMoves`, `genLegalMoves`) and `MoveNotationUtility.buildFen`
- `Deferred` for state-owned completions

## Concrete Implementations
| Class | Location | Registered `EngineClientType` | Host hooks |
| --- | --- | --- | --- |
| `UciEngineClientBase` (abstract) | `src/platform/base/UciEngineClientBase.ts` | Supplied by the subclass constructor | Declares `_isProcessOpen` and `_getProcessExitDetail` |
| `NwjsUciEngineClient` | `src/platform/nwjs/NwjsUciEngineClient.ts` | `Uci` | `NwjsUtility.isProcessOpen`; exit detail formats `exitCode` and `signalCode` |
| `BrowserUciEngineClient` | `src/platform/browser/BrowserEngineClient.ts` | `UciWorker` | `BrowserWorkerProcess.closed`; exit detail is its retained `exitDetail` |

- Both clients inherit the same base. The base owns every protocol operation, session state, line buffering, listener cleanup and command writes. Only the two protected hooks differ. **Why:** the browser client previously kept a second copy of the UCI logic and reached its Worker through a transport registry exported by the sibling process manager, which crossed the layer-1 boundary. One base lets both clients read the shared process directly and keeps UCI behaviour identical for both process kinds; parity with the former standalone native client was verified before adoption. A replacement must keep host differences confined to process liveness and exit detail. See [BrowserEngineDependencyFixPlan](../../../ArchivedPlans/BrowserEngineDependencyFixPlan.md#private-inheritance-design).
- The base constructor records the registered `EngineClientType`, and every operation rejects an assignment whose `clientType` differs with `processStartFailed` ("Engine client type is not UCI.").
- The desktop `UciWorker` binding uses `BrowserUciEngineClient` with Worker processes from `NwjsProcessManager`. The client reads the process directly; it imports no process manager, registry or transport.
- Each platform store constructs its clients with `markRaw(new ...)` and returns the same instance through `getEngineClient(...)`. Journeys construct `NwjsUciEngineClient` directly over scripted processes.
- Another protocol or Worker message interface, such as a module API, needs another `EngineClientType` member and its own `IEngineClient` implementation. The protocol switch belongs inside this layer, not in `EngineRuntimeService`, stores or views.

## Session States
The UCI session lives at `engine.$.session` and is private to the client.

| State | Valid output | Completed by |
| --- | --- | --- |
| `Created` | none | `initialiseEngine` sending `uci` |
| `AwaitingUciOk` | `option ...`, `registration error`, `uciok` | `uciok` returns to `Created` while initialisation continues |
| `AwaitingReadyOk` | `readyok` | `readyok` enters `Ready` |
| `Ready` | none | a search or boundary command |
| `Analysing` | `info ...`, `bestmove ...` | final `bestmove` enters `Ready` and emits a final update |
| `FindingMove` | `bestmove ...` | enters `PlayerMoveReady` and resolves the player-move completion |
| `PlayerMoveReady` | none | `awaitPlayerTurnMove` returns the move and enters `Ready` |
| `Pondering` | none; `bestmove` here is a protocol error | `ponderhit` or a stopped search |
| `StoppingSearch` | `bestmove ...` | consuming the stale `bestmove` enters `Ready` |
| `Stopped`, `Failed` | none | terminal; replaced on the next `initialiseEngine` |

- Raw output is routed by session state rather than by whichever parser accepts the line. **Why:** UCI reuses shapes such as `bestmove` for analysis completion, player turns, ponder stops and continuations; syntax alone cannot identify which pending operation may settle. State-owned `Deferred` completions prevent a stale speculative result from satisfying a new turn.
- Positively identified control lines (`bestmove`, `option`, `readyok`, `registration`, `uciok`) that are invalid for the current state set `engine.$.lastError` and fail the session. Unrecognised ancillary output is ignored. An unparsable `info` line during analysis is skipped.
- A terminal transition rejects the pending completion of the current state, clears the game boundary and options, detaches process listeners and clears the session's process reference.
- The client's own process exit listener fails the session with `unexpectedExit`, carrying the host's exit detail, unless the session was already stopped. One process exiting does not affect another assignment.

## Operation Notes
- `initialiseEngine(...)` requires an open process. An initialised session on the same process returns immediately; a session on a replaced process is stopped; a terminal session is replaced. It then attaches listeners, sends `uci`, collects `option` lines until `uciok`, writes each saved option with `setoption`, sends `isready` and waits for `readyok`. Option declarations are parsed into `IEngineOptionMeta` and cached on the session.
- Licensed-engine credentials are out of scope. When a UCI engine reports `registration error`, the client sends `register later` without exposing registration through the generic API.
- `getOptions(...)` returns the cached declarations only after explicit initialisation. They are not copied into engine records or configured option maps. `EngineRuntimeService.getOptions(...)` is the layer-2 discovery boundary that copies them.
- `startAnalysis(...)`, `startPlayerTurn(...)` and `startPondering(...)` require an already initialised session and never initialise implicitly.
- The client decides privately whether a changed game id or root position requires `ucinewgame` followed by `isready`. It compares the game id and the root position's FEN, not the `rootPosition` object identity. **Why:** board editing mutates the root in place, so reference equality cannot detect an effective change. FEN is the protocol projection here; it is unsuitable as the application's structural identity because it also carries move counters.
- `startAnalysis(...)` accepts only `EngineAnalysisSearchMode.Infinite`. Before its first await it captures a detached clone of the rendered position, the analysis commands built from `renderedPath`, the game id, root FEN and the `MultiPV` option command. If analysis is already running it stops that search first. It then applies any game boundary, clears `engine.$.analysisLines`, writes `setoption name MultiPV`, enters `Analysing` and writes `position ...` and `go infinite`. The captured board is the parsing input for the whole search, even after the canonical board changes.
- Analysis updates retain every reported rank in `engine.$.analysisLines`, ordered by engine rank, without selecting the rendered lines; the game subscription performs that selection. When the guarded callback returns `false`, the client restores the previous line for that rank. **Why:** duplicating chess acceptance in each protocol client would let implementations disagree, while exposing raw output would leak UCI parsing upward. `EngineRuntimeService` owns the single acceptance guard.
- `startPlayerTurn(...)` searches the live path. From `Pondering`, `isPonderHit(game, expectedMove)` selects the path: a hit sends `ponderhit`; a miss awaits `_stopSearch(...)`, which sends `stop` and consumes the stale `bestmove`, applies any game boundary and then sends the normal `position ...` and `go ...` commands from `buildFindNextMoveCommands(game)`. Both paths enter one shared `FindingMove` state. The client never inspects a command array to infer state.
- `startPondering(...)` receives the guarded engine move and its ponder move. It builds the position from `game.rootPosition`, every move on `game.livePath`, then those two moves, and sends `go ponder` using the current `game.clockSnapshot`. It does not wait for the engine move to be committed. **Why:** pause may hold an accepted engine move uncommitted, so waiting for `livePath` would block immediate pondering, while retaining a private best move could outlive its turn and compete with game history. The transient move array is an intentional command-construction copy; the client retains only the expected reply for the next hit comparison.
- Untimed games search with `go movetime` using `BuildConfig.engine.untimedMoveTimeMs`; timed games send both clocks and any increment.
- `stopAnalysis(...)` is a no-op in `Ready`; otherwise it requires `Analysing` and drains the search through `StoppingSearch`.
- `stopEngine(...)` requires only that a process reference exists, not that it is open, then stops the session and rejects pending completions. **Why:** it must still clear the session after the physical process has already exited. It never kills the process or clears `engine.$.process`; physical shutdown belongs to `EngineRuntimeService` through `ProcessManager`.
- `restartEngine(...)` stops the session and initialises it again on the current process.
- Every command write checks process liveness through `_isProcessOpen` and rejects a missing `stdin` with `processStartFailed`. Terminal-state checks between writes prevent a delayed write or readiness continuation from reviving a disposed session.

## Ownership Notes
- `EngineClient` acts on the in-game `IAssignedEngine` and the process already bound under `engine.$` by `EngineRuntimeService`. It does not call `ProcessManager`; layer-2 composition keeps process lifecycle and protocol conversation separate so layer-1 modules do not call one another.
- The concrete client refines `engine.$` with a private `session`. The session field is optional until `initialiseEngine(...)` creates it after the base runtime exists. Client-private fields are not part of `IAssignedEngineRuntime` and must not be relied on by upper layers. The shared `analysisLines` map is written by the client and cleared by both the client and `EngineRuntimeService`.
- State is explicit object-attached state on `engine.$`; there are no hidden side tables.
- UCI move strings and engine-facing FEN are engine-boundary details. Move strings are read from or lazily cached in `IMoveRaw.$.uci`; FEN is cached in the position's runtime metadata when the position command is built.
- The runtime ownership breakdown and state-mutation order are defined in [EngineRuntimeOwnership](../../ProcessFlows/EngineRuntimeOwnership.md).
- Flow docs never expose the client's private helpers. Representative private steps are `_attachToProcess`, `_awaitUciOk`, `_awaitReadyOk`, `_prepareGameBoundaryIfNewGame`, `_writeSearchCommands`, `_stopSearch`, `_consumeLine`, `_completeAnalysis`, `_completePlayerMove`, `_parseDetailedBestMove` and `_parseDetailedAnalysisLine`. Protocol encoding shared between clients lives in [UciUtility](../UtilityIndex.md#uciutility).
