# Store dependency function flows

Revised on 23 October 2026. **Status: implemented dependency refactor.** Keep existing composable implementations unless their upward dependency needs a cut. The [main plan](StoreDependencyRestructuringPlan.md) lists every retained alias, boundary wrapper and moved coordinator.

These trees show actual function-to-function flow. `ALIAS` leaves implementation in the composable. `WRAPPER` moves only stated boundary ordering; its core stays below. `SYNC/AWAIT/START/RESUME/WRITE` distinguish direct work, completion, existing background continuation and mutation. Qualified private names identify their defining module, not an exported object method.

Four cyclic coordinators and three small wrappers need store bodies. The other 26 feature functions retain composable aliases, and the two shared public APIs alias their record/premove owners. Whole-object factory return types preserve the implementation reference; no store callback is injected into a child.

**Call wiring only: the real execution flow must not change.** Apply the [mandatory preservation constraint](StoreDependencyRestructuringPlan.md#call-wiring-only-preserve-the-real-flow) to every tree: preserve branches, arguments/identities, operation count/order, mutations, timestamp capture, awaits, background work, completion/errors, cancellation and subscription lifetimes. Change only dependency passing, concrete method calls and the minimum placement needed to break a cycle. Keep other implementation in its composable; separate any behavioural fixes.

The implemented focus resolution extracts only turn cancellation into `turnRuntime`. Clock keeps sync and registration; workspace keeps its complete methods and aliases. The provisional registration-owner/activation split is withdrawn. These trees remain subject to the unchanged-flow constraint.

## SDR-F01 Bootstrap and public dispatch

### Execution call tree

```text
GamesStore setup
|-- SYNC construct whole objects in the dependency table's order
|-- turnRuntime({ position }); status({ position, record, premove })
|-- clock({ position, status, record, premove, turnRuntime })
|-- move({ position, status, clock, analysis, premove, record })
|-- playerTurn({ position, status, record, premove, move, clock, turnRuntime })
|-- boardEdit({ position, status, analysis, move, record })
|-- workspace({ position, status, clock, analysis, playerTurn, record, premove })
|-- REGISTER existing scope cleanup; focus refresh stays at existing action boundaries
`-- RETURN retained composable aliases + only necessary store coordinators/wrappers

Public name with [ALIAS] -> original composable method body
Public name with [WRAPPER] -> small boundary call -> original core body
Four cyclic coordinators -> GamesStore body -> retained lower operations
```


Construct whole objects in the [dependency table](StoreDependencyRestructuringPlan.md#complete-whole-object-dependency-graph). Keep the existing public alias when its implementation can use those objects without a cycle.

Only four cyclic coordinators and three small boundary wrappers need named store bodies. The 26 retained feature aliases and two shared-owner aliases do not gain pass-through functions. The companion trees mark every retained alias and wrapper explicitly.

GamesStore's own private coordinators call each other lexically; they are not injected into a child. Engine callbacks remain actual external delivery boundaries inside the original player-turn implementation. App-close autosave stays with App/SavedGamesStore.


## SDR-F02 Recording and autosave

### Execution call tree

```text
GamesStore.onAutosaveFailed(listener) [ALIAS -> record.onAutosaveFailed]
`-- SYNC record.onAutosaveFailed(listener)
    |-- WRITE listener Set: add actual external consumer
    `-- RETURN unsubscribe -> record removes this listener

move._applyLiveMove(...) OR move._advanceRenderedAnalysisBranch(...)
`-- SYNC record.moveCommitted(game)
    |-- SYNC UserSettingService.getSettings()
    |-- WRITE existing per-game count
    |-- if threshold not reached: RETURN
    `-- START append to existing serial save queue
        |-- AWAIT useSavedGamesStore().saveGame(game, Autosave options)
        |-- success: WRITE autosaveError = ''
        `-- failure: WRITE error; SYNC registered external listeners

Any accepted existing timestamp call
`-- SYNC record.timestampGame(game)
    `-- WRITE game.metadata.updatedAt = new RecordTimestamp()
```



**Owner/API:** `record` returns `timestampGame`, `moveCommitted`, `autosaveError` and `onAutosaveFailed`. It retains the existing move-count WeakMap, serial promise chain and listener Set. Resolve `useSavedGamesStore()` inside the queued save at its original call point; do not initialise that store earlier during composition.

### timestampGame(game)

Assign `game.metadata.updatedAt = new RecordTimestamp()` and return synchronously. No rendering notification, save, queue manipulation, engine work or next-turn request. Every existing caller moves to `record.timestampGame(game)` without changing when it calls it.

### moveCommitted(game)

1. Read `UserSettingService.getSettings().gameSession.autosaveAfterMoveCount`.
2. Increment that canonical game's existing count. Store zero if the interval is disabled; otherwise preserve the current modulo calculation.
3. If disabled or below the threshold, return synchronously.
4. Append work to the same serial `_autosaveQueue`: await `useSavedGamesStore().saveGame(game, { targetKind: SaveGameTargetKind.Autosave })`, then clear `autosaveError.value`.
5. Catch failure in that queued work, assign the existing user-facing error text and invoke each currently registered failure listener. Keep the chain settled so a later queued write can proceed.
6. Return from `moveCommitted` without awaiting the save. The live canonical game remains the serialization input when the queued operation executes; do not invent a per-move snapshot/copy.

Migrate the existing calls after mainline and analysis-node appends. Rewinding and queue-only operations do not gain a call. Autosave policy changes are outside this relocation.

### onAutosaveFailed(listener)

Add the actual external consumer to the Set and return the existing unsubscribe closure. Unsubscribe removes that listener. Views retain their existing mount/unmount registration; no watcher or new reactive subscription is introduced. In-flight saves retain their existing domain completion/error handling during store teardown; do not abort an accepted file write or move app-close save ownership here.

GamesStore retains the public name as the direct alias `onAutosaveFailed: record.onAutosaveFailed`. The lower object owns listener state; no forwarding function or async boundary is added.

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
move.commitLiveMove OR move.commitHistoryMove
`-- SYNC clock.reconcileTimeout(game, actualCommitTimestamp)
    |-- SYNC clock._getExpiredColour(game, timestamp)
    |   |-- TimeControlService.hasExpired(snapshot, timestamp)
    |   `-- TimeControlService.getRemainingTime(snapshot, timestamp)
    |-- not expired: RETURN false
    `-- expired: clock._finaliseTimeout(game, timestamp, expiredColour)
        |-- premove.clearPremoves; WRITE timeoutNotificationShown = false
        |-- TimeControlService.pauseClock; WRITE result/reason/state
        |-- record.timestampGame(game)
        |-- clock.refreshRuntimeRegistrations(game) [F20]
        `-- RETURN true

move._applyLiveMove(game, detailedMove, timestamp)
`-- SYNC clock.applyMove(game, detailedMove.movingColour, timestamp)
    `-- RETURN TimeControlService.applyMove(snapshot, colour, timestamp, timeControl)
```

Clock keeps calculations, synchronous timeout finalisation, async sync/settlement and registration. Its only turn dependency is the whole lower `turnRuntime` object, which has no dependency on move, status or the higher turn driver.

- `isTimedGame(game)`: retain defined `initialMs` and non-Untimed preset rule.
- `initialiseClockSnapshot(timeControl)`, `startClock(snapshot, colour, timestamp)`, `resumeClock(snapshot, timestamp)` and `applyMove(game, movingColour, timestamp)`: retain the corresponding existing TimeControlService calls and results.
- `_hasRunningClock(snapshot)`: retain private active-colour/start-time/running-side test.
- `_canPauseForReason(game, reason)`: retain private Analysis/already-paused acceptance, otherwise require a timed running clock.
- `_getExpiredColour(game, timestamp)`, also returned as `getExpiredColour`: require ongoing result, an existing eligible live/paused/live-analysis state and actual expiry; derive colour from existing remaining times without mutation.
- `_finaliseTimeout`: retain queue clear, notification reset, stopped snapshot, result/reason/state, timestamp and registration refresh in the original order.

`reconcileTimeout` performs synchronous finalisation and returns true only on expiry. Commitment calls it before any board append or increment. External tick cancellation remains the existing async clock path in F14. No new pause service wrapper, expiry policy or registration lifetime is introduced.


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
playerTurn._playerMoveHandler OR flushDeferredPlayerMove [successful delivery]
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
        |-- START move._refreshRenderedAnalysis(game, isLiveRendered)
        |   |-- changed: analysis.refreshAnalysisForGame(game)
        |   `-- unchanged: record.timestampGame(game); resolved promise
        |-- SYNC clock.refreshRuntimeRegistrations(game)
        `-- RETURN true -> caller synchronously requests next turn

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
    `-- START move._refreshRenderedAnalysis(game)

GamesStore.takeBack(...) [old turn and engines already settled]
`-- SYNC move.rewind(game, targetNode, count, hadLivePath)
    |-- MoveHistoryService.takeBack -> position.getPathToNode
    |-- WRITE rendered/live path and fallback cache/result/state/clock
    |-- START move._refreshRenderedAnalysis(game, changed) -> analysisWork
    |-- SYNC clock.refreshRuntimeRegistrations(game)
    `-- RETURN analysisWork

GamesStore.applyBoardEdit/resetBoardToStartPosition OR boardEdit._applyEdit
`-- SYNC move.replaceWithAnalysisRoot(game, rootPosition, nextState)
    |-- premove.clearPremoves; clock.initialiseClockSnapshot
    |-- MoveHistoryService.createMoveTree; position.replaceMoveTree/set paths
    |-- WRITE root/clock/result/state
    `-- START move._refreshRenderedAnalysis(game)
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

Keep `clock.refreshRuntimeRegistrations(game)` immediately after starting rendered-analysis refresh. Return true at the original successor-call point so the caller performs that same synchronous request. Only the upward player-turn call leaves this function.

### commitLiveMove(game, detailedMove)

1. Require the existing live path; capture one ClockTimestamp.
2. Call `clock.reconcileTimeout`; if true, return without increment, append or save count.
3. Determine whether rendered/live paths are the same reference; obtain actual parent/position.
4. Preserve ordinary live pruning: if future children exist and the actual path is not a strict prefix of the rendered path, prune the actual parent's future moves.
5. Call `_applyLiveMove`, then `_finaliseLiveMove`, synchronously.
6. Return with the existing commitment completion. The caller owns the successor request.

### commitHistoryMove(game, detailedMove, selectedPath, selectedNode, selectedPosition)

The store has only awaited cancellation and reaccepted selected context. Keep the accepted mutation here: obtain one commit timestamp; clear queue; install the selected live path/cache; start that node's clock snapshot and ordinary live state; reconcile expiry; apply and finalise through the existing private helpers.

There is no await, selected-context recheck, ordinary live pruning or successor request in this lower helper. It retains the original non-pruning history rewrite. The next request belongs to the store coordinator.

### Analysis commits and root replacement

- `_advanceRenderedAnalysisBranch(game, parentNode, parentPosition, detailedMove)`: detach the board only if it is the actual cached position; apply the move; add an analysis child; set the derived rendered path/cache; record the existing move-count call; return the rendered board.
- `commitLiveAnalysisMove(game, parentNode, parentPosition, detailedMove)`: use that helper, preserve actual anchor and genuine pause while assigning the rendered side, then start rendered-analysis refresh. Do not update actual result/clocks or cancel the actual provider.
- `commitStandaloneAnalysisMove(game, parentNode, parentPosition, detailedMove)`: use that helper, apply `status.updateGameStateAfterPosition`, then start refresh. Existing finished result/reason remain retained during post-game exploration.
- `replaceWithAnalysisRoot(game, rootPosition, nextState)`: clear queue; initialise the current time control's clock snapshot; assign supplied root; create/replace tree; set rendered path/root cache; remove live path; assign snapshot; reset result/reason/draw; assign requested state; start rendered-analysis refresh. The caller already owns eligibility and any required teardown.

### getTakeBackMoveCount(game) and rewind(game, targetNode, moveCount, hadLivePath)

`getTakeBackMoveCount` retains the existing actual-node/Local-versus-Engine parent walk and public alias; the takeback coordinator also uses it for its default count.

`rewind` is the synchronous mutation portion of the current takeback, invoked after GamesStore cancels/stops old player work. Clear the queue; call `MoveHistoryService.takeBack(targetNode, moveCount)`; derive fallback path/change; assign selected path/cache and the same live path/cache when applicable; reset ongoing result/reason; obtain fallback board; restore/start its node clock and live state, or call `status.updateGameStateAfterPosition` for analysis. Start `_refreshRenderedAnalysis(game, changed)`, refresh clock registration, then return the same analysis promise. GamesStore requests the next actual turn before awaiting that returned work. Engine stops and turn restart remain in the coordinator.

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
        `-- active: SYNC gameMove.commitLiveMove; if it finalised, requestPlayerMoveIfNeeded
            |-- SYNC move.commitLiveMove(game, detailedMove) [F08 -> clock]
            `-- on finalisation result: SYNC requestPlayerMoveIfNeeded(game); existing guards

playerTurn.clearPlayerTurnRuntime(game) [ALIAS -> turnRuntime.clearPlayerTurnRuntime]
|-- SYNC clear existing held move
`-- AWAIT _clearPendingPlayerTurn(runtime)
    |-- abort captured controller; reject captured Deferred
    `-- AWAIT captured existing handler cancellation/finally

playerTurn.flushDeferredPlayerMove(game)
|-- read/remove existing held slot; not ready: RETURN
`-- SYNC gameMove.commitLiveMove; if it finalised, requestPlayerMoveIfNeeded [same F08 path]

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
5. Otherwise call whole `gameMove.commitLiveMove`. Its internal true result means the original finalisation reached its successor-call point; request the successor synchronously only then. Timeout before finalisation returns undefined and makes no successor call, preserving the original branch. After a finalised mate, the existing driver still receives the request and rejects it through its normal state/result checks.
6. Return with the original handler semantics. The moved successor call remains synchronous after commitment; there is no drain loop or different resolver.

Retain the existing 500 ms retry timing, entry point, failure handling and cancellation implementation. Do not add a retry owner, scheduler or unrelated lifecycle redesign as part of this dependency change.

### clearPlayerTurnRuntime(game)

The existing playerTurn clear name directly aliases `turnRuntime.clearPlayerTurnRuntime`; no forwarding function or extra await is added. That lower owner clears the existing held move via `_clearDeferredPlayerMove(runtime)`. Then await existing `_clearPendingPlayerTurn(runtime)`: capture the actual Deferred, handler and controller; if absent return; abort with `Aborted`, reject the captured Deferred and await its handler. No new provider-draining wait, replacement completion promise or queue clearing is added.

This operation alone still does not indiscriminately stop every player engine. Existing callers retain their explicit stop sites, described in F12, F16 and F20.

### flushDeferredPlayerMove(game)

Read the held move; absent returns. Remove the held slot before delivery. If actual play is no longer ready, return without committing. Otherwise call whole `gameMove.commitLiveMove` and request the successor synchronously only on its finalisation result, exactly as successful handler delivery does. Return after this existing synchronous commitment path. Final Resume may then call `requestPlayerMoveIfNeeded` again; the existing pending check keeps this harmless.

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
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game) [ALIAS -> turnRuntime.clearPlayerTurnRuntime]
|-- recheck actual result, selected path/node, mode/pause and takeback permission
|   `-- abandoned: playerTurn.requestPlayerMoveIfNeeded(game); RETURN
|-- SYNC move.commitHistoryMove(game, detailedMove, capturedPath, capturedNode, capturedPosition)
|   |-- premove.clearPremoves; position.setLivePath(selected context)
|   |-- clock.startClock(selectedSnapshot, selectedSide, timestamp); WRITE live state
|   |-- clock.reconcileTimeout(game, timestamp); expired: RETURN
|   |-- move._applyLiveMove -> clock.applyMove -> canonical board/node/record
|   `-- move._finaliseLiveMove -> status result -> queue revalidation -> analysis
`-- if lower finalisation returned true: SYNC playerTurn.requestPlayerMoveIfNeeded(game); RETURN

Only await/reaccept/restart moves to GamesStore; accepted history mutation stays in move.
```


**Moved part only:** `GamesStore._commitHistoryRewriteMove(game, detailedMove)` captures selected node/position/path, awaits the original `playerTurn.clearPlayerTurnRuntime`, and rechecks result, actual selected ownership, mode/pause and takeback permission.

If this selected context was released, request eligible play and return without clearing intentions or mutating history. Otherwise call `move.commitHistoryMove(game, detailedMove, path, node, position)`, then request the actual successor only if lower finalisation reached its original successor-call point; timeout does not add a request.

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
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game) [ALIAS -> turnRuntime.clearPlayerTurnRuntime]
|-- AWAIT all explicit EngineRuntimeService.stopEngine(player.assignedEngine)
|-- SYNC move.rewind(game, capturedTarget, count, hadLivePath) -> analysisWork
|   |-- premove.clearPremoves(game)
|   |-- MoveHistoryService.takeBack -> position.getPathToNode
|   |-- position.setRenderedPath; optional setLivePath using same fallback reference
|   |-- WRITE ongoing result/reason and fallback clock/state
|   |-- clock.startClock(...) when actual play exists
|   |-- START move._refreshRenderedAnalysis(game, changed)
|   `-- clock.refreshRuntimeRegistrations(game); RETURN analysis promise
|-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
`-- AWAIT analysisWork; RETURN (does not await successor move)
```


`getTakeBackMoveCount` stays entirely in move with the existing public alias. It selects actual/rendered node, handles empty history/standalone analysis/other pairings, and walks parents to the prior Local-colour move for a Local-versus-Engine game.

Only `takeBack` cancellation/restart orchestration moves to GamesStore. Retain guards and target capture, await the original turn clear and explicit engine stops, clear queue, then call `move.rewind(game, targetNode, count, hadLivePath)`. Request eligible actual play before awaiting that helper's already-started analysis-work promise.

The original tree/path/clock/result mutation remains in `move.rewind` as detailed in F08. Rewind retains its original registration refresh after starting analysis and before the caller requests the successor. It gains no move-count event, provider acknowledgement or analysis pause.


## SDR-F13 Navigation and analysis mode

### Execution call tree

```text
GamesStore.navigateToNode(game, node) [WRAPPER]
|-- SYNC move.navigateToNode(game, node) -> shouldRequest
|   |-- status.assertExplorationAllowed; position.isNodeInTree
|   |-- position.getPathToNode; choose actual or independent selected path
|   |-- actual target: RETURN move._returnToLiveNode(game)'s readiness decision
|   `-- other target: WRITE selected cache/state; START refreshRenderedAnalysis; RETURN undefined
|-- shouldRequest:
|   `-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
`-- RETURN public void result, not internal flag

GamesStore.enterInGameAnalysis(game) [ALIAS -> move.enterInGameAnalysis]
`-- move.enterInGameAnalysis(game) [full implementation retained]
    |-- existing eligibility checks
    |-- position reads; one detached selected board/path
    |-- WRITE live-analysis state with actual anchor/pause preserved
    `-- START move._refreshRenderedAnalysis(game, false)

GamesStore.exitInGameAnalysis(game) [WRAPPER]
|-- SYNC move.exitInGameAnalysis(game) -> shouldRequest
|   |-- existing eligibility checks; ineligible: RETURN undefined
|   `-- RETURN move._returnToLiveNode(game)'s readiness decision
|-- shouldRequest:
|   `-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
`-- RETURN public void result

move._returnToLiveNode(game) [implementation stays in move]
|-- position.getLiveNode/getLivePosition
|-- position.setRenderedPath(game, ORIGINAL livePath, live cache)
|-- WRITE ended/paused/live state through status helpers
|-- START move._refreshRenderedAnalysis(game, changed)
`-- RETURN the original status.isLiveTurnReadyForMove(game) decision
```


**Keep the implementation in move.** `enterInGameAnalysis` keeps its alias and unchanged body. `navigateToNode`, `exitInGameAnalysis` and private `_returnToLiveNode` retain their guards, canonical references, mode projection and rendered-analysis operations.

The necessary cut is only `_returnToLiveNode -> playerTurn.requestPlayerMoveIfNeeded`. Remove that upward call and let the lower navigate/exit method return the original readiness decision from `_returnToLiveNode`.

The two store wrappers invoke the lower method and request player turn only when its internal result is true. They discard that result and keep the existing public void result. Ordinary navigation and invalid nodes/exit eligibility return undefined. The readiness check stays in the lower return-to-live helper; no repeated context/rule validation is added.

The retained return-to-live helper aliases the ORIGINAL live path and live cache back to the selected board, projects ended/paused/live state and starts rendered refresh. It does not prune immediately, replay engine output, alter genuine pause reasons or restart an existing request.


## SDR-F14 Clock control and focus return

### Execution call tree

```text
GamesStore.syncClock(game, timestamp) [ALIAS -> clock.syncClock]
`-- clock.syncClock(game, timestamp)
    |-- same game has pending settlement: RETURN same promise
    |-- _getExpiredColour; no expiry: RETURN resolved promise
    `-- START/RETURN clock._settleTimeout(game, timestamp, expiredColour)
        |-- capture current clockSnapshot
        |-- AWAIT turnRuntime.clearPlayerTurnRuntime(game)
        |-- same snapshot still current and result ongoing:
        |   `-- clock._finaliseTimeout -> queue/snapshot/result/state/timestamp/focus refresh
        `-- FINALLY remove pending-settlement entry

GamesStore.pauseGame(game, reason) [ALIAS -> clock.pauseGame]
`-- clock.pauseGame(game, reason)
    |-- capture timestamp; _getExpiredColour; expired: RETURN syncClock(game, timestamp)
    |-- require runtime; _canPauseForReason; ineligible: RETURN
    |-- already paused: add reason once; record.timestampGame; RETURN without refresh
    |-- existing actual-state/result guards
    |-- WRITE reasons; TimeControlService.pauseClock; WRITE paused state family
    `-- record.timestampGame; refreshRuntimeRegistrations(game)

GamesStore.resumeGame(game, reason) [WRAPPER]
|-- existing paused/ongoing guard; otherwise RETURN
|-- capture timestamp; clock.getExpiredColour; expired: RETURN clock.syncClock
|-- SYNC clock.resumeClockState(game, reason, timestamp) -> shouldDeliver
|   |-- require runtime; remove only this reason
|   |-- other reasons remain: timestamp; RETURN undefined without refresh
|   |-- TimeControlService.resumeClock; WRITE state; record.timestampGame
|   |-- refreshRuntimeRegistrations(game)
|   `-- RETURN status.isLiveTurnReadyForMove(game)
`-- if shouldDeliver:
    |-- AWAIT playerTurn.flushDeferredPlayerMove(game) [F09/F08]
    `-- SYNC playerTurn.requestPlayerMoveIfNeeded(game)
```

### syncClock and _settleTimeout: retained in clock

Clock retains its pending-timeout WeakMap, same-promise join, original expiry query and original actual-snapshot/result check after awaiting cancellation. Only the cancellation callee changes to whole `turnRuntime`; its abort/reject/await-handler body is unchanged. The pending entry still clears in finally. No higher player-turn/store dependency remains.

### pauseGame: retained implementation and alias

The complete original async pause body remains in clock. Timestamp capture, expiry routing, runtime lookup, reason eligibility, already-paused early return, pause mutation, timestamp and focus refresh retain their original order and await boundaries. There is no store wrapper.

### resumeGame: retained state core and small wrapper

The store wrapper preserves the original paused/ongoing guard, timestamp and expiry route. It calls `clock.resumeClockState` synchronously. That core removes the supplied reason, timestamps/returns when other owners remain, otherwise resumes the snapshot, selects the existing state family, timestamps, refreshes registration and returns the original readiness decision. Only a true result triggers the original awaited held-move flush and synchronous next-turn request. The public result remains void; no await is added before mutation or registration.

### External focus callback

`clock.refreshRuntimeRegistrations` keeps the original real platform callback, calling lexical `clock.syncClock(game, new ClockTimestamp())`. F20 describes unchanged eligibility, refresh and disposal. Clock can now cancel the pending turn without reaching the higher move driver.


## SDR-F15 Result and draw actions

### Execution call tree

```text
GamesStore.resignGame(game, colour) [CYCLIC COORDINATOR]
|-- status.assertOngoingLiveAction(game, 'Resignation')
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game) [ALIAS -> turnRuntime.clearPlayerTurnRuntime]
|-- SYNC status.finaliseResignation(game, colour) [field implementation stays in status]
|   |-- premove.clearPremoves; WRITE opponent winner; TimeControlService.pauseClock
|   |-- WRITE Resignation, analysis state and no offer
|   `-- record.timestampGame(game)
`-- clock.refreshRuntimeRegistrations(game)

GamesStore.acceptDrawOffer(game) [CYCLIC COORDINATOR]
|-- status.assertOngoingLiveAction(game, 'Draw acceptance'); no offer: RETURN
|-- AWAIT playerTurn.clearPlayerTurnRuntime(game) [ALIAS -> turnRuntime.clearPlayerTurnRuntime]
|-- SYNC status.finaliseDrawAgreement(game) [field implementation stays in status]
|   |-- premove.clearPremoves; WRITE Drawn; TimeControlService.pauseClock
|   |-- WRITE DrawAgreement, selected-side analysis state and no offer
|   `-- record.timestampGame(game)
`-- clock.refreshRuntimeRegistrations(game)

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


Only resignation and draw acceptance depend upward on player-turn cancellation. Their store coordinators retain the existing guard first, then await the original handler clearing, then call a synchronous status finaliser and refresh clock registration at the original position. Draw acceptance returns before cancellation when there is no offer.

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
    |-- clock.refreshRuntimeRegistrations(game) [same original boundary; F20]
    `-- requestPlayerMoveIfNeeded(game)
```


**Entire implementation stays in `playerTurn.reassignPlayer`; keep its existing public alias.** Clear through the lower whole turnRuntime object; refresh through the whole clock object. Both calls remain at their original positions in the body.

Retain the BoardEdit rejection; persisted snapshot comparison/no-op; awaited original turn clear; explicit old-engine stop; selected/actual side capture; queue clear and seat assignment. With a missing seat, retain the existing TimeControlService pause, live-path removal, result/offer/pause reset and selected-side analysis state. Otherwise keep every paused/live/live-analysis family branch.

Timestamp through record, perform the existing registration refresh, then request eligible play through the existing local method. Preserve the refresh even when it only unsubscribes. Do not replace it with a listener retained through an ineligible state. No other reassignment logic moves to GamesStore.


## SDR-F17 Workspace create, insert and read

### Execution call tree

```text
GamesStore.createGame(request) [ALIAS -> workspace.createGame]
`-- workspace.createGame(request) [complete implementation retained]
    |-- capture now; rootPosition/default; clock.initialiseClockSnapshot
    |-- playerTurn.createPlayerSnapshot; MoveHistoryService.createMoveTree
    |-- clock.startClock for actual play; analysis.createAnalysisSeat
    |-- WRITE original payload/paths/options
    |-- AWAIT workspace._hydrateAndInsertGame(payload) -> canonicalGame
    |-- playerTurn.requestPlayerMoveIfNeeded(canonicalGame)
    |-- seats exist: AWAIT analysis.refreshAnalysisForGame(canonicalGame)
    `-- RETURN canonicalGame

GamesStore.insertGame(payload) [ALIAS -> workspace.insertGame]
`-- workspace.insertGame(payload) [complete implementation retained]
    |-- AWAIT workspace._hydrateAndInsertGame(payload) -> canonicalGame
    |-- playerTurn.requestPlayerMoveIfNeeded(canonicalGame)
    |-- AWAIT UserSettingService.getSettingsOrDefault()
    |-- eligible restore + seats + not BoardEdit: AWAIT analysis.refreshAnalysisForGame
    `-- RETURN canonicalGame

workspace._hydrateAndInsertGame(payload)
|-- _repairDuplicateGameId(payload, _getExistingGameIds())
|-- position.hydrateGame(payload)
|-- paused state: WRITE original Manual restored pause reason
|-- playerTurn.normalisePlayers(hydratedPayload)
|-- _replaceGame(hydratedPayload) -> canonical reactive game
|-- clock.refreshRuntimeRegistrations(canonicalGame) [same synchronous admission boundary]
`-- RETURN canonicalGame

GamesStore.getGame(id) [ALIAS -> workspace.getGame]
`-- RETURN same readonly canonical view
GamesStore.listGames() [ALIAS -> workspace.listGames]
`-- RETURN same readonly live collection
```

All workspace implementations and aliases stay in place. `_createGameMetadata`, `_repairDuplicateGameId`, `_getGameIndex`, `_getExistingGameIds`, `_replaceGame`, `_hydrateAndInsertGame` and `_startLiveGame` remain in this composable. Replace only timestamp/queue callback access with whole record/premove calls.

No activation methods or store wrappers are added. Canonical admission and its synchronous registration refresh happen before the existing preparation await resumes. Next-turn dispatch, settings read and analysis refresh retain their original await boundaries and conditions. Identity, duplicate-ID mutation and live readonly view contracts are unchanged.


## SDR-F18 Start from setup

### Execution call tree

```text
GamesStore.startGameFromSetup(game, request) [ALIAS -> workspace.startGameFromSetup]
`-- workspace.startGameFromSetup(game, request) [complete implementation retained]
    |-- START analysis.disposeAnalysisForGame(game) -> captured cleanup
    |-- AWAIT playerTurn.clearPlayerTurnRuntime(game)
    |-- AWAIT captured analysis cleanup
    |-- premove.clearPremoves(game)
    |-- WRITE name; playerTurn.createPlayerSnapshot for white/black
    |-- WRITE time control/options; read rendered position; analysis.createAnalysisSeat
    |-- clock.initialiseClockSnapshot(timeControl)
    |-- both seats: workspace._startLiveGame(game, selectedPosition)
    |   |-- position.setLivePath(selectedPath/cache)
    |   |-- clock.startClock(initialSnapshot, selectedSide, now)
    |   `-- WRITE ongoing result/reason and live state
    |-- missing seat: remove live path; WRITE selected-side analysis state
    |-- record.timestampGame(game)
    |-- clock.refreshRuntimeRegistrations(game)
    |-- playerTurn.requestPlayerMoveIfNeeded(game)
    `-- AWAIT analysis.refreshAnalysisForGame(game)
```

The complete body stays in workspace. Only timestamp/queue callee access changes. There is no activation extraction, preparation wrapper, earlier focus detach, later attachment or added failure-path reconciliation. Captured cleanup, original turn cancellation, assignments, clock/state mutation, timestamp, refresh, next-turn request and awaited analysis retain their original order and completion.


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
clock.refreshRuntimeRegistrations(game) [original body retained]
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
|-- game.$?.focusReturnUnsubscribe?.() at its existing cleanup position
`-- handle existing cleanup promise failures; do not introduce a new turn/disposal API
```


Focus registration stays in clock. Its local sync method depends only on lower turnRuntime cancellation, so every caller can retain its original synchronous refresh without a reverse dependency. The registration callback, owner label, runtime field and unsubscribe/replacement order are unchanged.

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
| Workspace | Same canonical proxy, ID policy, synchronous registration boundary and settings/analysis-start completion. | Complete workspace methods remain unsplit; no added async boundary. |
| Analysis/edit | Original subscription ownership, independent starts, Stop/removal/no-op edit semantics. | Keep every implementation/alias; no new scope API. |
| Focus/timeout | Same registration eligibility, refresh/unsubscribe timing and callback delivery; repeated timeout sync joins the existing pending work. | Keep registration in clock and cancellation in lower turnRuntime; no reverse composable edge or interface-typed callback. |
| Autosave/retry/disposal | Existing accepted mutation, 500 ms retry and cancellation/cleanup implementation. | Do not bundle unrelated policy or lifecycle hardening into this refactor. |

Retain the meaningful current cases: late delivery after cancellation; timeout before increment; synchronous premove shift then genuine pause; abandoned historical rewrite preserving intentions; repeated wake/readiness; actual turns behind analysis; two-game independence; A-B-A seat replacement; setup/restore; and alias/reference/public completion contracts.

Run the [main acceptance checks](StoreDependencyRestructuringPlan.md#implementation-and-verification) against the changed boundaries. Execution evidence is recorded in the main plan; the trees describe the implemented ownership and preserved flow.
