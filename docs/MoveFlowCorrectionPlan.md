# Move Flow Correction Plan — Replanned After Full Rollback

No implementation work may begin until this plan is approved. Implementation cannot drift from this plan; if anything outside these function trees is required, work must stop for replanning.

The discarded implementation has been fully removed. The tracked worktree is back at the pre-implementation baseline; this untracked document is the only replanning artefact.

## No-drift signature ledger

These are the only production function signatures that may change:

```ts
// New state-layer flow function
GamePlayerTurnComposable.attemptPlayerMove(
  game: IGame,
  move: IMove,
): Promise<void>;

// Existing domain functions with explicitly changed domain signatures
EngineRuntimeService.startPlayerTurn(
  engine: IAssignedEngine,
  game: IGame,
  attemptPlayerMove: (move: IMove) => Promise<void>,
): Promise<void>;

EngineRuntimeService.awaitPlayerTurnMove(
  engine: IAssignedEngine,
  searchedPosition: IBoardPosition,
): Promise<IMove>;

EngineRuntimeService.startPondering(
  engine: IAssignedEngine,
  game: IGame,
  engineMove: IMove,
  ponderMove: IMove,
): Promise<void>;

// The only changed platform-interface signature
IEngineClient.startPondering(
  engine: IAssignedEngine,
  game: IGame,
  engineMove: IMove,
  ponderMove: IMove,
): Promise<void>;

// Existing state function with the engine parameter removed
GameMoveComposable.commitLiveMove(
  game: IGame,
  move: IMove,
): void;

// Existing utility function with an explicitly changed signature
buildPonderMoveCommands(
  game: IGame,
  engineMove: IMove,
  ponderMove: IMove,
): string[];
```

`commitHistoryRewriteMove` remains private and explicitly drops the redundant node parameter:

```ts
commitHistoryRewriteMove(
  game: IGame,
  move: IMove,
): void;
```

It obtains the rendered node and position from `GamePositionComposable`. The game already owns its rendered path and rendered/analysis position reference; those are copied directly into the live selector/cache.

Every other production function signature remains unchanged. No overload, compatibility signature, renamed helper, or additional flow function may be introduced without stopping for another replan.

### Explicit UCI helper decision

The `buildPonderMoveCommands` signature change above is intentional and is no longer implicit. The existing two-argument signature cannot construct a pre-commit ponder line because `game.livePath` does not yet contain `engineMove`.

The three arguments have separate ownership:

- `game` supplies `rootPosition`, the preceding live move sequence represented by `livePath`, and the existing time-control and clock fields used by the timed `go ponder` command.
- `engineMove` is the parsed best move returned by the player search; it is not committed-move state and is not yet present in `game.livePath`.
- `ponderMove` is the parsed continuation supplied with the best move.

The implementation must build exactly:

```text
position <game.rootPosition> moves <moves already in game.livePath> <engineMove> <ponderMove>
go ponder <time fields from game>
```

`buildPonderMoveCommands` must read the existing live sequence from `game.livePath`, append `engineMove`, then append `ponderMove`. It must not treat `engineMove` as already committed to that path.

The planned implementation is exactly:

```ts
export function buildPonderMoveCommands(game: IGame, engineMove: IMove, ponderMove: IMove): string[] {
  return [
    _buildPositionCommand(game.rootPosition, [..._getLiveMoves(game), engineMove, ponderMove]),
    _buildTimedGoCommand(game, true),
  ];
}
```

### Explicit pre-commit clock assumption

Immediate pondering begins before `attemptPlayerMove` completes, so `game.clockSnapshot` may still be the pre-commit snapshot. This replan deliberately preserves the existing command builder's clock source and does not add clock projection, a clock callback, or another `TimeControlService` call.

If pondering requires a projected post-move clock instead, that is a separate production-flow expansion and implementation must stop for another replan. Approval of this plan approves use of the current `game.clockSnapshot` for the immediate ponder command.

In the call trees below, every indented item is called by the item directly above it. Items at the same indentation level are sequential sibling operations.

## API constraints

Existing API names remain:

- `EngineRuntimeService.ensureReady`
- `EngineRuntimeService.startPlayerTurn`
- `EngineRuntimeService.awaitPlayerTurnMove`
- `EngineRuntimeService.startPondering`
- `GameMoveComposable.makeMove`
- `GameMoveComposable.commitLiveMove`

There will be no `playPlayerTurn` or other renamed engine-turn API.

The only new move-flow function is the discussed live-only `GamePlayerTurnComposable.attemptPlayerMove`.

`IEngineClient` method names remain unchanged. `startPondering` is the only `IEngineClient` signature that changes; it gains `engineMove` immediately before `ponderMove` as shown in the no-drift signature ledger. Every other `IEngineClient` signature remains unchanged.

`UciUtility.buildPonderMoveCommands` is not an `IEngineClient` method. Its three-argument signature change is authorised only if the no-drift signature ledger above is approved.

## 1. Arming a player turn

```text
GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)
└─ GamePlayerTurnComposable.requestPlayerMove(game)
   ├─ getSideToMovePlayer(...): IPlayer
   ├─ create Deferred<IMove>
   ├─ start playerMoveHandler(pendingPlayerMove)
   ├─ store pendingPlayerTurnPromise
   ├─ store pendingPlayerTurnHandlePromise
   └─ if IPlayer is engine-backed
      └─ requestEngineMove(assignedEngine)
         ├─ EngineRuntimeService.ensureReady(engine)
         └─ EngineRuntimeService.startPlayerTurn(
              engine,
              game,
              callback bound to this request's pending Deferred
            )
```

The engine callback is exactly:

```text
engine move-attempt callback(move)
├─ compare game.$.pendingPlayerTurnPromise with the Deferred captured by requestPlayerMove
├─ if it is no longer the same request
│  └─ return without submitting the stale move
└─ otherwise
   └─ attemptPlayerMove(game, move)
```

This identity check preserves the baseline reassignment/abort behaviour. It is not committed-move state, does not return a boolean, and does not make pondering depend on whether the move commits or is deferred. No collection such as `committedPlayerMoves` will be introduced.

Local and engine players therefore share:

- The same `Deferred<IMove>`.
- The same `playerMoveHandler`.
- The same `attemptPlayerMove`.
- The same `commitLiveMove`.

The engine discriminator is used only to start the engine-backed player’s move provider.

## 2. `makeMove` routing

When `makeMove` is making the current live move, it calls the same `attemptPlayerMove` used by the engine.

```text
GamesStore.makeMove(game, move)
└─ GameMoveComposable.makeMove(game, move)
   ├─ status.assertMoveAllowed(game)
   ├─ if current context is the ongoing live turn
   │  └─ GamePlayerTurnComposable.attemptPlayerMove(game, move)
   ├─ else if reviewing live history
   │  ├─ if allowTakeback
   │  │  └─ commitHistoryRewriteMove(...)
   │  └─ else
   │     └─ commitLiveHistoryAnalysisMove(...)
   ├─ else if analysing an ongoing live game
   │  └─ commitLiveAnalysisMove(...)
   └─ else
      └─ commitStandaloneAnalysisMove(...)
```

`attemptPlayerMove` is exclusively for the current live player turn. It will not contain history-rewrite or analysis branching.

## 3. Shared live-move attempt

Proposed signature:

```ts
async function attemptPlayerMove(
  game: IGame,
  move: IMove,
): Promise<void>
```

The promise represents completion of the shared pending handler. `attemptPlayerMove` always submits the move to that handler; the handler either commits it immediately or stores it as the deferred move while paused.

```text
GamePlayerTurnComposable.attemptPlayerMove(game, move)
├─ require the existing pending live-player Deferred
├─ retain the existing pending handler promise
├─ resolve pendingPlayerTurnPromise with move
└─ await pendingPlayerTurnHandlePromise
```

There is no committed/not-committed result; successful completion means the shared handler accepted the move for immediate or deferred application.

`GameMoveComposable.makeMove` awaits completion of the attempt.

`EngineRuntimeService.startPlayerTurn` does not use move-attempt completion to decide whether pondering begins. Pondering is driven directly by the guarded engine result.

## 4. Small deferred handler

`attemptPlayerMove` handles resolving and waiting. The handler remains focused on consuming the pending move:

```text
GamePlayerTurnComposable.playerMoveHandler(pendingPlayerMove)
├─ await pendingPlayerMove
├─ if the pending request was aborted
│  └─ return
├─ if the player provider failed
│  ├─ record the handled failure
│  └─ request another turn through the existing retry path
├─ clear the completed pending runtime references
├─ if the game is paused
│  └─ store move as deferredPlayerMove
└─ else
   └─ GameMoveComposable.commitLiveMove(game, move)
```

The handler receives:

```ts
playerMoveHandler(pendingPlayerMove)
```

It does not receive:

- An engine.
- An engine-backed player.
- A validation callback.
- A ponder move separately.

## 5. Local-player function flow

```text
Presentation supplies an already valid live IMove
└─ GamesStore.makeMove(game, move)
   └─ GameMoveComposable.makeMove(game, move)
      └─ GamePlayerTurnComposable.attemptPlayerMove(game, move)
         ├─ resolve the shared pending Deferred
         └─ await playerMoveHandler
            └─ GameMoveComposable.commitLiveMove(game, move)
```

There is no legality validation in this flow.

## 6. Engine-player function flow

The existing `EngineRuntimeService.startPlayerTurn` remains the engine entry point. Its domain-level signature gains the move-attempt callback; its name does not change.

Proposed domain signature:

```ts
async startPlayerTurn(
  engine: IAssignedEngine,
  game: IGame,
  attemptPlayerMove: (move: IMove) => Promise<void>,
): Promise<void>
```

The platform `startPlayerTurn` signature remains unchanged. The platform `startPondering` signature explicitly gains `engineMove`:

```ts
engineClient.startPlayerTurn(engine, game): Promise<void>;
engineClient.startPondering(engine, game, engineMove, ponderMove): Promise<void>;
```

Full nested flow:

```text
GamePlayerTurnComposable.requestEngineMove(engine)
├─ EngineRuntimeService.ensureReady(engine)
└─ EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove)
   ├─ capture the canonical live position being searched
   ├─ _runInitialisedEngineOperation(...)
   │  └─ engineClient.startPlayerTurn(engine, game)
   ├─ EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)
   │  └─ guarded engine-client await flow described below
   ├─ if guardedMove contains $.ponderMove and game is ongoing
   │  └─ begin EngineRuntimeService.startPondering immediately (
              engine,
              game,
              guardedMove,
              guardedMove.$.ponderMove
            )
   └─ attemptPlayerMove(guardedMove)
      ├─ resolve the same Deferred used by a local player
      └─ await the same playerMoveHandler
         └─ commit now or store deferredPlayerMove while paused
```

`GamePlayerTurnComposable` does not call `startPondering`.

`GameMoveComposable.commitLiveMove` does not call `startPondering`.

The pondering call is made from the existing engine-level `startPlayerTurn` flow as soon as the guarded best move is available. It does not wait for `attemptPlayerMove` or for a live-game commit.

Because the game tree may not yet contain the best move, the runtime passes the guarded engine move directly into `startPondering`. The concrete engine client builds the ponder search from the game's root and existing live sequence, then appends that supplied engine move and the supplied ponder move. It must not assume that `game.livePath` already includes the engine move.

### Exact direct UCI ponder inputs

No new `IUciSession` field is added. In particular, there is no `playerSearchMove`, committed-move collection, store runtime field, or shared retained-move field.

The existing `session.position` remains only the position used to decode the engine result. It is not passed to the ponder command builder, and no additional searched-position context is added.

```text
NwjsUciEngineClient._completePlayerMove(session, bestmoveLine)
├─ decode best move and optional ponder move against session.position
├─ set session state to Ready
└─ resolve the existing client-private playerMoveDeferred

NwjsUciEngineClient.startPondering(engine, game, engineMove, ponderMove)
├─ require initialised session
├─ require Ready state
├─ prepare the existing game boundary
├─ UciUtility.buildPonderMoveCommands(
│    game,
│    engineMove,
│    ponderMove
│  )
├─ retain expectedPonderMove
├─ clear session.position because ponder output is not decoded as a known-position result
└─ start the Pondering search with the returned commands
```

## 7. Exact engine validation placement

The guard is specifically around:

```ts
engineClient.awaitPlayerTurnMove(engine)
```

inside:

```ts
EngineRuntimeService.awaitPlayerTurnMove(...)
```

Proposed domain signature:

```ts
async awaitPlayerTurnMove(
  engine: IAssignedEngine,
  searchedPosition: IBoardPosition,
): Promise<IMove>
```

Exact nested flow:

```text
EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)
└─ _runLiveEngineOperation(engine, EngineAvailability.Ready, operation)
   └─ operation
      ├─ await engineClient.awaitPlayerTurnMove(engine)
      ├─ validate returned move against searchedPosition
      ├─ if move contains $.ponderMove
      │  ├─ derive a detached position after the returned move
      │  └─ validate ponderMove against that detached position
      └─ return the guarded move
```

Conceptually:

```ts
async awaitPlayerTurnMove(
  engine: IAssignedEngine,
  searchedPosition: IBoardPosition,
): Promise<IMove> {
  const engineClient = _getEngineClient(engine);
  return _runLiveEngineOperation(engine, EngineAvailability.Ready, async () => {
    const move = await engineClient.awaitPlayerTurnMove(engine);
    if (!isMoveLegal(searchedPosition, move)) throw invalidEngineMoveError;
    if (move.$?.ponderMove) {
      const positionAfterMove = /* detached position after move */;
      if (!isMoveLegal(positionAfterMove, move.$.ponderMove)) throw invalidEnginePonderMoveError;
    }
    return move;
  });
}
```

This placement means:

- Every `IEngineClient` implementation is guarded once.
- `NwjsUciEngineClient` does not duplicate the guard.
- No invalid engine move reaches `attemptPlayerMove`.
- No invalid engine move reaches `playerMoveHandler`.
- No invalid engine move reaches `commitLiveMove`.
- There is no state-layer `assertMoveLegal`.

The detached position used for sequential ponder validation is a necessary simulation copy and will be documented as such.

## 8. Engine failure handling

### Failure before a move is attempted

```text
EngineRuntimeService.startPlayerTurn(...)
└─ start, await, or validation fails
   └─ GamePlayerTurnComposable.requestEngineMove catches failure
      └─ reject pendingPlayerTurnPromise
         └─ playerMoveHandler handles the rejected player provider
            └─ use the existing retry behaviour
```

There is no engine-specific legality retry in the handler. It sees only a failed player provider.

### Failure while starting pondering

```text
EngineRuntimeService.startPlayerTurn(...)
├─ begin EngineRuntimeService.startPondering
├─ attemptPlayerMove still runs exactly once
└─ if pondering fails
   ├─ preserve the accepted or deferred move
   ├─ record or handle the engine runtime failure
   └─ do not reject or repeat the move attempt
```

## 9. Live commit flow

Final signature:

```ts
commitLiveMove(game: IGame, move: IMove): void;
```

Nested flow:

```text
GameMoveComposable.commitLiveMove(game, move)
├─ obtain live parent node and live position
├─ calculate the next clock snapshot
├─ if the live parent has an existing continuation
│  └─ MoveHistoryService.pruneFutureMoves(parentNode)
├─ MoveApplicationService.applyMove(livePosition, move)
├─ MoveHistoryService.addMainlineMove(...)
├─ setLivePath(...)
├─ if the live position is rendered
│  └─ setRenderedPath using the same position reference
├─ else
│  └─ advance the rendered path without replacing its position
├─ update the game clock
├─ update the game result
├─ update the game state
├─ touch the game
├─ clear completed player-turn runtime
├─ refresh clock registrations
├─ refresh analysis
└─ requestPlayerMoveIfNeeded(game)
```

It receives no engine and performs no pondering or validation.

## 10. Deferred move after pause

```text
playerMoveHandler
└─ game is paused when pending move resolves
   └─ store move as deferredPlayerMove
```

Later:

```text
GamePlayerTurnComposable.flushDeferredPlayerMove(game)
├─ read and clear deferredPlayerMove
├─ if the live turn is no longer ready
│  └─ return or request the appropriate next turn
└─ if the live turn is ready
   └─ GameMoveComposable.commitLiveMove(game, deferredPlayerMove)
```

`flushDeferredPlayerMove` will not:

- Validate the move again.
- Look up whether its source was an engine.
- Pass an engine to `commitLiveMove`.
- Start pondering.

The original `attemptPlayerMove` still completes normally when the handler stores `deferredPlayerMove`. If the guarded engine result included a ponder move, pondering already began from the game root/live sequence plus the directly supplied engine result; deferred flushing does not start it a second time.

## 11. History-rewrite correction

Current incorrect flow:

```text
GameMoveComposable.makeMove(...)
└─ commitHistoryRewriteMove(game, renderedNode, move)
   └─ commitLiveMove(game, move)
      └─ uses the old live node and position
```

Planned flow:

```text
GameMoveComposable.makeMove(...)
└─ live-history review with allowTakeback
   └─ commitHistoryRewriteMove(game, move)
      ├─ selectedParentNode = position.getRenderedNode(game)
      ├─ selectedParentPosition = position.getRenderedPosition(game)
      ├─ position.setLivePath(
      │    game,
      │    game.renderedPath,
      │    { node: selectedParentNode, position: selectedParentPosition }
      │  )
      ├─ restore the selected parent clock snapshot
      └─ commitLiveMove(game, move)
         ├─ prune the selected parent’s previous future
         ├─ apply the replacement move to the position that is now both rendered and live
         └─ create the replacement live continuation
```

The selected parent node and position are already the rendered references used for the move. `setLivePath` copies those references into the live selector/cache before `commitLiveMove`, so the replacement move mutates one position object shared by rendered and live state. No path reconstruction, detached position, new position helper, or legality assertion is introduced.

## 12. Core code changes

Expected move-flow production files:

- `src/contracts/platform/IEngineClient.ts`
- `src/state/game/GamePlayerTurnComposable.ts`
- `src/state/game/GameMoveComposable.ts`
- `src/state/GamesStore.ts`
- `src/domain/EngineRuntimeService.ts`
- `src/platform/nwjs/NwjsUciEngineClient.ts`
- `src/utility/UciUtility.ts`

No other production file may change. A required production edit outside this list is an immediate stop-and-replan condition.

Permitted focused test files:

- `src/domain/__tests__/EngineRuntimeService.spec.ts`
- `src/state/__tests__/GamesStore.spec.ts`
- `src/platform/__tests__/NwjsUciEngineClient.spec.ts`
- `src/utility/__tests__/UciUtility.spec.ts`

Permitted directly affected design/tracker files:

- `docs/LowLevel/Architecture/DomainLogic/EngineRuntimeService.md`
- `docs/LowLevel/Architecture/PlatformAbstraction/EngineClient.md`
- `docs/LowLevel/ProcessFlows/EngineRuntimeOwnership.md`
- `docs/LowLevel/ProcessFlows/GameplayAndControl.md`

This correction-plan document may be updated only during replanning, not as a way to legitimise drift discovered during implementation. Any additional test or documentation file also requires stopping and listing it before work resumes.

Expected changes by file:

### `IEngineClient.ts`

- Keep every method name unchanged.
- Change only `startPondering` to `startPondering(engine, game, engineMove, ponderMove): Promise<void>`.
- Do not add retained move state to any shared contract.

### `GamePlayerTurnComposable.ts`

- Add live-only `attemptPlayerMove` returning `Promise<void>`.
- Make `playerMoveHandler` engine-agnostic.
- Route engine completion through `attemptPlayerMove`.
- Remove `isMoveLegal`.
- Remove `startPonderingIfAvailable`.
- Remove engine lookup from deferred flushing.

### `GameMoveComposable.ts`

- Route current live `makeMove` through `playerTurn.attemptPlayerMove`.
- Remove direct pending-Deferred resolution from `makeMove`.
- Remove engine parameter from `commitLiveMove`.
- Remove store-owned pondering call.
- Correct `commitHistoryRewriteMove`.

### `GamesStore.ts`

Change:

```text
commitLiveMove(game, move, engine?)
```

to:

```text
commitLiveMove(game, move)
```

No engine is threaded through composable dependencies.

### `EngineRuntimeService.ts`

- Keep the existing `startPlayerTurn` name.
- Let domain `startPlayerTurn` own start, guarded await, immediate pondering, and the player attempt.
- Guard `engineClient.awaitPlayerTurnMove(engine)` in `awaitPlayerTurnMove`.
- Keep the existing `startPondering` name, add the explicit `engineMove` parameter, and call it only from the engine flow.
- Pass the guarded engine move and its ponder move directly to `engineClient.startPondering`.

### `NwjsUciEngineClient.ts`

- Add no retained best-move field or committed-move state.
- Accept `engineMove` directly in `startPondering(engine, game, engineMove, ponderMove)`.
- Start pondering from `game.rootPosition`, the moves represented by `game.livePath`, the supplied engine move, and the supplied ponder move without waiting for the game tree to commit the engine move.

### `UciUtility.ts`

- Change only `buildPonderMoveCommands` to the exact three-argument signature in the no-drift signature ledger.
- Build the ponder position from `game.rootPosition` and the existing live moves, followed by `[engineMove, ponderMove]`.
- Use `game.livePath` for the preceding live sequence, but do not treat it as already containing `engineMove`.
- Continue using the supplied `game` for the existing timed ponder command fields; do not add clock projection.

### Files explicitly not receiving duplicate move guards

- `src/platform/nwjs/NwjsUciEngineClient.ts`
- `src/state/game/GameMoveComposable.ts`
- `src/state/game/GamePlayerTurnComposable.ts`

## 13. Tests

### Engine runtime tests

Prove this nesting and order:

```text
EngineRuntimeService.startPlayerTurn
├─ engineClient.startPlayerTurn
├─ engineClient.awaitPlayerTurnMove
├─ common engine-result guard
├─ engineClient.startPondering
└─ attemptPlayerMove
```

Also prove:

- Invalid best move prevents `attemptPlayerMove`.
- Invalid ponder move prevents `attemptPlayerMove`.
- Legal move without ponder stops after `attemptPlayerMove`.
- A guarded move with a ponder continuation begins pondering without waiting for `attemptPlayerMove` to complete.
- `attemptPlayerMove` has no boolean result and never gates pondering.
- A game that already ended before the engine result is handled prevents pondering.
- A pondering failure does not prevent or repeat the move attempt.

### UCI pondering tests

Prove:

- Ponder command construction includes `game.rootPosition`, all moves already represented by `game.livePath`, the guarded engine move, and the ponder move even when the game tree has not committed the engine move.
- `EngineRuntimeService.startPondering` passes the guarded engine move and ponder move directly to `IEngineClient.startPondering`.
- `NwjsUciEngineClient.startPondering` passes those supplied moves directly to `buildPonderMoveCommands` without adding retained move state or searched-position input.

### Game store tests

Prove:

- Local live `makeMove` calls `attemptPlayerMove`.
- Engine completion calls the same `attemptPlayerMove`.
- Both resolve the same pending Deferred.
- The handler receives no engine.
- `commitLiveMove` receives no engine.
- The store does not call `startPondering`.
- Paused engine output is deferred, while an available guarded ponder continuation is still started once by the engine flow.
- Flushing a deferred move does not start pondering a second time.
- Remove the test claiming `GamePlayerTurnComposable` rejects illegal engine moves.

### History tests

Prove:

- `commitHistoryRewriteMove` receives only `game` and the replacement move.
- It obtains the selected parent through `getRenderedNode(game)` rather than receiving it from `makeMove`.
- `commitHistoryRewriteMove` copies `game.renderedPath`, the selected rendered node, and `getRenderedPosition(game)` into the live selector/cache before calling `commitLiveMove`.
- The rendered and live position caches reference the same object before the replacement move is applied.
- The previous continuation is pruned at that selected parent.
- The replacement becomes both the live and rendered continuation.
- Live/rendered position-reference behaviour remains correct.
- The selected historical clock snapshot is restored before committing.

## 14. Documentation

Update only directly affected documentation:

- `EngineRuntimeService` design:
  - `startPlayerTurn` owns start, guarded await, player attempt, and pondering.
  - `awaitPlayerTurnMove` guards the common client result.
- Engine-client design:
  - Concrete clients do not duplicate application move guarding.
  - Pondering uses the game root/live sequence plus the directly supplied engine move and does not depend on that move already being committed to `game.livePath`.
  - `IEngineClient.startPondering` receives both the engine move and ponder move; no client-private best-move retention is introduced.
- Player-turn process flow:
  - `attemptPlayerMove` is the shared live entry for local and engine players.
- Gameplay flow:
  - `makeMove` routes current live moves through `attemptPlayerMove`.
  - Analysis and history branches do not.
- Owning design documents:
  - Record the common `awaitPlayerTurnMove` guard and remove the incorrect state-layer validation boundary.
  - Record the shared local/engine move-attempt path and the verified history rewrite.
  - Keep each required ownership or simulation copy beside the module that owns it instead of maintaining a separate cloning tracker.

## 15. Object-cloning pass

```text
Production copy-site scan
├─ required ownership or simulation copy
│  ├─ retain it
│  └─ document its reason in the owning design document
├─ clearly unnecessary copy
│  ├─ remove only that copy
│  └─ update its focused test
└─ ambiguous ownership
   ├─ do not change it
   └─ save it as an uncrossed remaining finding
```

The standalone cloning audit will not be recreated.

The cloning tracker item remains uncrossed until every discovered production copy is removed or documented.

## 16. Verification order

```text
Verification
├─ focused EngineRuntimeService tests
├─ focused GamesStore tests
├─ focused history-rewrite tests
├─ focused UciUtility ponder-command tests
├─ existing NwjsUciEngineClient regression tests
├─ tests for any copy sites changed
├─ full test suite
├─ type checking
└─ update the authoritative design documents from verified results only
```

Any move-flow implementation requiring another production file or another API name must stop for replanning first.

## 17. Mandatory drift checks during implementation

Before the first implementation edit:

```text
Drift gate
├─ confirm tracked git diff is empty
├─ confirm this plan is approved in its current form
├─ copy the no-drift signature ledger into the implementation checklist
└─ do not reinterpret descriptive bullets as permission for another signature
```

Before changing any function declaration or adding any private runtime field:

```text
Declaration gate
├─ find the exact declaration or field in this plan
├─ if exact name, parameters, return type, and owning file are present
│  └─ continue
└─ otherwise
   └─ stop all implementation and replan before editing
```

The explicit `buildPonderMoveCommands` entry exists because the discarded implementation failed this gate. Passing tests cannot retroactively approve an unplanned signature.
