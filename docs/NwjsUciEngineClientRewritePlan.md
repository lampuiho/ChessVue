# Nwjs Uci Engine Client Rewrite Plan

## Status

Proposed for review. This document plans the rewrite only; it does not describe completed implementation.

## Objective

Rewrite `NwjsUciEngineClient` as an explicit event-driven UCI session state machine. The current client has named states, but state data and transition work are spread across public methods, output handlers, generic command helpers, and optional session fields. In particular, `startPlayerTurn(...)` examines the first generated command to decide whether a ponder search hit or missed. Command text must be an effect of a transition, never evidence used to select the transition.

The rewrite must preserve the protocol-neutral engine boundary and observable engine behaviour while making legal states, legal transitions, command ordering, and pending completions explicit.

## Decisions

1. The public `IEngineClient` interface remains unchanged.
2. `EngineRuntimeService`, game state, callers, and persisted contracts do not gain UCI concepts.
3. `UciSessionState` remains the enum of state identifiers. The private session stores a separate discriminated context union so state-owned data replaces unrelated optional session fields.
4. Public client operations and parsed engine output become typed machine events.
5. A transition returns the next state and ordered effects. Effects include sending commands, publishing analysis, and resolving or rejecting operation completions.
6. State is installed before command effects run, so immediate engine output is routed through the destination state.
7. Ponder hit or miss is decided from `Pondering.expectedMove` and the requested live line through the same pure predicate used by `buildFindNextMoveCommands(...)`. Neither outgoing command text nor an array index is inspected.
8. On a ponder miss, `startPlayerTurn(...)` calls and awaits `_stopSearch(...)`. After `_stopSearch(...)` consumes the stale `bestmove`, the miss selects fresh next-move commands from the current game.
9. Ponder hit and miss then join one shared `FindingMove` tail. Both clear the expected ponder move, capture the current live position, create the player completion, enter `FindingMove`, send their selected commands, and use identical `bestmove` handling.
10. Purpose-level command builders run when their corresponding machine transition starts. The public async operation retains its canonical `IGame` argument while awaiting an intermediate stop or ready transition; the session does not store a prebuilt follow-up command batch.
11. Terminal or replaced sessions are disposed and replaced rather than reset by clearing a large collection of optional fields.
12. The state machine is specific to the UCI client. No generic state-machine framework is introduced.

## API Impact

### Protocol-neutral public API

No change is planned to `IEngineClient`:

```ts
getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[];
initialiseEngine(engine: IAssignedEngine): Promise<void>;
startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>;
stopAnalysis(engine: IAssignedEngine): Promise<void>;
startPlayerTurn(engine: IAssignedEngine, game: IGame): Promise<void>;
startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMove, ponderMove: IMove): Promise<void>;
awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>;
stopEngine(engine: IAssignedEngine): Promise<void>;
restartEngine(engine: IAssignedEngine): Promise<void>;
```

The following also remain unchanged:

- `defineNwjsUciEngineClientStore(...)` remains the NW.js composition entry point.
- `EngineRuntimeService` continues to own process lifecycle, availability, legality validation, and guarded ponder startup.
- `IGame`, `IAssignedEngine`, `IAssignedEngineRuntime`, move contracts, and persistence schemas remain unchanged.
- UCI command strings and parsed protocol records remain private to the concrete client and utilities.

### Internal TypeScript API

The existing `buildFindNextMoveCommands(game, expectedPonderMove?)` signature and behaviour remain unchanged:

- Without an expected ponder move, it returns a fresh `position` plus timed `go` search.
- With a matching expected ponder move, it returns `ponderhit` because that is the next-move command for the current ponder state.
- With a mismatching expected ponder move, it returns `stop` because the speculative search must finish before a fresh next-move search starts.

The builder continues to return the commands required by the supplied next-move context. The client stops interpreting those returned strings. A normal search calls it without an expected move, and a ponder hit calls it with the expected move. A ponder miss is selected from state and the shared predicate, then handled by `_stopSearch(...)`, whose fixed responsibility is sending `buildStopCommand()` and awaiting the terminating `bestmove`.

To keep matching logic in one place, promote the existing private ponder-match logic to a named pure predicate such as `isPonderHit(game, expectedPonderMove)`. Both the state transition and `buildFindNextMoveCommands(...)` use that predicate. This adds an internal helper but does not change the existing command-builder API.

A single-line UCI output classifier may also be added so the machine receives typed output events instead of repeating string-prefix checks. These remain repository-internal additions; no upper layer is affected.

### Behavioural contract

The externally observable operation timing remains:

- `initialiseEngine(...)` resolves after `uciok`, configured options, `isready`, and `readyok` complete.
- `startAnalysis(...)` resolves once the analysis search has actually been started.
- Replacing an active analysis first stops and consumes that search, then starts the replacement.
- `stopAnalysis(...)` resolves after the terminating `bestmove` is consumed.
- `startPlayerTurn(...)` resolves after a fresh search or ponder hit is armed. On a ponder miss, it awaits the stale ponder `bestmove`, then starts the normal fresh search before resolving.
- `awaitPlayerTurnMove(...)` resolves only with the result belonging to the armed player search.
- `startPondering(...)` resolves after the ponder search commands are sent.
- `stopEngine(...)` rejects outstanding operation completions and detaches the process listener.

## Current Problems To Remove

### Command text selects state

The current ponder flow calls `buildFindNextMoveCommands(game, expectedPonderMove)` and then checks whether `commands[0] === 'ponderhit'`. This reverses the intended dependency:

```text
Current state + event -> transition decision -> commands
```

The current implementation effectively does this:

```text
Current state -> commands -> inspect command text -> transition decision
```

### State data is not state-owned

`IUciSession` currently permits invalid combinations because these fields are independently optional:

- `position`
- `expectedPonderMove`
- `playerMoveDeferred`
- `stateDeferred`
- handshake `optionLines`
- process and listener fields

For example, TypeScript cannot prevent a `Ready` session from retaining an expected ponder move or an `Analysing` session from lacking its searched position.

### Search helpers own too little transition meaning

`_stopSearch(session, state, command)` accepts information it should own. A stop helper should not be told which stopping state or command to use. `_stopSearch(engine, session)` requires an active search, installs the single `StoppingSearch` state, sends `buildStopCommand()`, and awaits the terminating `bestmove`. Analysis and ponder do not need different stopping states because their stop protocol and output handling are identical. `_startSearch(...)` should likewise be narrowed or replaced by state-specific start helpers so arbitrary active states and commands cannot be paired.

### Transition completion is duplicated

Handshake and stop flows manually assign an awaiting state, create a shared `stateDeferred`, let the line handler update the state, and then assign a separately supplied resolved state again. The deferred describes neither the operation nor its legal destination.

### Reset and failure logic duplicate cleanup

Stop, failure, and reset helpers repeatedly clear the same optional fields. Adding another state-owned value risks missing one cleanup path.

## Proposed File Structure

### `src/platform/nwjs/NwjsUciEngineClient.ts`

Keep this as the Pinia-facing concrete `IEngineClient` adapter. It should own:

- narrowing and validating `IAssignedEngine` runtime state;
- locating the current process handle and process;
- creating, retrieving, replacing, and disposing the private UCI session machine;
- detecting process replacement;
- forwarding public `IEngineClient` calls to the session machine;
- exposing discovered option metadata.

It should not contain the transition switch, search-specific command sequencing, or raw line routing.

### `src/platform/nwjs/NwjsUciSessionMachine.ts`

Add a focused module containing:

- private session state types;
- state-specific operation completion types;
- input event and effect types;
- transition selection;
- command-effect execution;
- UCI line consumption;
- state-owned completion handling;
- terminal failure and disposal.

The module remains private to the NW.js UCI client and is not exported through a platform or contract barrel.

The session can use injected host functions for command writes, runtime analysis publication, and failure reporting. This keeps process-registry lookup in the client adapter while allowing state transitions to be tested without a Pinia store.

### `src/utility/UciUtility.ts`

Keep deterministic UCI formatting and parsing here:

- fixed command construction;
- position and timed-search command construction;
- best-move, information, option, and move parsing;
- optional raw-line classification into typed UCI output records.

It must not retain a session, choose a session transition, resolve a deferred, or interpret its own returned command strings.

## Session Structure

The exact names may be adjusted during implementation, but the ownership should follow this shape:

```ts
interface IUciSession {
  readonly process: ISpawnedProcess;
  readonly processHandle: ProcessHandle;
  readonly detachProcessListeners: () => void;
  current: UciSessionContext;
  options: readonly IEngineOptionMeta[];
  gameBoundary?: IUciGameBoundary;
}
const enum UciSessionState {
  Created = 'created',
  AwaitingUciOk = 'awaitingUciOk',
  AwaitingReadyOk = 'awaitingReadyOk',
  Ready = 'ready',
  Analysing = 'analysing',
  FindingMove = 'findingMove',
  PlayerMoveReady = 'playerMoveReady',
  Pondering = 'pondering',
  StoppingSearch = 'stoppingSearch',
  Stopped = 'stopped',
  Failed = 'failed',
}
type UciSessionContext =
  | IUciCreatedSessionContext
  | IUciAwaitingUciOkSessionContext
  | IUciAwaitingReadyOkSessionContext
  | IUciReadySessionContext
  | IUciAnalysingSessionContext
  | IUciFindingMoveSessionContext
  | IUciPlayerMoveReadySessionContext
  | IUciPonderingSessionContext
  | IUciStoppingSearchSessionContext
  | IUciStoppedSessionContext
  | IUciFailedSessionContext;
```

Each context interface contains a discriminating `state: UciSessionState.<value>` field and its required state-owned data. Stable session fields describe the process conversation, and changing state atomically replaces `session.current`.

### State-owned data

| State | Required data |
| --- | --- |
| `Created` | Initialisation completion or no operation yet |
| `AwaitingUciOk` | Initialisation completion and collected option lines |
| `AwaitingReadyOk` | Completion for the public flow awaiting `readyok` |
| `Ready` | No search-only data |
| `Analysing` | Searched position and analysis request/context |
| `FindingMove` | Searched live position and player-move completion |
| `PlayerMoveReady` | Parsed detailed move waiting to be consumed |
| `Pondering` | Expected opponent move and ponder search identity |
| `StoppingSearch` | Completion awaiting the active search's terminating `bestmove` |
| `Stopped` | Terminal reason |
| `Failed` | Terminal error |

`PlayerMoveReady` is intentional. An engine can return `bestmove` before `awaitPlayerTurnMove(...)` is called. Keeping the completed move in an explicit state preserves that result without returning the session to an ambiguous `Ready` state that also carries an optional resolved deferred.

## Operation Inputs And Intermediate Waits

Public methods retain their normal arguments in async function scope. An intermediate protocol state owns only the completion needed to await its expected terminal output. After that state reaches `Ready`, the public method continues through the ordinary next step using the current canonical inputs.

### Analysis operation

`startAnalysis(...)` retains the canonical game, analysis request, and callback. If analysis is already running, it awaits `StoppingSearch -> Ready`, then performs the same boundary and analysis-start flow used from an initially ready session.

### Player-turn operation

From `Ready`, `startPlayerTurn(...)` selects `buildFindNextMoveCommands(game)`. From `Pondering`, it first selects hit or miss from state and the shared predicate. A hit selects `buildFindNextMoveCommands(game, expectedMove)` to obtain `ponderhit`. A miss awaits `_stopSearch(engine, session)`, applies the normal ready/game-boundary path, and selects `buildFindNextMoveCommands(game)` from the current game. After command selection, hit and miss execute the same `FindingMove` setup and output flow.

### Ponder operation

`startPondering(...)` retains its canonical game, engine move, and expected opponent reply while applying the ready boundary, then calls `buildPonderMoveCommands(game, engineMove, ponderMove)`.

The speculative result still has no decodable session position because it must be discarded unless `ponderhit` converts it into the next player search.

## Machine Events

### Public-operation events

```text
Initialise
StartAnalysis(request)
StopAnalysis(completion)
StartPlayerTurn(request)
StartPondering(request)
AwaitPlayerMove(completion)
StopSession(reason)
```

`restartEngine(...)` remains client orchestration: dispose the current session, replace or reuse the process according to existing runtime ownership, create a new session, and dispatch `Initialise`.

### Engine-output events

```text
UciOk
ReadyOk
RegistrationError
OptionLine(raw)
InfoLine(raw)
BestMoveLine(raw)
AncillaryLine(raw)
```

### Host events

```text
ProcessExited(code, signal)
CommandWriteFailed(error)
Dispose(reason)
```

Raw line classification must not decide which pending operation receives the record. The current state owns that decision.

## Machine Effects

A transition may emit ordered effects:

```text
SendCommand(command)
SendCommands(commands)
PublishAnalysis(update)
ResolveOperation(completion, value?)
RejectOperation(completion, error)
ReportFailure(error)
DetachProcessListeners
```

The effect runner sends a command batch sequentially. A write failure dispatches or directly performs one terminal failure transition; it must not leave the machine in an operational state.

Transitions install their destination state before running send effects. This is necessary because mocked and real engines may respond immediately after a write.

## Transition Table

### Initialisation

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Created` | `Initialise` | `AwaitingUciOk` | Send `uci` |
| `AwaitingUciOk` | `OptionLine` | `AwaitingUciOk` | Append to state-owned option lines |
| `AwaitingUciOk` | `RegistrationError` | `AwaitingUciOk` | Send `register later` |
| `AwaitingUciOk` | `UciOk` | `AwaitingReadyOk` | Parse options, send configured `setoption` commands, then `isready` |
| `AwaitingReadyOk` | `ReadyOk` | `Ready` | Resolve the state-owned ready completion |

The public initialisation or game-boundary flow resumes after the ready completion resolves.

### Game-boundary preparation

Starting analysis, player, or ponder work from `Ready` first compares the current game boundary with the session boundary:

- If unchanged, transition directly into the search state and send its commands.
- If changed, enter `AwaitingReadyOk`, send `ucinewgame` followed by `isready`, and await `readyok`.
- After `AwaitingReadyOk -> Ready`, the public method continues into the same search-start path.

The session boundary is committed when the ready barrier succeeds, not before command writes succeed.

### Analysis

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Ready` | `StartAnalysis` | `Analysing` or temporarily `AwaitingReadyOk` | Await boundary if needed, call the analysis builders, send their commands |
| `Analysing` | `InfoLine` | `Analysing` | Parse and publish an incremental update |
| `Analysing` | `BestMoveLine` | `Ready` | Parse final move, publish final update |
| `Analysing` or `Pondering` | Stop active search | `StoppingSearch` | Await `_stopSearch(engine, session)`, which sends `buildStopCommand()` and waits for `bestmove` |
| `StoppingSearch` | `BestMoveLine` | `Ready` | Discard the stopped result and resolve the stop completion |
| `Ready` | `StopAnalysis` | `Ready` | Resolve as a no-op |

Starting replacement analysis first follows `Analysing -> StoppingSearch -> Ready`, then the same public method continues through the normal `Ready -> Analysing` path.

### Fresh player search

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Ready` | `StartPlayerTurn` | `FindingMove` or temporarily `AwaitingReadyOk` | Await boundary if needed, call `buildFindNextMoveCommands(game)`, send its commands |
| `FindingMove` | `BestMoveLine` | `PlayerMoveReady` | Parse detailed move and resolve an existing waiter if present |
| `FindingMove` | `AwaitPlayerMove` | `FindingMove` | Register the single waiter |
| `PlayerMoveReady` | `AwaitPlayerMove` | `Ready` | Resolve immediately with the stored move |

The implementation may represent the move completion as one object created by `StartPlayerTurn` and awaited later. The essential invariant is that the completion belongs only to the current `FindingMove`/`PlayerMoveReady` operation and cannot be satisfied by a stop acknowledgement.

### Ponder start

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Ready` | `StartPondering` | `Pondering` or temporarily `AwaitingReadyOk` | Await boundary if needed, call `buildPonderMoveCommands(...)`, send its commands |
| `Pondering` | `InfoLine` or ancillary output | `Pondering` | Ignore |
| `Pondering` | `BestMoveLine` | `Failed` | Report protocol violation; ponder must wait for hit or stop |

### Ponder hit, miss, and shared finding flow

```text
StartPlayerTurn(game)
  -> current state is Pondering
  -> classify the latest live move with the shared ponder predicate

hit command selection
  -> moveCommands = buildFindNextMoveCommands(game, Pondering.expectedMove)

miss command selection
  -> await _stopSearch(engine, session)
     -> install StoppingSearch
     -> send buildStopCommand()
     -> wait for and discard BestMoveLine(stale ponder result)
     -> enter Ready and return
  -> follow the normal Ready/game-boundary path
  -> moveCommands = buildFindNextMoveCommands(game), using the current root and live path

shared hit/miss tail
  -> clear expectedPonderMove
  -> read and store the current live position
  -> create the player-move completion
  -> install FindingMove
  -> send moveCommands
  -> route bestmove through the same FindingMove handler
```

No code checks the returned string or command-list position. The only hit/miss differences are command selection and the miss's awaited stop; everything after that joins the shared tail.

This makes the required ordering structural:

```text
stop -> stale bestmove -> [ucinewgame -> isready -> readyok, when needed] -> position -> go
```

### Stop and failure

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| Any non-terminal state | `StopSession` | `Stopped` | Reject owned completions, detach listeners |
| Any non-terminal state | Process exit or write/protocol failure | `Failed` | Reject owned completions, detach listeners, report `lastError` |
| `Stopped` or `Failed` | Dispose again | Same terminal state | No-op |

Only the active state can own an intermediate or player-move completion, so terminal cleanup rejects that state-owned work instead of clearing unrelated optional fields.

## Public Function Flow

### `initialiseEngine(engine)`

1. Require the base engine runtime and process handle.
2. Resolve the registered process.
3. If an operational session is already attached to the same process, return.
4. If a session belongs to another process or is terminal, dispose it and replace it.
5. Create the session machine and attach line/exit listeners.
6. Dispatch `Initialise` and await its completion.
7. The machine performs `uci`, option collection/application, `isready`, and `readyok` transitions.

### `getOptions(engine)`

1. Require an operational, initialised session.
2. Return its immutable discovered option collection.

### `startAnalysis(engine, game, request, onUpdate)`

1. Validate supported search mode.
2. Require an initialised session.
3. If already analysing, `await _stopSearch(engine, session)`; it enters `StoppingSearch`, sends `buildStopCommand()`, and waits for the terminating `bestmove`.
4. Require the resulting `Ready` state.
5. Await the normal game-boundary ready barrier when required.
6. Read the rendered position, call the analysis builders, enter `Analysing`, and send their commands.

### `stopAnalysis(engine)`

1. Require an initialised session.
2. Return immediately in `Ready`.
3. Require `Analysing` otherwise.
4. `await _stopSearch(engine, session)`; it enters `StoppingSearch`, sends `buildStopCommand()`, and waits for the terminating `bestmove`.

### `startPlayerTurn(engine, game)`

1. Require an initialised session.
2. If `Pondering`, classify hit or miss from state data and the live line.
3. On a hit, select `moveCommands = buildFindNextMoveCommands(game, expectedMove)`.
4. On a miss, `await _stopSearch(engine, session)`, follow the normal ready/game-boundary path, then select `moveCommands = buildFindNextMoveCommands(game)` using the current root and live path.
5. From an initially `Ready` state, follow the same normal game-boundary path and select `moveCommands = buildFindNextMoveCommands(game)`.
6. After command selection, all paths share the same tail: clear the expected ponder move, read the current live position, create the player-move completion, enter `FindingMove`, and send `moveCommands`.
7. All paths then use the same `FindingMove` output handler and `awaitPlayerTurnMove(...)` flow.
8. Any other operational state rejects with a state error.

### `awaitPlayerTurnMove(engine)`

1. Require the session to own the current player operation.
2. If it is `FindingMove`, await that operation's completion.
3. If it is `PlayerMoveReady`, consume the stored result immediately.
4. Complete the transition to `Ready` exactly once.
5. Reject when no player turn is active.

### `startPondering(engine, game, engineMove, ponderMove)`

1. Require `Ready`.
2. Await the normal game-boundary ready barrier when required.
3. Retain the expected reply in `Pondering` state.
4. Call `buildPonderMoveCommands(game, engineMove, ponderMove)` and send its commands.

### `stopEngine(engine)`

1. Preserve the existing process-handle validation contract.
2. Dispose the private session if present.
3. Reject the completion owned by the current state.
4. Detach listeners and enter `Stopped`.

### `restartEngine(engine)`

1. Stop/dispose the current client session.
2. Follow existing runtime/process ownership for process replacement.
3. Create a new session object rather than resetting the old state's fields.
4. Run normal initialisation.

## Output Routing Rules

- Empty and ancillary lines are ignored.
- `option` and `registration error` are meaningful only while awaiting `uciok`.
- `uciok` is meaningful only in `AwaitingUciOk`.
- `readyok` is meaningful only in `AwaitingReadyOk`.
- Analysis `info` is parsed and published only in `Analysing`; ordinary search information remains ignored.
- `bestmove` completes analysis, a player search, or a stopped search according to state.
- A `bestmove` in `StoppingSearch` is discarded, enters `Ready`, and resolves only the stop completion.
- A `bestmove` while still `Pondering` is a protocol failure.
- A recognised control event in an invalid state fails the session.
- Syntax alone never identifies which completion may be resolved.

## Error Handling

### Request validation errors

Unsupported modes are rejected before dispatch. Missing runtime positions, invalid paths, missing clocks, and command-building errors are checked when the public flow invokes its purpose-level builder. A failure rejects that operation and follows the existing session failure policy.

### Illegal operation errors

The transition table produces the existing style of error:

```text
Cannot <operation> while UCI session state is <state>.
```

Where helpful, state names include the explicit `PlayerMoveReady` and `StoppingSearch` substates.

### Protocol errors

Malformed records or recognised records that are illegal in the current state enter `Failed`, update `engine.$.lastError`, reject current work, and detach listeners.

### Write and process errors

A command-write failure or unexpected process exit enters `Failed` once. Completion rejection and listener detachment must be idempotent so a later exit event does not replace the original error or reject work twice.

## Concurrency And Ordering Invariants

1. A public event synchronously claims its destination state before its first command is written.
2. Only one player-move completion exists per `StartPlayerTurn` event.
3. Only `FindingMove` can populate that player result.
4. `StoppingSearch` always discards its terminating `bestmove`.
5. A public flow cannot continue until its intermediate state completion receives the expected output.
6. Command batches are written in array order and stop at the first failure.
7. `AwaitingReadyOk` carries exactly one ready completion.
8. A second incompatible public operation is rejected by current state rather than interleaving command batches.
9. Terminal transitions are idempotent.
10. A session is tied to one process identity for its lifetime.

## Testing Plan

### Characterisation before structural replacement

Keep the existing tests passing and split the combined lifecycle test into focused cases where useful:

- initialisation and option metadata;
- analysis streaming and natural completion;
- explicit analysis stop;
- ordinary player search;
- ponder start;
- ponder hit;
- ponder miss and stale-result disposal;
- process replacement and restart;
- missing session and missing game runtime positions;
- changed root/game boundary;
- deferred registration.

### State-machine unit tests

Add direct tests using an injected command writer and analysis/failure callbacks:

1. `Created -> AwaitingUciOk -> AwaitingReadyOk -> Ready`.
2. Option lines belong to the handshake state and are cleared by leaving it.
3. Registration error sends `register later` without changing state.
4. Changed game boundary resolves only after `readyok`, after which the same public operation continues.
5. Same boundary starts a search directly.
6. Analysis `info` publishes only while analysing.
7. Natural analysis `bestmove` returns to ready and publishes a final update.
8. Analysis replacement awaits `StoppingSearch -> Ready` before following the normal analysis-start path.
9. `stopAnalysis` waits for the terminating result.
10. Fresh player `bestmove` resolves only its player operation.
11. A result received before `awaitPlayerTurnMove` is retained in `PlayerMoveReady`.
12. Ponder hit sends only `ponderhit` and enters `FindingMove` before writing it.
13. Ponder hit selection does not inspect the generated command value.
14. Ponder miss awaits `_stopSearch(...)`, then follows the normal path, calls `buildFindNextMoveCommands(game)`, and sends its returned fresh commands.
15. Ponder hit and miss execute the same shared `FindingMove` setup after their command selection and produce the same state-owned position/completion shape.
16. Ponder miss command ordering remains correct when a new-game ready barrier is required.
17. A spontaneous ponder `bestmove` fails the session.
18. Wrong control output for every awaiting/active state fails the session.
19. Ancillary output does not change state.
20. Write failure rejects the owning start/stop/player completion once.
21. Process exit rejects current work and detaches listeners once.
22. Disposing `StoppingSearch` rejects its state-owned stop completion.
23. Concurrent incompatible public calls are rejected without writing commands.

### Utility tests

Update `UciUtility.spec.ts` to assert:

- `buildFindNextMoveCommands(game)` returns position plus timed `go`;
- `buildFindNextMoveCommands(game, matchingMove)` returns `ponderhit`;
- `buildFindNextMoveCommands(game, mismatchingMove)` returns `stop`;
- the shared ponder predicate agrees with the command builder's contextual selection;
- `buildStopCommand()` remains `stop`;
- any new output classifier recognises control records without assigning them to session operations.

### Integration tests

Retain `NwjsUciEngineClient.spec.ts` as the process-boundary test. It should assert command logs and public promises, not private machine fields. The most important ordering assertion is:

```text
stop
<stale bestmove consumed>
position ...
go ...
```

Also assert that the stale ponder move never becomes the result of `awaitPlayerTurnMove(...)`.

## Implementation Sequence

### Phase 1: Strengthen behaviour tests

1. Split or extend existing tests around analysis replacement and ponder paths.
2. Add early-result, write-failure, unexpected-output, and process-exit coverage.
3. Confirm the existing implementation still passes the characterisation suite before structural changes.

### Phase 2: Share ponder classification

1. Keep `buildFindNextMoveCommands(game, expectedPonderMove?)` unchanged.
2. Promote its private ponder-match logic to a named pure predicate used by both the builder and state machine.
3. Make the machine select hit or miss state from that predicate before sending the builder's commands.
4. Update utility tests without removing the existing contextual command cases.

### Phase 3: Introduce machine types

1. Add the state enum, context union, state-owned completion, event, and effect types.
2. Add exhaustive transition selection using `never` checks where practical.
3. Add state-owned completion helpers and terminal cleanup.
4. Unit-test transitions without changing the public client adapter yet.

### Phase 4: Move protocol flows into the machine

1. Move handshake and ready-barrier handling.
2. Move analysis start, stream, stop, replacement, and completion.
3. Move fresh player search and player-result delivery.
4. Move ponder start, hit, miss, stop waiting, and normal-path resumption.
5. Move raw output routing and protocol-failure handling.

### Phase 5: Reduce the client adapter

1. Replace the existing session enum/bag with the machine instance.
2. Keep engine/runtime/process validation in `NwjsUciEngineClient`.
3. Replace reset logic with dispose-and-replace session lifecycle.
4. Replace broad search helpers with state-specific start handling and retain `_stopSearch(engine, session)` as the single awaited stop boundary.
5. Keep the returned store surface satisfying `IEngineClient` unchanged.

### Phase 6: Documentation and cleanup

1. Update `docs/LowLevel/ProcessFlows/EngineRuntimeOwnership.md` with the final states and awaited intermediate transitions.
2. Update `docs/LowLevel/Architecture/PlatformAbstraction/EngineClient.md` and remove the known command-inspection change trigger.
3. Update the `UciUtility` surface in `docs/LowLevel/Architecture/UtilityIndex.md`.
4. Remove the UCI rewrite item from `docs/NewToDoList.md` only after implementation and verification.
5. Reconcile any historical wording that still describes a shared `stateDeferred` or command inspection.

## Expected File Changes

```text
src/contracts/platform/IEngineClient.ts                 no signature change; comments only if needed
src/domain/EngineRuntimeService.ts                      no behavioural change expected
src/platform/nwjs/NwjsUciEngineClient.ts               reduce to adapter/session lifecycle
src/platform/nwjs/NwjsUciSessionMachine.ts             new state machine
src/utility/UciUtility.ts                               share ponder classification; retain builder contract
src/platform/__tests__/NwjsUciEngineClient.spec.ts     focused integration coverage
src/platform/__tests__/NwjsUciSessionMachine.spec.ts   new transition coverage
src/utility/__tests__/UciUtility.spec.ts                revised builder coverage
docs/LowLevel/ProcessFlows/EngineRuntimeOwnership.md    final flow/state documentation
docs/LowLevel/Architecture/PlatformAbstraction/EngineClient.md
docs/LowLevel/Architecture/UtilityIndex.md
docs/NewToDoList.md
```

If extracting the machine creates excessive host plumbing, it may remain as private functions in `NwjsUciEngineClient.ts`, but the state/event/effect boundaries and tests remain required. Extraction is preferred because the current file mixes adapter, process, protocol, transition, parsing, and result-publication responsibilities.

## Acceptance Criteria

### API and layering

- `IEngineClient` signatures are unchanged.
- No UCI state or command type leaks into `EngineRuntimeService`, stores, contracts, or views.
- No persistence or game-document migration is required.

### State correctness

- No branch examines `ponderhit`, `stop`, another outgoing string, or a command-array position to select state.
- `_stopSearch(engine, session)` remains the awaited search-stop boundary, accepts neither a state nor a command, enters the single `StoppingSearch` state, and sends `buildStopCommand()` internally.
- Position, expected ponder move, handshake lines, and operation completions are owned by the states that require them.
- Every recognised control output is either handled by its current state or fails the session.
- Every engine-output transition is selected from the current state; public async flows continue only after the matching state-owned completion resolves.

### Ponder correctness

- A hit changes to `FindingMove` before `ponderhit` is written.
- A miss changes to `StoppingSearch` before `stop` is written.
- The stale ponder `bestmove` is discarded.
- Fresh position/search commands are sent only after that stale result.
- After hit/miss command selection and the optional stop, both execute one shared `FindingMove` setup and output path.
- Only the fresh or continued player search can resolve the player result.

### Lifecycle correctness

- Immediate output after a write sees the correct destination state.
- Stop, failure, exit, restart, and process replacement reject pending work exactly once.
- Restart creates a clean session without manual optional-field reset.
- Analysis replacement and game-boundary ready barriers are awaited before the public operation continues through its normal path.

### Quality and verification

- Functions follow the repository's compact style and are preferably under 35 lines.
- Interfaces use the `I` prefix, abbreviations are treated as words, and UK spelling is used.
- TypeScript statements use semicolons.
- `npm run type-check` passes.
- Targeted UCI utility, machine, client, and runtime tests pass.
- The complete `npm run test:unit -- --run` suite passes.
- Relevant architecture and process-flow documents match the implementation.

## Baseline

Before this plan was written, the targeted existing suites passed:

```text
src/utility/__tests__/UciUtility.spec.ts             7 tests
src/platform/__tests__/NwjsUciEngineClient.spec.ts  8 tests
Total                                                15 tests
```

This confirms the rewrite begins from passing existing UCI behaviour. The added characterisation tests should establish the missing failure, ordering, and early-result cases before structural replacement.
