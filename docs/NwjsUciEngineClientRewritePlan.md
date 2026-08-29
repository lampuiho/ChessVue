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
8. A ponder miss stores a prepared fresh-player-search continuation. The stopped ponder result is consumed before that continuation sends `position` and `go`.
9. Search command payloads and the searched position are captured when an operation is requested. The machine does not retain a mutable `IGame` while awaiting protocol output.
10. Terminal or replaced sessions are disposed and replaced rather than reset by clearing a large collection of optional fields.
11. The state machine is specific to the UCI client. No generic state-machine framework is introduced.

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

The builder continues to return the commands required by the current next-move context. The machine stops interpreting those returned strings. It determines its transition from `Pondering.expectedMove` and the live line, then sends the unchanged builder result as the transition effect.

To keep matching logic in one place, promote the existing private ponder-match logic to a named pure predicate such as `isPonderHit(game, expectedPonderMove)`. Both the state transition and `buildFindNextMoveCommands(...)` use that predicate. This adds an internal helper but does not change the existing command-builder API.

A single-line UCI output classifier may also be added so the machine receives typed output events instead of repeating string-prefix checks. These remain repository-internal additions; no upper layer is affected.

### Behavioural contract

The externally observable operation timing remains:

- `initialiseEngine(...)` resolves after `uciok`, configured options, `isready`, and `readyok` complete.
- `startAnalysis(...)` resolves once the analysis search has actually been started.
- Replacing an active analysis first stops and consumes that search, then starts the replacement.
- `stopAnalysis(...)` resolves after the terminating `bestmove` is consumed.
- `startPlayerTurn(...)` resolves after a fresh search or ponder continuation is armed. On a ponder miss, this is after the stale ponder `bestmove` is consumed and the fresh search is sent.
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

### Generic helpers permit invalid combinations

`_startSearch(session, state, commands)` and `_stopSearch(session, state, command)` accept arbitrary target states and command payloads. Nothing prevents `FindingMove` from being paired with `go infinite`, or `StoppingAnalysis` from being paired with `ponderhit`.

### Transition completion is duplicated

Handshake and stop flows manually assign an awaiting state, create a shared `stateDeferred`, let the line handler update the state, and then assign a separately supplied resolved state again. The deferred describes neither the operation nor its legal destination.

### Ponder-miss continuation lives in call-stack control flow

On a ponder miss, `startPlayerTurn(...)` waits inside `_stopSearch(...)` and resumes the same function after a stale `bestmove`. The pending fresh search is implicit in a suspended call stack instead of explicit in `StoppingPonder` state.

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
- operation intent types;
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
| `AwaitingReadyOk` | A typed continuation to run after `readyok` |
| `Ready` | No search-only data |
| `Analysing` | Searched position and analysis intent/context |
| `FindingMove` | Searched live position and player-move completion |
| `PlayerMoveReady` | Parsed detailed move waiting to be consumed |
| `Pondering` | Expected opponent move and ponder search identity |
| `StoppingSearch` | Source search and typed continuation |
| `Stopped` | Terminal reason |
| `Failed` | Terminal error |

`PlayerMoveReady` is intentional. An engine can return `bestmove` before `awaitPlayerTurnMove(...)` is called. Keeping the completed move in an explicit state preserves that result without returning the session to an ambiguous `Ready` state that also carries an optional resolved deferred.

## Prepared Search Intents

Before dispatching a start event, validate the game runtime and build an immutable intent. Builders may throw before the current state is changed.

### Analysis intent

Contains:

- rendered position;
- current game-boundary key;
- `MultiPV` command;
- position and `go infinite` commands;
- operation completion;
- analysis callback context where required.

### Player-search intent

Contains:

- live position captured for this request;
- current game-boundary key;
- fresh position and timed `go` commands;
- player-move completion;
- start-operation completion.

On a ponder hit, the same player-search intent supplies the position used to decode the eventual `bestmove`, and `buildFindNextMoveCommands(game, expectedMove)` supplies `ponderhit`. On a miss, that same contextual builder supplies `stop`, while the full fresh commands generated without an expected move are stored in the stop continuation.

### Ponder intent

Contains:

- current game-boundary key;
- ponder position and timed `go ponder` commands;
- expected opponent reply;
- start-operation completion.

The speculative result still has no decodable session position because it must be discarded unless `ponderhit` converts it into the next player search.

## Machine Events

### Public-operation events

```text
Initialise
StartAnalysis(intent)
StopAnalysis(completion)
StartPlayerTurn(intent)
StartPondering(intent)
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
| `AwaitingReadyOk` | `ReadyOk` | Continuation destination | Execute the stored continuation |

The initial `AwaitingReadyOk` continuation resolves initialisation and enters `Ready`.

### Game-boundary preparation

Starting an analysis, player, or ponder intent from `Ready` first compares the intent boundary with the session boundary:

- If unchanged, transition directly into the search state and send its commands.
- If changed, enter `AwaitingReadyOk` with the search intent as its continuation, send `ucinewgame` followed by `isready`, and start the search only after `readyok`.

The session boundary is committed when the ready barrier succeeds, not before command writes succeed.

### Analysis

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Ready` | `StartAnalysis(intent)` | `Analysing` or `AwaitingReadyOk` | Prepare boundary if needed, set `MultiPV`, send position and `go infinite`, resolve start completion |
| `Analysing` | `InfoLine` | `Analysing` | Parse and publish an incremental update |
| `Analysing` | `BestMoveLine` | `Ready` | Parse final move, publish final update |
| `Analysing` | `StopAnalysis` | `StoppingSearch` | Store `Ready` continuation, send `stop` |
| `Analysing` | `StartAnalysis(newIntent)` | `StoppingSearch` | Store replacement-analysis continuation, send `stop` |
| `StoppingSearch` from analysis | `BestMoveLine` | Continuation destination | Discard stale result and run the continuation |
| `Ready` | `StopAnalysis` | `Ready` | Resolve as a no-op |

### Fresh player search

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Ready` | `StartPlayerTurn(intent)` | `FindingMove` or `AwaitingReadyOk` | Prepare boundary if needed, send fresh search commands, resolve start completion |
| `FindingMove` | `BestMoveLine` | `PlayerMoveReady` | Parse detailed move and resolve an existing waiter if present |
| `FindingMove` | `AwaitPlayerMove` | `FindingMove` | Register the single waiter |
| `PlayerMoveReady` | `AwaitPlayerMove` | `Ready` | Resolve immediately with the stored move |

The implementation may represent the move completion as one object created by `StartPlayerTurn` and awaited later. The essential invariant is that the completion belongs only to the current `FindingMove`/`PlayerMoveReady` operation and cannot be satisfied by a stop acknowledgement.

### Ponder start

| Current state | Event | Next state | Effects |
| --- | --- | --- | --- |
| `Ready` | `StartPondering(intent)` | `Pondering` or `AwaitingReadyOk` | Prepare boundary if needed, send position and `go ponder`, resolve start completion |
| `Pondering` | `InfoLine` or ancillary output | `Pondering` | Ignore |
| `Pondering` | `BestMoveLine` | `Failed` | Report protocol violation; ponder must wait for hit or stop |

### Ponder hit

```text
StartPlayerTurn(game)
  -> prepare the player-search intent from the requested live state
  -> current state is Pondering
  -> classify the latest live move with the shared ponder predicate
  -> match
  -> install FindingMove with the player's searched position and completion
  -> send buildFindNextMoveCommands(game, Pondering.expectedMove), which returns ponderhit
  -> resolve startPlayerTurn
  -> route the next bestmove only through FindingMove
```

No code checks the returned string or command-list position.

### Ponder miss

```text
StartPlayerTurn(game)
  -> prepare the complete fresh player-search intent
  -> current state is Pondering
  -> classify the latest live move with the shared ponder predicate
  -> mismatch
  -> install StoppingSearch { source: Ponder, continuation: fresh player intent }
  -> send buildFindNextMoveCommands(game, Pondering.expectedMove), which returns stop
  -> keep startPlayerTurn pending

BestMoveLine(stale ponder result)
  -> current state is StoppingSearch from ponder
  -> discard the result without parsing it against the requested position
  -> apply the stored game-boundary preparation if required
  -> install FindingMove
  -> send the stored fresh position and timed go commands
  -> resolve startPlayerTurn
```

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

Only the active state and any typed continuation can own completions, so terminal cleanup walks those structures instead of clearing unrelated optional fields.

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
3. Capture the rendered position, game boundary, `MultiPV`, callback context, and command payload into an analysis intent.
4. Dispatch `StartAnalysis(intent)`.
5. If already analysing, the machine stops the current search and retains the replacement intent as a continuation.
6. Resolve only after the new search commands are sent.

### `stopAnalysis(engine)`

1. Require an initialised session.
2. Dispatch `StopAnalysis`.
3. Resolve immediately in `Ready`.
4. In `Analysing`, resolve only after the stop's terminating `bestmove` is consumed.
5. Reject from states in which stopping analysis is not a legal operation.

### `startPlayerTurn(engine, game)`

1. Require an initialised session.
2. Capture the live position, game boundary, timed fresh-search commands, and move completion into a player intent.
3. Dispatch `StartPlayerTurn(intent)`.
4. `Ready` starts a fresh search.
5. `Pondering` selects hit or miss from state data and the live line.
6. Any other operational state rejects with a state error.

### `awaitPlayerTurnMove(engine)`

1. Require the session to own the current player operation.
2. If it is `FindingMove`, await that operation's completion.
3. If it is `PlayerMoveReady`, consume the stored result immediately.
4. Complete the transition to `Ready` exactly once.
5. Reject when no player turn is active.

### `startPondering(engine, game, engineMove, ponderMove)`

1. Require `Ready`.
2. Capture the boundary, ponder commands, and expected reply into a ponder intent.
3. Dispatch `StartPondering(intent)`.
4. Resolve after commands are sent and state is `Pondering`.

### `stopEngine(engine)`

1. Preserve the existing process-handle validation contract.
2. Dispose the private session if present.
3. Reject the completion owned by the current state and any stored continuation.
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
- A stopped-search `bestmove` is discarded and never decoded against the continuation's position.
- A `bestmove` while still `Pondering` is a protocol failure.
- A recognised control event in an invalid state fails the session.
- Syntax alone never identifies which completion may be resolved.

## Error Handling

### Request validation errors

Missing runtime positions, invalid paths, missing clocks, unsupported modes, and command-building errors should occur while preparing an intent, before the current machine state changes.

### Illegal operation errors

The transition table produces the existing style of error:

```text
Cannot <operation> while UCI session state is <state>.
```

Where helpful, state names can include the explicit `PlayerMoveReady` and unified `StoppingSearch` substates.

### Protocol errors

Malformed records or recognised records that are illegal in the current state enter `Failed`, update `engine.$.lastError`, reject current work, and detach listeners.

### Write and process errors

A command-write failure or unexpected process exit enters `Failed` once. Completion rejection and listener detachment must be idempotent so a later exit event does not replace the original error or reject work twice.

## Concurrency And Ordering Invariants

1. A public event synchronously claims its destination state before its first command is written.
2. Only one player-move completion exists per `StartPlayerTurn` event.
3. Only `FindingMove` can populate that player result.
4. `StoppingSearch` always discards its terminating `bestmove`.
5. A continuation cannot run before the output that terminates the prior search.
6. Command batches are written in array order and stop at the first failure.
7. `AwaitingReadyOk` carries exactly one continuation.
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
4. Changed game boundary stores and resumes the exact search continuation.
5. Same boundary starts a search directly.
6. Analysis `info` publishes only while analysing.
7. Natural analysis `bestmove` returns to ready and publishes a final update.
8. Analysis replacement discards the stopped result before starting the replacement.
9. `stopAnalysis` waits for the terminating result.
10. Fresh player `bestmove` resolves only its player operation.
11. A result received before `awaitPlayerTurnMove` is retained in `PlayerMoveReady`.
12. Ponder hit sends only `ponderhit` and enters `FindingMove` before writing it.
13. Ponder hit selection does not inspect the generated command value.
14. Ponder miss sends `stop`, remains unable to resolve a player move, discards the stale result, then sends the captured fresh commands.
15. Ponder miss command ordering remains correct when a new-game ready barrier is required.
16. A spontaneous ponder `bestmove` fails the session.
17. Wrong control output for every awaiting/active state fails the session.
18. Ancillary output does not change state.
19. Write failure rejects the owning start/stop/player completion once.
20. Process exit rejects current work and detaches listeners once.
21. Disposing `StoppingSearch` rejects both the stop/start operation and its continuation-owned completion as applicable.
22. Concurrent incompatible public calls are rejected without writing commands.

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

1. Add the state enum, context union, intent, continuation, event, and effect types.
2. Add exhaustive transition selection using `never` checks where practical.
3. Add state-owned completion helpers and terminal cleanup.
4. Unit-test transitions without changing the public client adapter yet.

### Phase 4: Move protocol flows into the machine

1. Move handshake and ready-barrier handling.
2. Move analysis start, stream, stop, replacement, and completion.
3. Move fresh player search and player-result delivery.
4. Move ponder start, hit, miss, and stopped-result continuation.
5. Move raw output routing and protocol-failure handling.

### Phase 5: Reduce the client adapter

1. Replace the existing session enum/bag with the machine instance.
2. Keep engine/runtime/process validation in `NwjsUciEngineClient`.
3. Replace reset logic with dispose-and-replace session lifecycle.
4. Remove obsolete generic state wait/start/stop helpers.
5. Keep the returned store surface satisfying `IEngineClient` unchanged.

### Phase 6: Documentation and cleanup

1. Update `docs/LowLevel/ProcessFlows/EngineRuntimeOwnership.md` with the final states and continuations.
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
- No helper accepts an arbitrary target state alongside arbitrary commands.
- Position, expected ponder move, handshake lines, and operation completions are owned by the states that require them.
- Every recognised control output is either handled by its current state or fails the session.
- Every transition is represented in one transition table/reducer rather than split between a public method and output callback.

### Ponder correctness

- A hit changes to `FindingMove` before `ponderhit` is written.
- A miss changes to `StoppingSearch` before `stop` is written.
- The stale ponder `bestmove` is discarded.
- Fresh position/search commands are sent only after that stale result.
- Only the fresh or continued player search can resolve the player result.

### Lifecycle correctness

- Immediate output after a write sees the correct destination state.
- Stop, failure, exit, restart, and process replacement reject pending work exactly once.
- Restart creates a clean session without manual optional-field reset.
- Analysis replacement and game-boundary ready barriers preserve their queued intent.

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
