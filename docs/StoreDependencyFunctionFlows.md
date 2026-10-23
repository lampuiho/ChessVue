# Store dependency function flows

Revised on 23 October 2026. **Status: proposed dependency refactor; documentation only.** Keep existing composable implementations unless their upward dependency needs a cut. The [main plan](StoreDependencyRestructuringPlan.md) lists every retained alias, boundary wrapper and moved coordinator.

These trees show actual function-to-function flow. `ALIAS` leaves implementation in the composable. `WRAPPER` moves only stated boundary ordering; its core stays below. `SYNC/AWAIT/START/RESUME/WRITE` distinguish direct work, completion, existing background continuation and mutation. Qualified private names identify their defining module, not an exported object method.

Only five cyclic coordinators, seven small wrappers and two already store-owned APIs need store bodies. The other 21 public functions retain composable aliases. Whole-object factory return types preserve the implementation reference; no store callback is injected into a child.

**Call wiring only: the real execution flow must not change.** Apply the [mandatory preservation constraint](StoreDependencyRestructuringPlan.md#call-wiring-only-preserve-the-real-flow) to every tree: preserve branches, arguments/identities, operation count/order, mutations, timestamp capture, awaits, background work, completion/errors, cancellation and subscription lifetimes. Change only dependency passing, concrete method calls and the minimum placement needed to break a cycle. Keep other implementation in its composable; separate any behavioural fixes.

Compare each proposed trace against current source before implementation. These trees cannot authorise a changed flow. Focus ownership and workspace wrapper placement remain provisional until they preserve the original synchronous refresh boundaries in F20; retaining inactive listeners or moving refresh past an await is excluded.

## SDR-F01 Bootstrap and public dispatch

### Execution call tree

```text
GamesStore setup
|-- SYNC construct whole objects in the dependency table's order
|-- status({ position, record, premove }); clock({ position, status, premove, record })
|-- move({ position, status, clock, analysis, premove, record })
|-- playerTurn({ position, status, move, premove, record })
|-- boardEdit({ position, status, analysis, move, record })
|-- workspace({ position, status, clock, analysis, playerTurn, record, premove })
|-- REGISTER existing scope cleanup; focus refresh stays at existing action boundaries
`-- RETURN retained composable aliases + only necessary store coordinators/wrappers

Public name with [ALIAS] -> original composable method body
Public name with [WRAPPER] -> small boundary call -> original core body
Five cyclic coordinators -> GamesStore body -> retained lower operations
```


Construct whole objects in the [dependency table](StoreDependencyRestructuringPlan.md#complete-whole-object-dependency-graph). Keep the existing public alias when its implementation can use those objects without a cycle.

Only the five cyclic coordinators, seven small boundary wrappers and two already store-owned APIs need named store bodies. The 21 retained aliases do not gain pass-through functions. The companion trees mark every retained alias and wrapper explicitly.

GamesStore's own private coordinators call each other lexically; they are not injected into a child. Engine callbacks remain actual external delivery boundaries inside the original player-turn implementation. App-close autosave stays with App/SavedGamesStore.


## SDR-F02 Recording and autosave

### Execution call tree

```text
GamesStore.onAutosaveFailed(listener)
`-- SYNC record.onAutosaveFailed(listener)
    |-- WRITE listener Set: add actual external consumer
    `-- RETURN unsubscribe -> record removes this listener

move._applyLiveMove(...) OR move._advanceRenderedAnalysisBranch(...)
`-- SYNC record.moveCommitted(game)
    |-- SYNC UserSettingService.getSettings()
    |-- WRITE existing per-game count
    |-- if threshold not reached: RETURN
    `-- START append to existing serial save queue
        |-- AWAIT savedGames.saveGame(game, Autosave options)
        |-- success: WRITE autosaveError = ''
        `-- failure: WRITE error; SYNC registered external listeners

Any accepted existing timestamp call
`-- SYNC record.timestampGame(game)
    `-- WRITE game.metadata.updatedAt = new RecordTimestamp()
```



**Owner/API:** `record` returns `timestampGame`, `moveCommitted`, `autosaveError` and `onAutosaveFailed`. It receives the whole `savedGames` store, retains the existing move-count WeakMap, serial promise chain and listener Set.

### timestampGame(game)

Assign `game.metadata.updatedAt = new RecordTimestamp()` and return synchronously. No rendering notification, save, queue manipulation, engine work or next-turn request. Every existing caller moves to `record.timestampGame(game)` without changing when it calls it.

### moveCommitted(game)

1. Read `UserSettingService.getSettings().gameSession.autosaveAfterMoveCount`.
2. Increment that canonical game's existing count. Store zero if the interval is disabled; otherwise preserve the current modulo calculation.
3. If disabled or below the threshold, return synchronously.
4. Append work to the same serial `_autosaveQueue`: await `savedGames.saveGame(game, { targetKind: SaveGameTargetKind.Autosave })`, then clear `autosaveError.value`.
5. Catch failure in that queued work, assign the existing user-facing error text and invoke each currently registered failure listener. Keep the chain settled so a later queued write can proceed.
6. Return from `moveCommitted` without awaiting the save. The live canonical game remains the serialization input when the queued operation executes; do not invent a per-move snapshot/copy.

Migrate the existing calls after mainline and analysis-node appends. Rewinding and queue-only operations do not gain a call. Autosave policy changes are outside this relocation.

### onAutosaveFailed(listener)

Add the actual external consumer to the Set and return the existing unsubscribe closure. Unsubscribe removes that listener. Views retain their existing mount/unmount registration; no watcher or new reactive subscription is introduced. In-flight saves retain their existing domain completion/error handling during store teardown; do not abort an accepted file write or move app-close save ownership here.

The public body remains in GamesStore: `onAutosaveFailed(listener)` returns `record.onAutosaveFailed(listener)`. The lower object owns listener state; no public function is relocated out of the store.

## SDR-F03 Position and runtime functions

### Execution call tree

```text
GamesStore / move / clock / analysis / playerTurn / boardEdit / workspace
`-- SYNC position.<method>(canonical state, arguments)
    |-- node read -> requireGameRuntime -> cached node OR getNodeAtPath
    |-- board read -> shared live cache OR _genPositionAtPath
    |   |-- SYNC MoveHistoryService.getMoveSequence(tree, path)
    |   `-- SYNC MoveApplicationService.genPosition(root, moves)
    |-- path mutation -> supplied path reference + cache assignment
    `-- projection -> one detached board -> applyPremoveProjection per accepted entry
        `-- SYNC MoveApplicationService.applyMove(preview, candidate)
```



**Owner/API:** `position` retains its existing 20 returned methods. All operations use the supplied canonical game/state; none creates a second game model.

| Function and input | Calls, branches, mutation and result |
| --- | --- |
| `createGameRuntime()` | Return a fresh empty runtime object for hydration. No engine work or registration. |
| `requireGameRuntime(state)` | Return `state.$`; throw if absent. Retain this existing invariant check. |
| `getNodeAtPath(tree, path)` | Walk child indexes from `tree.root`; throw at a missing child; return the existing node. |
| `getRenderedNode(state)` | If rendered/live paths alias, cache/return `getLiveNode(state)`; otherwise return or populate `runtime.renderedNode` with `getNodeAtPath`. |
| `getLiveNode(state)` | Require `livePath`; return or populate `runtime.liveNode`. |
| `_genPositionAtPath(state, path)` | Obtain `MoveHistoryService.getMoveSequence`, then `MoveApplicationService.genPosition(rootPosition, sequence)`; return the generated board. |
| `_getAliasedLivePosition(state, livePath)` | Reuse live cache, rendered cache, or generated live board in that order; assign the same board to both cache fields; return it. |
| `getRenderedPosition(state)` | Use the aliased helper when paths are the same object; otherwise reuse/populate rendered cache. |
| `getLivePosition(state)` | Require live path; use the aliased helper at live selection; otherwise reuse/populate the live cache. |
| `setRenderedPath(state, path, cache?)` | Assign the supplied path reference and supplied optional node/position cache values, clearing unspecified rendered caches. |
| `setLivePath(state, pathOrUndefined, cache?)` | Assign that live path reference and the supplied/cleared live caches. |
| `appendRenderedPath(state, childNode)` | Require rendered path, obtain its parent node, append the actual child index, and advance an already-populated rendered-node cache. |
| `appendLivePath(state, childNode)` | Equivalent operation against live path/node/cache. Mutate the existing path, preserving any intentional rendered alias. |
| `_appendChildIndex(path, parentNode, childNode)` | Find the supplied child's actual index, throw if unattached, push it to the supplied path and return that path. |
| `invalidateRenderedPosition(state)` | Clear only `runtime.renderedPosition`. |
| `replaceMoveTree(state, moveTree)` | Assign the supplied tree and clear all live/rendered node/position caches. |
| `pathsEqual(left?, right?)` | Same reference succeeds; otherwise compare lengths/segments using the existing empty-path semantics. No mutation. |
| `isPathPrefix(prefix, candidate?)` | Require a candidate strictly longer than the prefix and compare segments. Equal paths are not a strict prefix. |
| `_hydrateMoveNode(node, parent?)` | Recursively attach each node's existing parent runtime link; root has none. |
| `getPathToNode(node)` | Walk actual parent links and child indexes to the root; throw if a child is detached; return a newly derived path value. |
| `isNodeInTree(tree, node)` | Walk and validate parent/child membership; return whether the reached root is the supplied tree's root. |
| `hydrateGame(game)` | Hydrate parent links; detach the rendered path for an explicit analysis state; otherwise alias equal live/rendered paths; replace `game.$` with a fresh runtime; return the supplied game. Caller must settle old owners before invoking this on a replacement. |

Projection functions retain their existing separate detached display-board contract:

1. `getPremoveProjection(base, queue?, heldLocalMove?)` creates **one** detached board with `MoveApplicationService.genPosition(base, [])` and one red-square Set.
2. If a held local move exists, apply it first; then apply the queued raw references in order.
3. `applyPremoveProjection(preview, move, redSquares?)` derives moving colour/piece and application kind from that preview, detects castling/promotion/en-passant using the existing facts, optionally marks endpoints and castling rook squares, and calls `MoveApplicationService.applyMove(preview, candidate)`.
4. Return `{ position: preview, redSquares }`. Do not revalidate accepted queue input, clone moves, change the queue, or mutate canonical positions.
5. Keep the existing temporary application candidate, which supplies application facts, rather than treating it as a copied transport payload.

## SDR-F04 Status predicates and result updates

### Execution call tree

```text
GamesStore.<action>(game, ...)
|-- SYNC status.assertMoveAllowed / assertExplorationAllowed / assertOngoingLiveAction
|   `-- SYNC local state predicates; optional position.isPathPrefix(...)
`-- continue only if the named guard returns

move._finaliseLiveMove(game, livePosition, ...)
`-- SYNC status.updateGameResultFromLivePosition(game, livePosition)
    |-- SYNC resolveGameResult(livePosition)
    |-- WRITE result/reason
    `-- if ended: TimeControlService.pauseClock(...); clear draw offer
```



**Owner/API:** `status` retains all existing predicates, guards, state/result calculations and simple draw offer/decline/withdraw commands. Only resignation/draw-acceptance cancellation coordination moves above it; their synchronous field bodies stay here as `finaliseResignation/finaliseDrawAgreement`. Dependencies are whole position/record/premove objects.

| Function(s) | Exact retained decision/result |
| --- | --- |
| `isLiveState(state)` | True for the two ordinary live-turn enum values. |
| `isPausedLiveState(state)` | True for the two ordinary paused-turn values. |
| `isLiveAnalysisState(state)` | True for the four unpaused live-anchor/rendered-side combinations. |
| `isPausedLiveAnalysisState(state)` | True for their four paused counterparts. |
| `isPausedState(state)` | Ordinary paused or paused live analysis. |
| `isAnyLiveAnalysisState(state)` | Either live-analysis family. |
| `isAnalysisState(state)` | Either standalone analysis enum or any live-analysis family. |
| `isLiveTurnReadyForMove(game)` | Unpaused live/live-analysis family, ongoing result and a live path. Selected rendered history does not stop actual play. |
| `getAnalysisState(colour)` | Project the colour to the matching standalone analysis enum. |
| `getLiveState(colour)` | Project to the matching ordinary live enum. |
| `getPausedState(colour)` | Project to the matching ordinary paused enum. |
| `getLiveAnalysisState(liveColour, renderedColour, paused = false)` | Select the exact enum for those three facts. |
| `getLiveAnchorColour(game)` | Derive the anchor from the current live-analysis enum; retain the existing white-family/otherwise-black mapping. |
| `canExploreAnalysis(game)` | Return `isAnyLiveAnalysisState(game.gameState)`. |
| `assertNotPausedForAction(game, action)` | Throw the existing action/state error when paused. |
| `assertExplorationAllowed(game, action)` | Reject BoardEdit; explicit live analysis bypasses the ordinary pause restriction; otherwise call the pause guard. |
| `assertOngoingLiveAction(game, action)` | Apply pause guard; require ordinary live family and `isLiveTurnReadyForMove`; otherwise throw. Ordinary review remains actual play; explicit analysis blocks result commands. |
| `assertMoveAllowed(game)` | Permit any explicit live-analysis family, including its genuine paused variants. Otherwise permit ordinary LiveWhiteTurn/LiveBlackTurn or AnalysisWhiteMove/AnalysisBlackMove; reject other states using the existing error. The existing repeated unpaused-analysis switch cases retain the same result. |
| `isOngoingLiveGame(game)` | Return the existing type predicate for ongoing result plus live path. |
| `isLiveHistoryReview(game)` | Return `position.isPathPrefix(renderedPath, livePath)`; equal paths are not review. |

`updateGameStateAfterPosition(game, positionColour)` mutates only `gameState`: finished result selects standalone analysis; otherwise preserve the current ordinary-live, paused-live or live-analysis family, using its existing anchor/pause facts. Other contexts select standalone analysis. It does not start/cancel turns.

`updateGameResultFromLivePosition(game, boardPosition)` calls `resolveGameResult(boardPosition)`, assigns result/reason, and if ended pauses the clock through `TimeControlService.pauseClock(snapshot, new ClockTimestamp())` and clears the draw offer. It does not adjudicate a selected exploratory line, timestamp, refresh subscriptions or call player turn.

## SDR-F05 Premove queue operations

### Execution call tree

```text
GamesStore.makeMove(game, rawMove) [eligible opponent-turn branch]
`-- SYNC premove.appendPremove(game, localPlayer, rawMove)
    `-- WRITE existing queue OR shallowReactive move container; push original reference

GamesStore.clearPremoves(game)
`-- SYNC premove.clearPremoves(game)
    `-- WRITE game.$.premoveQueue = undefined; no turn cancellation

move._finaliseLiveMove(game, ...)
`-- SYNC premove.revalidatePremoves(game)
    |-- no queue: RETURN
    |-- ended result: premove.clearPremoves -> RETURN
    `-- one actual-board simulation
        |-- check each candidate against that evolving board
        |-- failure: premove.clearPremoves -> RETURN
        `-- success: position.applyPremoveProjection(preview, rawMove)
```



**Owner/API:** `premove` returns `appendPremove`, `clearPremoves` and `revalidatePremoves`; it receives only `position`.

### appendPremove(game, player, rawMove)

Use the existing runtime queue or initialise `{ player, moves: shallowReactive<IMoveRaw[]>([]) }`, then push **that supplied raw object**. Return synchronously. This is the moved `_appendPremove`: no copying, chess-rule/projection check, mode/seat check or existing-queue ownership check. The intake/producer contract owns those facts.

### clearPremoves(game)

If there is no queue, return; otherwise assign `game.$.premoveQueue = undefined`. This is the existing store operation. It does not cancel an actual pending/held move, stop engines, timestamp or save. An already shifted held move remains accepted output owned by the turn mechanism.

### revalidatePremoves(game)

1. Obtain the queue through `position.requireGameRuntime(game)`; no queue means return.
2. If the actual result is no longer ongoing, call `clearPremoves(game)` and return.
3. Create one detached board from `position.getLivePosition(game)`.
4. For each queued raw reference, check its source still belongs to the queue's local colour and match target/exact promotion in `genCandidateMovesForPiece(preview, from)`.
5. On the first failure, clear the **whole** queue and return.
6. Otherwise call `position.applyPremoveProjection(preview, move)` to update the one simulation board and continue.
7. Return without changing entries or canonical state.

This retains possible-intention checks after actual board changes. It does not replace due-turn legal resolution in `playerTurn._tryPremove`.

`GamesStore.clearPremoves(game)` calls `premove.clearPremoves(game)` and returns synchronously. The store owns this API body even though this operation needs only one lower call.

## SDR-F06 Clock primitives and synchronous timeout

### Execution call tree

```text
GamesStore._commitHistoryRewriteMove(...) OR playerTurn's actual commit path
`-- SYNC clock.reconcileTimeout(game, actualCommitTimestamp)
    |-- SYNC clock.getExpiredColour(game, timestamp)
    |   |-- SYNC TimeControlService.hasExpired(snapshot, timestamp)
    |   `-- SYNC TimeControlService.getRemainingTime(snapshot, timestamp)
    |-- not expired: RETURN false
    `-- expired: clock.finaliseTimeout(game, timestamp, expiredColour)
        |-- SYNC premove.clearPremoves(game)
        |-- SYNC TimeControlService.pauseClock(snapshot, timestamp)
        |-- WRITE result/reason/state/notification flag
        |-- SYNC record.timestampGame(game)
        `-- RETURN true

move._applyLiveMove(game, detailedMove, timestamp)
`-- SYNC clock.applyMove(game, detailedMove.movingColour, timestamp)
    `-- RETURN TimeControlService.applyMove(snapshot, colour, timestamp, timeControl)
```



**Owner/API:** `clock` retains snapshot calculations and pause/resume state mutation. It exposes its existing expiry/eligibility/finalisation helpers for the higher coordinator. Only async timeout settlement, expiry routing to that settlement, and Resume's turn-delivery tail live in GamesStore. Clock receives no player-turn/store object.

- `isTimedGame(game)`: retain defined `initialMs` and non-Untimed-preset rule.
- `initialiseClockSnapshot(timeControl)`: delegate to `TimeControlService.initialiseClockSnapshot` and return its snapshot.
- `startClock(snapshot, colour, timestamp)`: delegate to the existing start service; return the new snapshot.
- `resumeClock(snapshot, timestamp)`: delegate and return.
- `applyMove(game, movingColour, timestamp)`: call `TimeControlService.applyMove(game.clockSnapshot, movingColour, timestamp, game.timeControl)`; return its next snapshot, including the existing increment.
- `pauseClock(snapshot, timestamp)`: a new implemented wrapper over the existing pause service, allowing higher control to use the whole clock owner.
- `_hasRunningClock(snapshot)`: retain its private active-colour/start-time/running-side test.
- `canPauseForReason(game, reason)`: existing `_canPauseForReason`; Analysis reason or already paused succeeds; otherwise require a timed running clock. This does not add an analysis-owned pause to analysis entry.

`getExpiredColour(game, timestamp)` is the existing exposed expiry query: return undefined unless result is ongoing, state is ordinary live/paused/live-analysis, and `TimeControlService.hasExpired` succeeds. Read `TimeControlService.getRemainingTime`; return White when `(remaining.white ?? 1) <= 0`, otherwise Black. It does not mutate anything.

`finaliseTimeout(game, timestamp, expiredColour)` is the existing field transition: clear the queue; set `timeoutNotificationShown = false`; pause the snapshot; assign winner, Timeout reason and matching analysis state; timestamp through record. It no longer refreshes registrations. It trusts the accepted expiry; it does not cancel/await a turn.

`reconcileTimeout(game, timestamp)` calls the expiry query and, when expired, finalises synchronously and returns true; otherwise returns false. Commitment calls this **before any board append or increment**. Async turn cancellation for external clock ticks belongs to F14, not this lower helper.

The retained `clock.pauseGame(game, reason, timestamp)` and `clock.resumeGame(game, reason, timestamp)` core contracts are expanded in F14. The store wrapper supplies a timestamp after a synchronous expiry check; core state mutation stays in this composable.

## SDR-F07 Analysis seat lifecycle

### Execution call tree

```text
GamesStore.getVisibleAnalysis(game) [ALIAS -> analysis.getVisibleAnalysis]
`-- RETURN analysis.getVisibleAnalysis(game)

GamesStore.addAnalysisEngine(game, profile) [ALIAS -> analysis.addAnalysisEngine]
`-- RETURN/AWAIT analysis.addAnalysisEngine(game, profile)
    `-- validate seat policy -> createAnalysisSeat -> append -> record.timestampGame

GamesStore.removeAnalysisEngine(game, index) [ALIAS -> analysis.removeAnalysisEngine]
`-- AWAIT analysis.removeAnalysisEngine(game, index)
    |-- SYNC _disposeAnalysisSubscription(engine); remove seat; record.timestampGame
    `-- AWAIT _stopAssignedEngine(engine) -> EngineRuntimeService.stopEngine(engine)

GamesStore.refreshAnalysis(game) [ALIAS -> analysis.refreshAnalysis]
`-- AWAIT analysis.refreshAnalysis(game)
    `-- analysis.refreshAnalysisForGame(game)

GamesStore.retryAnalysis(game, index) [ALIAS -> analysis.retryAnalysis]
`-- AWAIT analysis.retryAnalysis(game, index)
    `-- analysis.refreshAnalysisForGame(game, index)

GamesStore.stopAnalysis(game, index?) [ALIAS -> analysis.stopAnalysis]
`-- AWAIT analysis.stopAnalysis(game, index)
    |-- SYNC _getTargetSeats -> _disposeAnalysisSubscription for each target
    `-- AWAIT EngineRuntimeService.stopAnalysis for all targets; retain displayed lines

analysis.refreshAnalysisForGame(game, index?)
|-- SYNC _getTargetSeats
|-- SYNC _disposeAnalysisSubscription + _clearAnalysisSeatLines for ALL targets
|-- SYNC position.getRenderedPosition(game); record.timestampGame(game)
|-- BoardEdit: AWAIT analysis.stopAnalysis(...)
`-- otherwise: AWAIT all _startAnalysisSeat(game, seat) startup work
    |-- SYNC EngineRuntimeService.ensureRuntime + shallow runtime boundary
    |-- SYNC _subscribeToAnalysis(game, seat)
    |   `-- REGISTER EngineRuntimeService.subscribeToAnalysis(engine, callback)
    |       `-- on accepted update: WRITE current seat fields; record.timestampGame(game)
    `-- AWAIT EngineRuntimeService.startAnalysis(engine, game, options)
```



**Owner/API:** `analysis` retains all ten existing returned methods and its assigned-engine disposer WeakMap. Public methods keep their existing GamesStore aliases. Only the injected timestamp function becomes a whole `record` dependency; no feature implementation or new scope API moves.

### Seat construction and streaming

1. `_createAssignedEngine(profile)` retains the existing persisted assignment snapshot, including copied options and no shared engine runtime.
2. `createAnalysisSeat(profile, updatedAt)` returns the existing assignment, AnalysisTimestamp, empty lines and incomplete flag.
3. `_resolveAnalysisSeat(game, engine)` finds the seat by actual assigned-engine identity.
4. `_disposeAnalysisSubscription(engine)` invokes/removes that engine's registered disposer.
5. `_subscribeToAnalysis(game, seat)` first detaches the prior subscription, then subscribes to `EngineRuntimeService`. Its local active lifetime and seat membership identify the actual subscription owner.
6. On an accepted update, skip a detached/replaced seat or BoardEdit; assign its timestamp, bestMove, first three lines and final flag; call `record.timestampGame(game)`. Do not wait for another engine's update.
7. The stored disposer closes that lifetime and unsubscribes. The returned current-owner predicate remains an actual seat/subscription check, not a generation/version mechanism.
8. `_startAnalysisSeat(game, seat)` establishes `shallowReactive(toRaw(EngineRuntimeService.ensureRuntime(engine)))` over the same backing runtime; subscribes; updates seat time; awaits `EngineRuntimeService.startAnalysis(engine, game, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite })`; handles non-cancellation startup failure only for its current owner; timestamps in the existing current-owner finally path.

### refreshAnalysisForGame(game, engineIndex?)

`_getTargetSeats` returns all seats as the current target list, or the selected seat/empty list. For **all** targets, detach subscriptions and clear bestMove/lines/completion synchronously through `_clearAnalysisSeatLines` before starting any asynchronous work. Ensure the rendered-position cache exists. In BoardEdit, call `stopAnalysis`; otherwise start all targets with `Promise.all`. Timestamp immediately and return the promise mapped to no result. Engine B must be able to start/update while A's startup is pending.

### Queries, capture and commands

| Function | Calls, mutations and completion |
| --- | --- |
| `getVisibleAnalysis(game)` | Return undefined with no seats; otherwise the current seat projection with the existing array handling. No engine work. |
| `captureMoveAnalysis(game)` | Require value-equal rendered/live paths through `position.pathsEqual`; take seats with lines and schema-project them into the existing recorded-analysis snapshot with AnalysisTimestamp; return undefined when empty. These persistence snapshots are not copied move transport. |
| `addAnalysisEngine(game, profile)` | Reject duplicate display name or more than four seats; append a constructed seat; timestamp. Retain its existing completion and do not implicitly add a new refresh/start policy. |
| `removeAnalysisEngine(game, index)` | Missing seat returns; detach that captured seat, begin `_stopAssignedEngine`, remove it from the game and timestamp before awaiting cleanup. Late output cannot reinsert it. |
| `_stopAssignedEngine(engine)` | Await `EngineRuntimeService.stopEngine`; swallow cancellation and log other failures as currently handled. |
| `disposeAnalysisForGame(game)` | Detach all captured seat subscriptions immediately and await all engine stops, independently. No seat recreation. |
| `refreshAnalysis(game)` | Reject BoardEdit; await `refreshAnalysisForGame(game)`. |
| `retryAnalysis(game, index)` | Reject BoardEdit; await refresh of only that target. |
| `stopAnalysis(game, index?)` | For all chosen seats detach first, await `EngineRuntimeService.stopAnalysis`, handle errors as existing, and timestamp only if the same seat remains with no replacement subscription. Retain accepted displayed lines. |

No startup completion or failure can clear/publish over a later A-B-A subscription. Preserve the current engine operation owners and stop-drain protocol below this module.

## SDR-F08 Move commitment

### Execution call tree

```text
playerTurn._commitAndRequestNext(game, detailedMove)
`-- SYNC move.commitLiveMove(game, detailedMove)
    |-- SYNC clock.reconcileTimeout(game, commitTimestamp)
    |   `-- expired: RETURN without append/increment
    |-- SYNC position.getLiveNode/getLivePosition
    |-- ordinary live prune rule: MoveHistoryService.pruneFutureMoves(parent)
    |-- SYNC move._applyLiveMove(game, detailedMove, timestamp)
    |   |-- SYNC clock.applyMove(game, movingColour, timestamp) -> nextSnapshot
    |   |-- SYNC analysis.captureMoveAnalysis(game) -> recordedAnalysis
    |   |-- SYNC MoveApplicationService.applyMove(actualPosition, detailedMove)
    |   |-- SYNC MoveHistoryService.addMainlineMove(parent, move, nextSnapshot)
    |   |-- WRITE recordedAnalysis; position.appendLivePath; game.clockSnapshot
    |   `-- SYNC record.moveCommitted(game)
    `-- SYNC move._finaliseLiveMove(game, actualPosition, isLiveRendered)
        |-- SYNC status.updateGameResultFromLivePosition(...)
        |-- WRITE final clock snapshot/state family
        |-- SYNC premove.revalidatePremoves(game)
        `-- START move.refreshRenderedAnalysis(game, isLiveRendered)
            |-- changed: analysis.refreshAnalysisForGame(game)
            `-- unchanged: record.timestampGame(game); resolved promise

GamesStore._commitHistoryRewriteMove(...) [selected context accepted after cancellation]
`-- SYNC move.commitHistoryMove(game, detailedMove, selectedPath, selectedNode, selectedPosition)
    |-- SYNC premove.clearPremoves; position.setLivePath(selected context)
    |-- SYNC clock.startClock(selectedSnapshot, side, timestamp); WRITE live state
    |-- SYNC clock.reconcileTimeout(game, timestamp); expired: RETURN
    |-- SYNC move._applyLiveMove(...)
    `-- SYNC move._finaliseLiveMove(...); no ordinary live pruning

GamesStore.makeMove(...) [selected analysis branch]
`-- SYNC move.commitLiveAnalysisMove OR move.commitStandaloneAnalysisMove
    |-- SYNC move._advanceRenderedAnalysisBranch(...)
    |   |-- detach actual board only when aliased
    |   |-- MoveApplicationService.applyMove -> MoveHistoryService.addAnalysisMove
    |   `-- position.setRenderedPath/cache; record.moveCommitted
    |-- WRITE selected-mode state, preserving actual result/clock
    `-- START move.refreshRenderedAnalysis(game)

GamesStore.takeBack(...) [old turn and engines already settled]
`-- SYNC move.rewind(game, targetNode, count, hadLivePath)
    |-- MoveHistoryService.takeBack -> position.getPathToNode
    |-- WRITE rendered/live path and fallback cache/result/state/clock
    `-- RETURN move.refreshRenderedAnalysis(game, changed) promise

GamesStore.applyBoardEdit/resetBoardToStartPosition OR boardEdit._applyEdit
`-- SYNC move.replaceWithAnalysisRoot(game, rootPosition, nextState)
    |-- premove.clearPremoves; clock.initialiseClockSnapshot
    |-- MoveHistoryService.createMoveTree; position.replaceMoveTree/set paths
    |-- WRITE root/clock/result/state
    `-- START move.refreshRenderedAnalysis(game)
```



**Owner/API:** `move` retains move resolution/commitment, rewind mutation, count calculation, navigation and enter/exit-analysis core. Only makeMove intake, awaited history/takeback coordination and upward successor-request tails leave this module. It never receives playerTurn or GamesStore.

### resolveMove(parentPosition, rawMove, lastMove?)

Require integer board IDs in 0..63. Match `genLegalMovesForPiece(parentPosition, from, lastMove)` by exact target/promotion; throw the existing invalid/illegal error if absent. Return `toDetailedMove(parentPosition, candidate)`. Supplied detailed facts never replace canonical enrichment.

### refreshRenderedAnalysis(game, changed = true)

When changed, return `analysis.refreshAnalysisForGame(game)`. Otherwise timestamp and return an already-resolved promise. This preserves the existing distinction between a changed rendered board and background actual progress. Callers retain whether they await or intentionally start this handled work.

### _applyLiveMove(game, detailedMove, timestamp)

Get actual node/position; calculate the next clock through `clock.applyMove`; capture relevant recorded analysis; apply to the actual board; add the mainline node with its clock snapshot; attach the captured recorded analysis; append the live path; assign the next game snapshot; call `record.moveCommitted`; return that next node. Use canonical references, preserving aliased rendered state.

### _finaliseLiveMove(game, livePosition, isLivePositionRendered)

Update actual rule result via status. If ended, update the new live node's final clock snapshot. Derive rendered side from live state only when that board is rendered; otherwise use the independent rendered cache. Assign the correct ended-analysis, live-analysis or ordinary-live state. Revalidate remaining premoves. Start `refreshRenderedAnalysis(game, isLivePositionRendered)` with existing handled completion.

**Removed calls:** no registration refresh and no player-turn request. Those are the two upward responsibilities that caused cycles.

### commitLiveMove(game, detailedMove)

1. Require the existing live path; capture one ClockTimestamp.
2. Call `clock.reconcileTimeout`; if true, return without increment, append or save count.
3. Determine whether rendered/live paths are the same reference; obtain actual parent/position.
4. Preserve ordinary live pruning: if future children exist and the actual path is not a strict prefix of the rendered path, prune the actual parent's future moves.
5. Call `_applyLiveMove`, then `_finaliseLiveMove`, synchronously.
6. Return with the existing commitment completion. The caller owns the successor request.

### commitHistoryMove(game, detailedMove, selectedPath, selectedNode, selectedPosition)

The store has only awaited cancellation and reaccepted selected context. Keep the accepted mutation here: clear queue; obtain one commit timestamp; install the selected live path/cache; start that node's clock snapshot and ordinary live state; reconcile expiry; apply and finalise through the existing private helpers.

There is no await, selected-context recheck, ordinary live pruning or successor request in this lower helper. It retains the original non-pruning history rewrite. The next request belongs to the store coordinator.

### Analysis commits and root replacement

- `_advanceRenderedAnalysisBranch(game, parentNode, parentPosition, detailedMove)`: detach the board only if it is the actual cached position; apply the move; add an analysis child; set the derived rendered path/cache; record the existing move-count call; return the rendered board.
- `commitLiveAnalysisMove(game, parentNode, parentPosition, detailedMove)`: use that helper, preserve actual anchor and genuine pause while assigning the rendered side, then start rendered-analysis refresh. Do not update actual result/clocks or cancel the actual provider.
- `commitStandaloneAnalysisMove(game, parentNode, parentPosition, detailedMove)`: use that helper, apply `status.updateGameStateAfterPosition`, then start refresh. Existing finished result/reason remain retained during post-game exploration.
- `replaceWithAnalysisRoot(game, rootPosition, nextState)`: clear queue; initialise the current time control's clock snapshot; assign supplied root; create/replace tree; set rendered path/root cache; remove live path; assign snapshot; reset result/reason/draw; assign requested state; start rendered-analysis refresh. The caller already owns eligibility and any required teardown.

### getTakeBackMoveCount(game) and rewind(game, targetNode, moveCount, hadLivePath)

`getTakeBackMoveCount` retains the existing actual-node/Local-versus-Engine parent walk; the public store wrapper calls it.

`rewind` is the synchronous mutation portion of the current takeback, invoked only after GamesStore cancels/stops old player work and clears the queue. Call `MoveHistoryService.takeBack(targetNode, moveCount)`; derive fallback path/change; assign selected path/cache and the same live path/cache when applicable; reset ongoing result/reason; obtain fallback board; restore/start its node clock and live state, or call `status.updateGameStateAfterPosition` for analysis. Return `refreshRenderedAnalysis(game, changed)`'s promise after starting it. GamesStore requests the next actual turn before awaiting that returned work. No queue clear, player-engine stop or turn restart is hidden in this lower method.

## SDR-F09 The existing player-turn mechanism

### Execution call tree

```text
playerTurn.requestPlayerMoveIfNeeded(game)
|-- state not ready / original Deferred already exists: RETURN
`-- SYNC playerTurn._requestPlayerMove(game)
    |-- create ORIGINAL Deferred + controller
    |-- START playerTurn._playerMoveHandler(originalDeferred) [waits here]
    |-- WRITE original Deferred, original handler and controller to game.$
    |-- Engine: START _requestEngineMove(assignedEngine)
    |   |-- AWAIT EngineRuntimeService.ensureReady(engine, capturedSignal)
    |   `-- AWAIT EngineRuntimeService.startPlayerTurn(engine, game, callback, signal)
    |       `-- callback: AWAIT playerTurn.attemptPlayerMove(game, deliveredMove)
    `-- Local: START _tryPremove(game)
        |-- no queue: RETURN; same Deferred waits for ordinary input
        |-- resolve actual legal head through position + genLegalMovesForPiece
        |-- illegal: premove.clearPremoves; RETURN; same Deferred still waits
        `-- legal: shift once synchronously; AWAIT attemptPlayerMove(game, detailedMove)

playerTurn.attemptPlayerMove(game, detailedMove)
|-- originalDeferred.resolve(detailedMove)
`-- AWAIT original handler (does not create/call a new handler)
    `-- RESUME playerTurn._playerMoveHandler(originalDeferred)
        |-- FINALLY clear original pending fields before successor registration
        |-- genuinely paused: WRITE existing deferredPlayerMove; RETURN
        `-- active: SYNC _commitAndRequestNext(game, detailedMove)
            |-- SYNC move.commitLiveMove(game, detailedMove) [F08 -> clock]
            `-- SYNC requestPlayerMoveIfNeeded(game); existing duplicate/result guards

playerTurn.clearPlayerTurnRuntime(game)
|-- SYNC clear existing held move
`-- AWAIT _clearPendingPlayerTurn(runtime)
    |-- abort captured controller; reject captured Deferred
    `-- AWAIT captured existing handler cancellation/finally

playerTurn.flushDeferredPlayerMove(game)
|-- read/remove existing held slot; not ready: RETURN
`-- SYNC _commitAndRequestNext(game, heldMove) -> same F08 path

_playerMoveHandler genuine failure
`-- START existing 500 ms retry timer
    `-- playerTurn.requestPlayerMoveIfNeeded(game), with existing eligibility/pending checks
```



**Owner/API:** `playerTurn` retains all nine existing methods, including `reassignPlayer`. Replace callback dependencies with whole position/status/move/premove/record objects. Keep the Deferred, handler, controller, held output, provider and retry implementation. Only the successor request previously made by move finalisation is performed after commitment here.

### Snapshot and player queries

- `createPlayerSnapshot(player?)`: return undefined if absent; otherwise schema-project the existing persisted player snapshot, call `_initialisePlayerRuntime` and return it.
- `normalisePlayers(game)`: initialise each supplied white/black player's runtime in place.
- `_initialisePlayerRuntime(player)`: assign existing Active player runtime; for an engine player establish the existing shallow-reactive `EngineRuntimeService.ensureRuntime` boundary. Do not share a profile's mutable assignment.
- `getSideToMovePlayer(game, colour)`: return the existing player at that colour.
- `isEnginePlayer(player?)`: retain the Engine-type predicate. These helpers do not request a move.

### requestPlayerMoveIfNeeded(game) and _requestPlayerMove(game)

1. Retain the existing `status.isLiveTurnReadyForMove` and pending-Deferred duplicate-start checks.
2. `_requestPlayerMove` obtains actual colour/player via `position.getLivePosition`; require that no pending turn already exists.
3. Create the existing AbortController and `Deferred<IMove>`; start the existing `_playerMoveHandler` waiting on that Deferred.
4. Store **the original** Deferred, handler promise and controller in `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise` and `pendingPlayerTurnAbortController` before dispatch.
5. For Engine, start the existing `_requestEngineMove` and route its rejection into the captured Deferred. For Local, call existing `_tryPremove`; handle its failure as currently logged. Other existing eligibility behaviour is retained.
6. Return after registration/dispatch; do not await a user's future move, provider drain or another turn.

### _requestEngineMove(engine)

Await `EngineRuntimeService.ensureReady(engine, capturedController.signal)`, then the existing `startPlayerTurn(engine, game, callback, signal)`. Its callback checks the captured abort signal and awaits `attemptPlayerMove(game, detailedMove)`. Retain the runtime service's readiness cancellation and protocol/pondering semantics; never redirect a cancelled callback into a new turn's Deferred.

### _tryPremove(game)

1. Obtain the current runtime queue; absent queue returns and leaves the registered Local Deferred waiting.
2. Trust that the queue is nonempty and belongs to the accepted local context. Read its existing head reference.
3. Resolve the actual board/node with `position.getLivePosition/getLiveNode`; match head target/exact promotion in `genLegalMovesForPiece`.
4. If illegal, `premove.clearPremoves(game)` and return, leaving the **same** Local request waiting for ordinary input.
5. Enrich the accepted legal candidate to a detailed actual move; shift the FIFO once and remove an emptied queue.
6. Immediately call and await existing `attemptPlayerMove(game, detailedMove)`. All work through the shift happens synchronously before waiting.
7. Never call move commitment directly, reserve/claim a head, wait for another acknowledgement, alter rendered selection or feed the raw head through selected-board `makeMove`.

### attemptPlayerMove(game, detailedMove)

Read the current existing Deferred and handler promise; throw the existing invariant error if either is absent. Resolve that Deferred with the supplied detailed move and await **that handler**. Cancellation may already have rejected it; resolving a settled Deferred has no new delivery effect. Return after the existing handler settles, not after the successor engine finishes.

### _playerMoveHandler(pendingPlayerMove)

1. Await its captured Deferred.
2. On cancellation, retain existing handled cancellation. On genuine failure, log and schedule the existing 500 ms `requestPlayerMoveIfNeeded(game)` retry.
3. In the existing finally boundary, clear the pending Deferred/handler/controller fields before any successor request. All normal replacement actions await the actual handler before starting another owner.
4. After successful delivery, if genuinely paused, assign the accepted detailed move to existing `runtime.deferredPlayerMove` and finish without canonical commitment.
5. Otherwise call private `_commitAndRequestNext(game, detailedMove)`: invoke whole `move.commitLiveMove`, then existing `requestPlayerMoveIfNeeded`. The latter's normal state/result/pending checks suppress successors after timeout/mate or duplicate wake.
6. Return with the original handler semantics. The moved successor call remains synchronous after commitment; there is no drain loop or different resolver.

Retain the existing 500 ms retry timing, entry point, failure handling and cancellation implementation. Do not add a retry owner, scheduler or unrelated lifecycle redesign as part of this dependency change.

### clearPlayerTurnRuntime(game)

Clear the existing held move via `_clearDeferredPlayerMove(runtime)`. Then await existing `_clearPendingPlayerTurn(runtime)`: capture the actual Deferred, handler and controller; if absent return; abort with `Aborted`, reject the captured Deferred and await its handler. No new provider-draining wait, replacement completion promise or queue clearing is added.

This operation alone still does not indiscriminately stop every player engine. Existing callers retain their explicit stop sites, described in F12, F16 and F20.

### flushDeferredPlayerMove(game)

Read the held move; absent returns. Remove the held slot before delivery. If actual play is no longer ready, return without committing. Otherwise use the same `_commitAndRequestNext` helper as successful handler delivery. Return after this existing synchronous commitment path. Final Resume may then call `requestPlayerMoveIfNeeded` again; the existing pending check keeps this harmless.

```mermaid
sequenceDiagram
  participant Turn as playerTurn
  participant Pending as Existing Deferred and handler
  participant Queue as premove queue
  participant Commit as move
  Turn->>Pending: register Deferred, handler and controller
  Turn->>Queue: resolve actual legal head; shift once
  Turn->>Pending: attemptPlayerMove resolves original Deferred
  alt Genuine pause before handler resumes
    Pending->>Turn: store deferredPlayerMove
    Note over Turn,Commit: Final Resume flushes held move once
  else Actual play remains active
    Pending->>Commit: commitLiveMove(game, detailedMove)
    Commit-->>Pending: canonical transition complete
    Pending->>Turn: requestPlayerMoveIfNeeded(game)
  end
```

## SDR-F10 Public move intake

### Execution call tree

```text
GamesStore.makeMove(game, rawMove) [CYCLIC COORDINATOR]
|-- SYNC status.assertMoveAllowed(game)
|-- SYNC position.getRenderedNode(game) -> parentNode
|-- SYNC position.getRenderedPosition(game) -> parentPosition
|-- SYNC status.isOngoingLiveGame / isAnyLiveAnalysisState -> branch facts
|-- at actual selection outside explicit analysis:
|   |-- SYNC playerTurn.getSideToMovePlayer(game, parentPosition.sideToMove)
|   |-- eligible opponent Engine turn:
|   |   `-- SYNC premove.appendPremove(game, localPlayer, rawMove); RETURN
|   `-- wrong actual Local ownership: THROW; no cancellation/queue edit
|-- SYNC move.resolveMove(parentPosition, rawMove, parentNode.move) -> detailedMove
`-- ONE matching route, in order:
    |-- no ongoing actual game:
    |   `-- SYNC move.commitStandaloneAnalysisMove(game, parentNode, parentPosition, detailedMove)
    |-- explicit live analysis:
    |   `-- SYNC move.commitLiveAnalysisMove(game, parentNode, parentPosition, detailedMove)
    |-- permitted strict actual history review:
    |   `-- AWAIT GamesStore._commitHistoryRewriteMove(game, detailedMove) [F11]
    |-- other non-live selection: THROW instruction to enter analysis
    `-- ordinary current Local turn:
        `-- AWAIT playerTurn.attemptPlayerMove(game, detailedMove) [F09]
            `-- RESUME existing handler -> move.commitLiveMove -> clock calls [F08]
```



**Entry:** named `makeMove(game, rawMove)` body in `GamesStore.ts`; it is returned as `makeMove`, not as an alias to another module.

1. Call `status.assertMoveAllowed`; obtain selected node/position and ongoing-live/explicit-analysis facts.
2. At actual live selection outside explicit analysis, obtain the actual player and the existing Local-versus-Engine pairing.
3. If this is the opponent Engine turn with that eligible Local seat, call `premove.appendPremove(game, localPlayer, rawMove)` and return immediately. Do not resolve/project/copy speculative input.
4. Otherwise require the actual player to be Local; retain the existing wrong-turn error.
5. For all ordinary accepted move routes, call `move.resolveMove(selectedPosition, rawMove, selectedNode.move)` **before any awaited cancellation**.
6. Without ongoing actual play, call `move.commitStandaloneAnalysisMove`.
7. In explicit live analysis, call `move.commitLiveAnalysisMove`.
8. In allowed strict historical review, await `GamesStore._commitHistoryRewriteMove` from F11.
9. If still off the live path without that permission, throw the existing instruction to enter analysis.
10. Otherwise await `playerTurn.attemptPlayerMove(game, detailedMove)`.

Steps 6-10 form one ordered if/else chain: dispatch exactly one route and then return. The public action remains async. Analysis routes retain their current commitment/start-refresh completion rather than waiting for infinite analysis output. Actual input awaits the existing handler, including its canonical commitment, not a successor turn. Invalid ordinary raw input cannot cancel an active provider or clear intentions.

## SDR-F11 History rewrite

### Execution call tree

```text
GamesStore._commitHistoryRewriteMove(game, detailedMove)
|-- SYNC position.getRenderedNode/getRenderedPosition; capture renderedPath reference
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
|-- recheck actual result, selected path/node, mode/pause and takeback permission
|   `-- abandoned: playerTurn.requestPlayerMoveIfNeeded(game); RETURN
|-- SYNC move.commitHistoryMove(game, detailedMove, capturedPath, capturedNode, capturedPosition)
|   |-- premove.clearPremoves; position.setLivePath(selected context)
|   |-- clock.startClock(selectedSnapshot, selectedSide, timestamp); WRITE live state
|   |-- clock.reconcileTimeout(game, timestamp); expired: RETURN
|   |-- move._applyLiveMove -> clock.applyMove -> canonical board/node/record
|   `-- move._finaliseLiveMove -> status result -> queue revalidation -> analysis
`-- SYNC playerTurn.requestPlayerMoveIfNeeded(game); RETURN

Only await/reaccept/restart moves to GamesStore; accepted history mutation stays in move.
```


**Moved part only:** `GamesStore._commitHistoryRewriteMove(game, detailedMove)` captures selected node/position/path, awaits the original `playerTurn.clearPlayerTurnRuntime`, and rechecks result, actual selected ownership, mode/pause and takeback permission.

If this selected context was released, request eligible play and return without clearing intentions or mutating history. Otherwise call `move.commitHistoryMove(game, detailedMove, path, node, position)`, then request the eligible actual successor.

**Retained part:** clock/path preparation, queue clear, expiry-before-increment, canonical append, rule result and rendered-analysis work stay in move's accepted history helper. The complete call chain above expands that lower clock work. Existing selected-context guards protect an actual changing owner, not a numeric token.


## SDR-F12 Takeback

### Execution call tree

```text
GamesStore.getTakeBackMoveCount(game) [ALIAS -> move.getTakeBackMoveCount]
`-- RETURN move.getTakeBackMoveCount(game)
    `-- SYNC position.getLiveNode/getRenderedNode; parent walk to prior Local move

GamesStore.takeBack(game, count = getTakeBackMoveCount(game)) [CYCLIC COORDINATOR]
|-- SYNC status.assertExplorationAllowed/assertNotPausedForAction
|-- reject forbidden actual takeback; count <= 0: RETURN
|-- SYNC position.getLiveNode OR getRenderedNode -> capturedTarget
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
|-- AWAIT all explicit EngineRuntimeService.stopEngine(player.assignedEngine)
|-- SYNC premove.clearPremoves(game)
|-- SYNC move.rewind(game, capturedTarget, count, hadLivePath) -> analysisWork
|   |-- MoveHistoryService.takeBack -> position.getPathToNode
|   |-- position.setRenderedPath; optional setLivePath using same fallback reference
|   |-- WRITE ongoing result/reason and fallback clock/state
|   |-- clock.startClock(...) when actual play exists
|   `-- START move.refreshRenderedAnalysis(game, changed); RETURN its promise
|-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
`-- AWAIT analysisWork; RETURN (does not await successor move)
```


`getTakeBackMoveCount` stays entirely in move with the existing public alias. It selects actual/rendered node, handles empty history/standalone analysis/other pairings, and walks parents to the prior Local-colour move for a Local-versus-Engine game.

Only `takeBack` cancellation/restart orchestration moves to GamesStore. Retain guards and target capture, await the original turn clear and explicit engine stops, clear queue, then call `move.rewind(game, targetNode, count, hadLivePath)`. Request eligible actual play before awaiting that helper's already-started analysis-work promise.

The original tree/path/clock/result mutation remains in `move.rewind` as detailed in F08. Rewind gains no move-count event, provider acknowledgement, registration callback or analysis pause.


## SDR-F13 Navigation and analysis mode

### Execution call tree

```text
GamesStore.navigateToNode(game, node) [WRAPPER]
|-- SYNC move.navigateToNode(game, node) -> returnedToLive
|   |-- status.assertExplorationAllowed; position.isNodeInTree
|   |-- position.getPathToNode; choose actual or independent selected path
|   |-- actual target: move._returnToLiveNode(game); RETURN true
|   `-- other target: WRITE selected cache/state; START refreshRenderedAnalysis; RETURN false
|-- returnedToLive AND status.isLiveTurnReadyForMove(game):
|   `-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
`-- RETURN public void result, not internal flag

GamesStore.enterInGameAnalysis(game) [ALIAS -> move.enterInGameAnalysis]
`-- move.enterInGameAnalysis(game) [full implementation retained]
    |-- existing eligibility checks
    |-- position reads; one detached selected board/path
    |-- WRITE live-analysis state with actual anchor/pause preserved
    `-- START move.refreshRenderedAnalysis(game, false)

GamesStore.exitInGameAnalysis(game) [WRAPPER]
|-- SYNC move.exitInGameAnalysis(game) -> returnedToLive
|   |-- existing eligibility checks; ineligible: RETURN false
|   `-- move._returnToLiveNode(game); RETURN true
|-- returnedToLive AND status.isLiveTurnReadyForMove(game):
|   `-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
`-- RETURN public void result

move._returnToLiveNode(game) [implementation stays in move]
|-- position.getLiveNode/getLivePosition
|-- position.setRenderedPath(game, ORIGINAL livePath, live cache)
|-- WRITE ended/paused/live state through status helpers
`-- START move.refreshRenderedAnalysis(game, changed); no upward turn call
```


**Keep the implementation in move.** `enterInGameAnalysis` keeps its alias and unchanged body. `navigateToNode`, `exitInGameAnalysis` and private `_returnToLiveNode` retain their guards, canonical references, mode projection and rendered-analysis operations.

The necessary cut is only `_returnToLiveNode -> playerTurn.requestPlayerMoveIfNeeded`. Remove that upward call and let the lower navigate/exit method return an internal boolean indicating it actually returned to live.

The two store wrappers invoke the lower method; only when it reports true and status says actual play is ready do they request player turn. They discard the internal flag and keep the existing public void result. Ordinary navigation returns false; invalid nodes/exit eligibility also report false. No repeated context/rule validation is added.

The retained return-to-live helper aliases the ORIGINAL live path and live cache back to the selected board, projects ended/paused/live state and starts rendered refresh. It does not prune immediately, replay engine output, alter genuine pause reasons or restart an existing request.


## SDR-F14 Clock control and focus return

### Execution call tree

```text
GamesStore.syncClock(game, timestamp) [CYCLIC COORDINATOR]
|-- same game has pending settlement: RETURN same promise
|-- SYNC clock.getExpiredColour(game, timestamp); no expiry: RETURN resolved promise
`-- START/RETURN GamesStore._settleTimeout(game, timestamp, expiredColour)
    |-- capture current clockSnapshot
    |-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
    |-- same snapshot still owned and result ongoing:
    |   `-- clock.finaliseTimeout -> queue clear, stopped snapshot, result/state/timestamp
    `-- FINALLY remove pending-settlement entry

GamesStore.pauseGame(game, reason) [WRAPPER]
|-- capture timestamp; SYNC clock.getExpiredColour(game, timestamp)
|-- expired: RETURN/AWAIT GamesStore.syncClock(game, timestamp)
`-- SYNC clock.pauseGame(game, reason, timestamp) [core stays in clock]
    |-- clock.canPauseForReason; ineligible: RETURN
    |-- already paused: add reason once; record.timestampGame; RETURN
    |-- existing actual-state/result guards
    |-- WRITE reasons; TimeControlService.pauseClock; WRITE paused family
    `-- record.timestampGame; RETURN

GamesStore.resumeGame(game, reason) [WRAPPER]
|-- existing paused/ongoing eligibility; otherwise RETURN
|-- capture timestamp; SYNC clock.getExpiredColour(game, timestamp)
|-- expired: RETURN/AWAIT GamesStore.syncClock(game, timestamp)
|-- SYNC clock.resumeGame(game, reason, timestamp) -> shouldDeliver [core stays in clock]
|   |-- remove only this reason
|   |-- other reasons remain: timestamp; RETURN false
|   |-- resume snapshot; WRITE state; record.timestampGame
|   `-- RETURN status.isLiveTurnReadyForMove(game)
`-- if shouldDeliver:
    |-- AWAIT playerTurn.flushDeferredPlayerMove(game) -> original commit path [F09/F08]
    `-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
```


### syncClock and _settleTimeout: move only the cyclic coordinator

GamesStore owns the existing pending-timeout WeakMap. `syncClock(game, timestamp)` returns an already pending promise for that game, otherwise queries `clock.getExpiredColour`; no expiry returns a resolved promise. On expiry retain/return `_settleTimeout`.

The private settlement captures the actual clock snapshot, awaits the original turn clearing and calls `clock.finaliseTimeout` only while that snapshot is still current and result ongoing. Remove the pending entry in finally. This is the existing actual-owner guard, not a generation/version mechanism.

### pauseGame: core remains in clock

The thin store wrapper captures a timestamp and routes detected expiry to its own syncClock. Otherwise call retained `clock.pauseGame(game, reason, timestamp)`.

The core retains `canPauseForReason`, already-paused reason deduplication, actual-state/result checks, pause snapshot, enum projection and metadata timestamp. There is no player-turn dependency. Public completion remains the existing async store action contract.

### resumeGame: core remains in clock

The thin store wrapper preserves the original paused/ongoing guard before expiry handling. On accepted non-expired input, call retained `clock.resumeGame(game, reason, timestamp)`.

That core removes only the supplied reason; if another owner remains, timestamp and return false. Otherwise resume snapshot, choose the existing state family, timestamp and report actual readiness. Only a true result causes the store wrapper to await the existing held-move flush and call the existing next-turn request. Do not expose the internal boolean through the public API.

### External focus callback

GamesStore registers a real platform event callback that calls its lexical syncClock. No low-level composable receives that callback as a dependency. F20 defines the resource lifetime.


## SDR-F15 Result and draw actions

### Execution call tree

```text
GamesStore.resignGame(game, colour) [CYCLIC COORDINATOR]
|-- status.assertOngoingLiveAction(game, 'Resignation')
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
`-- SYNC status.finaliseResignation(game, colour) [field implementation stays in status]
    |-- premove.clearPremoves; TimeControlService.pauseClock
    |-- WRITE opponent winner, Resignation, analysis state and no offer
    `-- record.timestampGame(game)

GamesStore.acceptDrawOffer(game) [CYCLIC COORDINATOR]
|-- status.assertOngoingLiveAction(game, 'Draw acceptance'); no offer: RETURN
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
`-- SYNC status.finaliseDrawAgreement(game) [field implementation stays in status]
    |-- premove.clearPremoves; TimeControlService.pauseClock
    |-- WRITE Drawn, DrawAgreement, selected-side analysis state and no offer
    `-- record.timestampGame(game)

GamesStore.offerDraw(game) [ALIAS -> status.offerDraw]
`-- status.offerDraw(game)
    |-- status.assertOngoingLiveAction; position.getLivePosition -> offering side
    `-- WRITE outgoing offer; record.timestampGame(game)

GamesStore.declineDrawOffer(game) [ALIAS -> status.declineDrawOffer]
`-- status.declineDrawOffer(game)
    `-- existing guard; clear offer; record.timestampGame(game)

GamesStore.withdrawDrawOffer(game) [ALIAS -> status.withdrawDrawOffer]
`-- status.withdrawDrawOffer(game)
    `-- existing guard; clear only outgoing offer; record.timestampGame(game)
```


Only resignation and draw acceptance depend upward on player-turn cancellation. Their store coordinators retain the existing guard first, then await the original handler clearing, then call a synchronous status finaliser. Draw acceptance returns before cancellation when there is no offer.

`status.finaliseResignation(game, colour)` retains queue clear, stopped clock, opponent winner/Resignation, matching analysis state, offer clear and metadata timestamp. `status.finaliseDrawAgreement(game)` retains queue clear, stopped clock, Drawn/agreement, current selected-side analysis state, offer clear and timestamp. These field bodies stay in status and trust the accepted call boundary.

Offer, decline and withdrawal stay entirely in status and retain their public aliases. Their original guards, actual-side outgoing offer, outgoing-only withdrawal rule, timestamps and lack of turn cancellation remain unchanged. No generic result-action wrapper or new engine/analysis stop is added.


## SDR-F16 Player reassignment

### Execution call tree

```text
GamesStore.reassignPlayer(game, colour, nextPlayer?) [ALIAS -> playerTurn.reassignPlayer]
`-- playerTurn.reassignPlayer(game, colour, nextPlayer) [entire implementation stays]
    |-- reject BoardEdit; createPlayerSnapshot(nextPlayer)
    |-- persisted values equal prior seat: RETURN
    |-- AWAIT clearPlayerTurnRuntime(game)
    |-- old Engine: AWAIT EngineRuntimeService.stopEngine(oldAssignment)
    |-- position.getRenderedPosition; optional getLivePosition
    |-- premove.clearPremoves; WRITE accepted seat
    |-- missing seat:
    |   |-- TimeControlService.pauseClock; position.setLivePath(undefined)
    |   `-- WRITE analysis result/state/pause ownership exactly as before
    |-- otherwise: preserve paused/live/live-analysis family via status projections
    |-- record.timestampGame(game)
    |-- existing focus-registration refresh at this exact boundary [callee wiring provisional; F20]
    `-- requestPlayerMoveIfNeeded(game)
```


**Entire implementation stays in `playerTurn.reassignPlayer`; keep its existing public alias.** Rewire the focus-refresh callee without deleting that operation; its exact acyclic owner placement remains subject to F20.

Retain the BoardEdit rejection; persisted snapshot comparison/no-op; awaited original turn clear; explicit old-engine stop; selected/actual side capture; queue clear and seat assignment. With a missing seat, retain the existing TimeControlService pause, live-path removal, result/offer/pause reset and selected-side analysis state. Otherwise keep every paused/live/live-analysis family branch.

Timestamp through record, perform the existing registration refresh, then request eligible play through the existing local method. Preserve the refresh even when it only unsubscribes. Do not replace it with a listener retained through an ineligible state. No other reassignment logic moves to GamesStore.


## SDR-F17 Workspace create, insert and read

### Execution call tree

```text
GamesStore.createGame(request) [WRAPPER: focus boundary only]
|-- AWAIT workspace.createGame(request) [construction/admission implementation stays]
|   |-- _createGameMetadata; clock.initialiseClockSnapshot
|   |-- playerTurn.createPlayerSnapshot; MoveHistoryService.createMoveTree
|   |-- clock.startClock for actual play; analysis.createAnalysisSeat
|   |-- WRITE existing payload/paths/options
|   `-- AWAIT workspace._hydrateAndInsertGame(payload) -> canonicalGame
|-- AWAIT workspace.activateGame(canonicalGame) [existing tail stays in workspace]
|   |-- playerTurn.requestPlayerMoveIfNeeded(canonicalGame)
|   `-- seats exist: AWAIT analysis.refreshAnalysisForGame(canonicalGame)
`-- RETURN canonicalGame

GamesStore.insertGame(payload) [WRAPPER: focus boundary only]
|-- AWAIT workspace.insertGame(payload) -> canonicalGame
|   `-- workspace._hydrateAndInsertGame(payload)
|-- AWAIT workspace.activateRestoredGame(canonicalGame) [existing tail stays]
|   |-- playerTurn.requestPlayerMoveIfNeeded(canonicalGame)
|   |-- AWAIT UserSettingService.getSettingsOrDefault()
|   `-- eligible restore + seats + not BoardEdit:
|       `-- AWAIT analysis.refreshAnalysisForGame(canonicalGame)
`-- RETURN canonicalGame

workspace._hydrateAndInsertGame(payload) [retained implementation]
|-- _repairDuplicateGameId(payload, _getExistingGameIds())
|-- position.hydrateGame(payload)
|-- status.isPausedState: WRITE [Manual] restored runtime pause owner
|-- playerTurn.normalisePlayers(hydratedPayload)
|-- _replaceGame(hydratedPayload) -> canonical reactive game
|-- existing synchronous focus-registration refresh(canonicalGame) [callee wiring provisional; F20]
`-- RETURN canonicalGame

GamesStore.getGame(id) [ALIAS -> workspace.getGame]
`-- workspace.getGame(id) -> same readonly canonical view

GamesStore.listGames() [ALIAS -> workspace.listGames]
`-- workspace.listGames() -> same readonly live collection
```


**Keep workspace implementation and its existing seven whole-object dependencies.** Collection ownership, metadata, duplicate-ID policy, canonical proxy admission, hydration, player normalisation and read contracts do not move.

All existing helpers remain: `_createGameMetadata`, `_repairDuplicateGameId`, `_getGameIndex`, `_getExistingGameIds`, `_replaceGame`, `_hydrateAndInsertGame` and `_startLiveGame`. Preserve the registration-refresh operation immediately after canonical admission; only its callee wiring may change.

### Core preparation and activation split in the same composable

`workspace.createGame(request)` retains root/clock/tree/player/seat/options construction and awaited canonical admission. `workspace.insertGame(payload)` retains canonical admission. Extract their old activation tails into two returned methods on this SAME composable:

- `activateGame(game)`: request the existing actual turn; if analysis seats exist, await their existing refresh.
- `activateRestoredGame(game)`: request actual turn; await existing settings; refresh only when restore policy, seats and non-BoardEdit mode permit.

The proposed wrapper/activation split must preserve the source trace, including synchronous refresh inside admission before the core completes. Moving attachment after the wrapper's preparation await is withdrawn. Revise the split if necessary to preserve async boundaries; merely attaching before activation does not establish equivalent flow.

`getGame/listGames` retain their aliases and live readonly views. Duplicate-ID repair remains the existing supplied-payload mutation; no new identity policy, snapshots, holder maps or admission/rollback mechanism.


## SDR-F18 Start from setup

### Execution call tree

```text
GamesStore.startGameFromSetup(game, request) [WRAPPER: focus boundary only]
|-- AWAIT workspace.startGameFromSetup(game, request) [implementation stays]
|   |-- START analysis.disposeAnalysisForGame(game) -> captured cleanup
|   |-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
|   |-- AWAIT captured analysis cleanup
|   |-- premove.clearPremoves(game)
|   |-- playerTurn.createPlayerSnapshot; analysis.createAnalysisSeat
|   |-- WRITE requested name/players/timeControl/options/seats
|   |-- clock.initialiseClockSnapshot(timeControl)
|   |-- both seats: workspace._startLiveGame(game, selectedPosition)
|   |   |-- position.setLivePath(selectedPath/cache)
|   |   |-- clock.startClock(initialSnapshot, selectedSide, now)
|   |   `-- WRITE ongoing result and live state
|   |-- missing seat: remove live path; WRITE selected-side analysis state
|   |-- record.timestampGame(game)
|   `-- existing synchronous focus-registration refresh(game) [callee wiring provisional; F20]
`-- AWAIT workspace.activateGame(game) [existing tail stays; split must preserve async boundaries]
    |-- playerTurn.requestPlayerMoveIfNeeded(game)
    `-- AWAIT analysis.refreshAnalysisForGame(game)
```


**Core stays in workspace.** Preserve the existing focus refresh after timestamping and before activation. Do not add an earlier detach, a later attach or a failure-path registration reconciliation. The proposed wrapper/activation split must preserve all existing async boundaries.

`workspace.startGameFromSetup(game, request)` retains captured analysis disposal; awaited original turn clearing and old seat cleanup; queue clear; name/player/time-control/options/seat assignment; selected position and initial snapshot; existing `_startLiveGame` branch or standalone analysis branch; metadata timestamp.

The proposed `workspace.activateGame` extraction keeps the original next-turn and analysis-start tail in the same module. Retain the existing public completion and failure paths; do not add reconciliation, data rollback or an unrelated provider drain. Revise the split if the preparation/activation separation would introduce an extra async boundary.


## SDR-F19 Board edit actions

### Execution call tree

```text
GamesStore.enterBoardEdit(game) [ALIAS -> boardEdit.enterBoardEdit]
`-- boardEdit.enterBoardEdit(game) [entire implementation stays]
    |-- status.assertNotPausedForAction; live path: RETURN
    |-- already BoardEdit:
    |   `-- WRITE selected analysis state; START analysis.refreshAnalysisForGame; RETURN
    |-- other actual state: RETURN
    |-- START analysis.stopAnalysis(game)
    `-- WRITE BoardEdit; record.timestampGame(game)

GamesStore.applyBoardEdit(game, rootPosition) [ALIAS -> boardEdit.applyBoardEdit]
`-- boardEdit.applyBoardEdit -> _assertBoardEditState
    `-- move.replaceWithAnalysisRoot(game, rootPosition, BoardEdit)

GamesStore.resetBoardToStartPosition(game) [ALIAS -> boardEdit.resetBoardToStartPosition]
`-- boardEdit.resetBoardToStartPosition -> _assertBoardEditState
    `-- createInitialBoardPosition -> move.replaceWithAnalysisRoot(game, root, BoardEdit)

GamesStore.clearBoard(game) [ALIAS -> boardEdit.clearBoard]
`-- boardEdit.clearBoard -> _assertBoardEditState -> _applyEdit(clearBoard)

GamesStore.deleteChessPiece(game, boardId) [ALIAS -> boardEdit.deleteChessPiece]
`-- boardEdit.deleteChessPiece -> _assertBoardEditState -> _applyEdit(deletePiece)

GamesStore.moveChessPiece(game, from, to) [ALIAS -> boardEdit.moveChessPiece]
`-- boardEdit.moveChessPiece -> _assertBoardEditState -> _applyEdit(movePiece)

GamesStore.toggleChessPiece(game, boardId, piece) [ALIAS -> boardEdit.toggleChessPiece]
`-- boardEdit.toggleChessPiece -> _assertBoardEditState -> _applyEdit(togglePiece)

boardEdit._applyEdit(game, localSynchronousEdit) [retained implementation]
|-- select root OR position.getRenderedPosition
|-- SYNC MoveApplicationService.<pieceEdit>(board, arguments)
|-- no change: RETURN, retaining history/lines
|-- first effective edit of history/descendant:
|   `-- move.replaceWithAnalysisRoot(game, editedBoard, BoardEdit)
`-- effective root edit without history:
    |-- WRITE ongoing result/no offer; position.invalidateRenderedPosition
    `-- START analysis.refreshAnalysisForGame(game) [clears/stops in BoardEdit]
```


**All seven implementations and public aliases stay in boardEdit.** The module keeps position/status/analysis/move/record objects. No board-edit action needs a higher player-turn object after the move cycle is cut.

Keep private `_assertBoardEditState` and `_applyEdit`. Entry/exit keeps its genuine-pause/mode guards, line-preserving analysis stop, state/timestamp and restart policy. Apply/reset call the existing lower root replacement. Clear/delete/move/toggle retain their local synchronous edit callback and service call.

The shared edit body returns on a no-op; promotes the first effectively edited descendant/history board to root once; otherwise resets result/offer, invalidates rendered position and starts BoardEdit analysis clearing/stop. No return-wrapper, additional assertion, history reset or timestamp is added just because the store exposes the action.


## SDR-F20 Lifecycle and disposal

### Execution call tree

```text
Existing refreshRuntimeRegistrations(game) [required trace; new callee ownership provisional]
|-- position.requireGameRuntime(game)
|-- invoke existing focusReturnUnsubscribe if present; clear runtime field
|-- not live/live-analysis OR not ongoing OR not timed OR no running clock: RETURN
`-- REGISTER PlatformEventService.subscribeToAppFocusReturned('GamesStore', callback, same label)
    |-- WRITE actual unsubscribe to the same runtime field
    `-- external callback -> syncClock(game, new ClockTimestamp())

GamesStore scope disposal [existing cleanup pattern]
|-- for each workspace.listGames(): premove.clearPremoves(game)
|-- START playerTurn.clearPlayerTurnRuntime(game) + analysis.disposeAnalysisForGame(game)
|-- START existing explicit EngineRuntimeService.stopEngine for player assignments
|-- invoke/clear actual focus unsubscribe at its existing cleanup position
`-- handle existing cleanup promise failures; do not introduce a new turn/disposal API
```


The proposed external focus-owner cut must be reconciled with this unchanged trace and the acyclic whole-object dependency graph before implementation. This section specifies required behaviour, not a completed new callee arrangement. Do not solve the dependency by deleting refresh calls or changing subscription lifetime.

Retain refresh at every original action boundary: move finalisation; takeback before the successor request/analysis await; result finalisation; clock timeout/pause/resume branches; reassignment between timestamp and next-turn request; canonical admission before its return; and setup between timestamp and activation. Preserve branches that currently return without refreshing. In particular, do not retain a listener through pauses/results as a substitute for unsubscribe, or move admission/setup refresh across an await.

Retain the existing scope cleanup: clear queues, begin original turn clear and analysis disposal, start the existing explicit player-engine stops, detach focus and handle cleanup promise failures. Do not add a new registration lifetime, disposal phase or failure-path reconciliation.

Do not add lower `close()` APIs, a replacement disposal completion, provider acknowledgements, new retry state or an unrelated resource/identity cleanup project. Existing accepted autosave writes retain their domain completion and error handling. A tab close still clears the queue and changes UI state; it is not workspace disposal.


## SDR-F21 Completion, error and race contracts

| Boundary | Preserved result / completion | Dependency-refactor limit |
| --- | --- | --- |
| Every changed call | Same meaningful operations, branches, arguments/identities, effects and async boundaries as current source. | Only dependency passing, concrete callee access and necessary coordinator placement change; compare before/after traces. |
| Retained alias | Original method body and public result/promise. | No pass-through store function or unrelated implementation move. |
| Thin wrapper | Core completes below; only actual boundary work is added above; public result stays unchanged. | Internal navigation/resume flags never leak through the store API. |
| Actual input | Resolve the original Deferred and await its original handler. | No new scheduler, head claim, acknowledgement or provider-draining completion. |
| Actual commitment | Expiry before increment/append, actual result/queue/analysis updated, then existing driver requests successor. | Move finalisation loses only its upward callback. |
| History rewrite | Original handler settled; actual selected owner reaccepted; old continuation retained. | Only await/reaccept/restart moves; accepted mutation stays in move. |
| Takeback | Original cancel and explicit stops before retained rewind; request next play before awaiting analysis work. | Rewind is not a new move and does not create an analysis pause. |
| Pause/Resume | Existing reasons, held slot and final delivery once. | Core state mutation stays in clock; only upward branches use store wrapper. |
| Result commands | Existing guards and accepted field policy after handler clearing. | Only resignation/acceptance await coordination moves. Three simple draw APIs stay aliases. |
| Reassignment | Original comparison/cancel/old-engine stop/state-family semantics and refresh boundary. | Keep implementation and alias; change callee wiring only. |
| Workspace | Same canonical proxy, ID policy, synchronous registration boundary and settings/analysis-start completion. | Core and any extracted activation tails remain in workspace; no added async boundary. |
| Analysis/edit | Original subscription ownership, independent starts, Stop/removal/no-op edit semantics. | Keep every implementation/alias; no new scope API. |
| Focus/timeout | Same registration eligibility, refresh/unsubscribe timing and callback delivery; repeated timeout sync joins the existing pending work. | Revise the provisional owner cut to preserve F20 without a reverse composable edge or interface-typed callback. |
| Autosave/retry/disposal | Existing accepted mutation, 500 ms retry and cancellation/cleanup implementation. | Do not bundle unrelated policy or lifecycle hardening into this refactor. |

Retain the meaningful current cases: late delivery after cancellation; timeout before increment; synchronous premove shift then genuine pause; abandoned historical rewrite preserving intentions; repeated wake/readiness; actual turns behind analysis; two-game independence; A-B-A seat replacement; setup/restore; and alias/reference/public completion contracts.

Run the [main acceptance checks](StoreDependencyRestructuringPlan.md#implementation-and-verification) against the changed boundaries. These are planned implementation checks; this document revision is not execution evidence.
