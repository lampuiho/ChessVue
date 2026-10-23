# Store dependency restructuring plan

Revised on 23 October 2026 against source revision `e8795fa`. **Status: proposed design; documentation only.** Move only the orchestration that causes circular dependencies or implementation-hiding callback injection. Keep the other implementations and public aliases in their existing composables.

## Scope rule

The presence of a public GamesStore API is not a reason to relocate its implementation. Default to `create/read/edit/analysis` logic remaining with its existing composable. GamesStore coordinates a function only when its necessary call into a higher composable would form a cycle, or when it owns the real external focus boundary.

The [full function flows](StoreDependencyFunctionFlows.md) distinguish a retained alias, a small boundary wrapper, a moved coordinator and the implementation that stays below it. They retain explicit calls, arguments, branches and await points.

Follow [AGENTS.md](../AGENTS.md), [cleanup ownership](ArchivedPlans/CodeCleanupPlan.md), the implemented [premove contract](ArchivedPlans/PreMovePlan%28ToDo%29.md), [raw move boundary](ArchivedPlans/RawMoveSubmissionDesign.md) and [canonical reactive state](ArchivedPlans/WorkspaceRevisionRemovalPlan.md). No alternate resolver, watcher, invalidation counter, action lane, generic event bus or unrelated engine/disposal redesign.

## Call wiring only; preserve the real flow

**This pass changes only the code around function calls needed to repair dependency navigation. The real execution flow must not change.** Pass whole composable objects, replace injected function calls with concrete `owner.method(...)` calls, and relocate only the minimum coordination needed to break a dependency cycle. Keep the existing implementation in its composable otherwise.

- Preserve the same branch conditions, validation, early returns, arguments and object identities; invoke the same underlying operations the same number of times and in the same order.
- Preserve state mutations, timestamp capture points, clock updates, premove handling and the order of all side effects.
- Preserve synchronous work versus background work, every existing await boundary, public results, promise completion/rejection, cancellation, retry and error propagation. A helper split must not add an await or defer work that currently happens synchronously.
- Preserve subscription eligibility, refresh/unsubscribe triggers and resource lifetimes, including focus listeners and engine/analysis ownership. Moving the registration owner does not permit changing when registration happens.
- Do not combine this pass with bug fixes, extra guards, flow simplification, optimisations or lifecycle hardening. Record any such finding separately.

For each changed boundary, compare the current-source and proposed call traces. After accounting for owner names and forwarding helpers, the meaningful operations, branches, effects and async boundaries must match. Internal flags may carry an existing decision across a split; they must not introduce a new decision or public result. Keep existing behavioural test expectations unchanged.

**This constraint takes precedence over every proposed graph, split and flow tree below.** If a proposed cut cannot preserve the existing trace, revise that cut before implementation. In particular, the earlier proposal to retain focus listeners through pauses/results is withdrawn; focus wiring must preserve the existing refresh operation at each original call boundary.

## The dependency cuts and why each is needed

| Troubled edge | Minimal cut | What stays in its composable |
| --- | --- | --- |
| `move.makeMove -> playerTurn`, while player turn commits through move | Put intake routing in GamesStore. | Move resolution, all canonical commits, selected analysis commits and root replacement stay in move. |
| History rewrite/takeback cancel and restart player turn | Move their await/cancel/restart coordination to GamesStore. | Accepted history mutation and rewind/tree/snapshot work stay in move. |
| `move._finaliseLiveMove -> playerTurn.requestPlayerMoveIfNeeded` | The existing player-turn handler/held-output path requests its successor after lower commitment. | Finalise/result/analysis/premove mutation stays in move. Same Deferred/handler/controller mechanism. |
| Return-to-live helper requests player turn | Remove only that upward tail; thin navigation/exit wrappers perform it when the retained lower method reports returning to live. | Navigation, enter/exit analysis, caches, state projection and `_returnToLiveNode` stay in move. `enterInGameAnalysis` keeps its alias. |
| `clock.syncClock -> playerTurn`; player turn reaches clock through move | Move sync/async settlement and its pending map to GamesStore. | Expiry query, clock snapshots and synchronous timeout finalisation stay in clock. |
| Pause expiry branch calls sync; Resume also flushes/restarts player turn | Use thin store wrappers for those upward branches only. | Pause-reason and clock/state mutation remain in clock. |
| `status.resign/acceptDraw -> playerTurn`, while player turn reads status | Store performs guard/await coordination; lower finaliser performs accepted result mutation. | All guards, fields, timestamps, ordinary draw offer/decline/withdraw implementations stay in status. |
| Clock focus callback needs the higher timeout coordinator | Proposed GamesStore registration ownership must preserve every existing refresh call and its exact execution boundary; the wiring still needs reconciliation with F20. | All workspace payload/admission/setup/read logic stays in workspace. Do not defer registration across a preparation await or change listener eligibility/lifetime. |
| Shared store functions are injected as handwritten callback signatures | Give existing timestamp/autosave and queue functions whole `record/premove` owners. | Preserve their existing bodies, counters, raw move references and call policy. Do not move unrelated feature implementations. |

`playerTurn.reassignPlayer` stays in playerTurn; preserve its registration refresh between timestamping and requesting the next turn. Any replacement callee must satisfy the call-wiring-only constraint as well as the acyclic graph. Board edit and all analysis commands likewise stay in their current composables.

## Complete whole-object dependency graph

Each dependency is a complete object typed from its factory's inferred `ReturnType`. The input container may remain an interface. Do not extract functions, introduce handwritten callable API properties, pass a whole store into a child, or conceal cycles using late setters/getters.

| Order | Object / factory | Direct private composable dependencies | Retained responsibility |
| --- | --- | --- | --- |
| 1 | `position` / `useGamePosition` | None | Unchanged position/path/cache/projection implementation. |
| 2 | `record` / `useGameRecord` | None | Owner of existing timestamp/autosave callbacks so callers receive the whole object. |
| 3 | `premove` / `useGamePremove` | `position` | Owner of shared queue callbacks so callers receive the whole object. |
| 4 | `status` / `useGameStatus` | `position, record, premove` | Keep guards, state/result fields and simple draw actions; expose synchronous result finalisers. |
| 5 | `analysis` / `useGameAnalysis` | `position, record` | Keep every analysis implementation; replace timestamp callback with record object. |
| 6 | `clock` / `useGameClock` | `position, status, premove, record` | Keep clock calculations and pause/resume state mutation; remove upward turn callbacks. |
| 7 | `move` / `useGameMove` | `position, status, clock, analysis, premove, record` | Keep commits, analysis/navigation state and rewind mutation; remove upward turn callbacks. |
| 8 | `playerTurn` / `useGamePlayerTurn` | `position, status, move, premove, record` | Keep existing turn mechanism and reassignment; receive complete move object. |
| 9 | `boardEdit` / `useGameBoardEdit` | `position, status, analysis, move, record` | Keep all seven board-edit actions and shared implementation. |
| 10 | `workspace` / `useGameWorkspace` | `position, status, clock, analysis, playerTurn, record, premove` | Keep construction, admission, setup, activation and reads; any activation split must preserve existing async boundaries. |

```mermaid
flowchart TD
  store["GamesStore: cyclic coordination only; keep other aliases"]
  position["useGamePosition"]
  record["useGameRecord"]
  premove["useGamePremove"]
  status["useGameStatus"]
  analysis["useGameAnalysis"]
  clock["useGameClock"]
  move["useGameMove"]
  playerTurn["useGamePlayerTurn"]
  boardEdit["useGameBoardEdit"]
  workspace["useGameWorkspace"]
  store --> position
  store --> record
  store --> premove
  store --> status
  store --> analysis
  store --> clock
  store --> move
  store --> playerTurn
  store --> boardEdit
  store --> workspace
  premove --> position
  status --> position
  status --> record
  status --> premove
  analysis --> position
  analysis --> record
  clock --> position
  clock --> status
  clock --> premove
  clock --> record
  move --> position
  move --> status
  move --> clock
  move --> analysis
  move --> premove
  move --> record
  playerTurn --> position
  playerTurn --> status
  playerTurn --> move
  playerTurn --> premove
  playerTurn --> record
  boardEdit --> position
  boardEdit --> status
  boardEdit --> analysis
  boardEdit --> move
  boardEdit --> record
  workspace --> position
  workspace --> status
  workspace --> clock
  workspace --> analysis
  workspace --> playerTurn
  workspace --> record
  workspace --> premove
```

This graph has **33 private composable edges** and ten root construction dependencies. Keeping an existing valid dependency is intentional; minimising the number of edges is not the objective. The lower chain `playerTurn -> move -> clock -> status` has no reverse call.

```ts
const savedGames = useSavedGamesStore();
const position = useGamePosition();
const record = useGameRecord({ savedGames });
const premove = useGamePremove({ position });
const status = useGameStatus({ position, record, premove });
const analysis = useGameAnalysis({ position, record });
const clock = useGameClock({ position, status, premove, record });
const move = useGameMove({ position, status, clock, analysis, premove, record });
const playerTurn = useGamePlayerTurn({ position, status, move, premove, record });
const boardEdit = useGameBoardEdit({ position, status, analysis, move, record });
const workspace = useGameWorkspace({ position, status, clock, analysis, playerTurn, record, premove });
```

Only `record` and `premove` are new private owners, needed for the shared callback signatures. Do not add a control or move-commit composable. Factory APIs remain inferred; for example `GameMoveComposable = ReturnType<typeof useGameMove>`.

### Outbound dependencies

| Owner | Direct service/store boundaries |
| --- | --- |
| GamesStore | Platform focus registration and existing explicit player-engine stop sites for takeback/scope disposal. |
| record | Whole SavedGamesStore; accepted settings for autosave interval. |
| premove / position | Existing MoveApplicationService and position/history projection boundaries. |
| status | Existing TimeControlService pause on live-rule/result finalisation. |
| analysis | Existing EngineRuntimeService analysis lifecycle. |
| clock | Existing TimeControlService calculations/snapshots. |
| move | Existing MoveApplicationService and MoveHistoryService commit/prune/rewind boundaries. |
| playerTurn | Existing engine readiness/delivery/runtime and old-engine stop on reassignment; existing pause calculation there. |
| boardEdit | Existing MoveApplicationService piece-edit operations. |
| workspace | Existing MoveHistoryService initial tree and UserSettingService restore policy. |

## Public API disposition

All 36 members stay compatible. **21 function implementations keep their composable aliases.** Five cyclic coordinators move to GamesStore; seven APIs gain small wrappers while their core stays below. The two already store-owned APIs remain there. `autosaveError` remains a state ref alias.

| Public member | Disposition | Execution flow |
| --- | --- | --- |
| `autosaveError` | Keep state ref alias to `record.autosaveError`. | [F02](StoreDependencyFunctionFlows.md#sdr-f02-recording-and-autosave) |
| `onAutosaveFailed` | Keep existing GamesStore API; shared callback body owned by whole object. | [F02](StoreDependencyFunctionFlows.md#sdr-f02-recording-and-autosave) |
| `createGame` | Small GamesStore boundary wrapper; core stays in original composable. | [F17](StoreDependencyFunctionFlows.md#sdr-f17-workspace-create-insert-and-read) |
| `startGameFromSetup` | Small GamesStore boundary wrapper; core stays in original composable. | [F18](StoreDependencyFunctionFlows.md#sdr-f18-start-from-setup) |
| `insertGame` | Small GamesStore boundary wrapper; core stays in original composable. | [F17](StoreDependencyFunctionFlows.md#sdr-f17-workspace-create-insert-and-read) |
| `getGame` | Keep alias; implementation stays in `workspace.getGame`. | [F17](StoreDependencyFunctionFlows.md#sdr-f17-workspace-create-insert-and-read) |
| `listGames` | Keep alias; implementation stays in `workspace.listGames`. | [F17](StoreDependencyFunctionFlows.md#sdr-f17-workspace-create-insert-and-read) |
| `makeMove` | Move only cyclic orchestration to GamesStore; lower implementation retained. | [F10](StoreDependencyFunctionFlows.md#sdr-f10-public-move-intake) |
| `clearPremoves` | Keep existing GamesStore API; shared callback body owned by whole object. | [F05](StoreDependencyFunctionFlows.md#sdr-f05-premove-queue-operations) |
| `getTakeBackMoveCount` | Keep alias; implementation stays in `move.getTakeBackMoveCount`. | [F12](StoreDependencyFunctionFlows.md#sdr-f12-takeback) |
| `takeBack` | Move only cyclic orchestration to GamesStore; lower implementation retained. | [F12](StoreDependencyFunctionFlows.md#sdr-f12-takeback) |
| `navigateToNode` | Small GamesStore boundary wrapper; core stays in original composable. | [F13](StoreDependencyFunctionFlows.md#sdr-f13-navigation-and-analysis-mode) |
| `getVisibleAnalysis` | Keep alias; implementation stays in `analysis.getVisibleAnalysis`. | [F07](StoreDependencyFunctionFlows.md#sdr-f07-analysis-seat-lifecycle) |
| `syncClock` | Move only cyclic orchestration to GamesStore; lower implementation retained. | [F14](StoreDependencyFunctionFlows.md#sdr-f14-clock-control-and-focus-return) |
| `pauseGame` | Small GamesStore boundary wrapper; core stays in original composable. | [F14](StoreDependencyFunctionFlows.md#sdr-f14-clock-control-and-focus-return) |
| `resumeGame` | Small GamesStore boundary wrapper; core stays in original composable. | [F14](StoreDependencyFunctionFlows.md#sdr-f14-clock-control-and-focus-return) |
| `reassignPlayer` | Keep alias; implementation stays in `playerTurn.reassignPlayer`. | [F16](StoreDependencyFunctionFlows.md#sdr-f16-player-reassignment) |
| `addAnalysisEngine` | Keep alias; implementation stays in `analysis.addAnalysisEngine`. | [F07](StoreDependencyFunctionFlows.md#sdr-f07-analysis-seat-lifecycle) |
| `removeAnalysisEngine` | Keep alias; implementation stays in `analysis.removeAnalysisEngine`. | [F07](StoreDependencyFunctionFlows.md#sdr-f07-analysis-seat-lifecycle) |
| `refreshAnalysis` | Keep alias; implementation stays in `analysis.refreshAnalysis`. | [F07](StoreDependencyFunctionFlows.md#sdr-f07-analysis-seat-lifecycle) |
| `retryAnalysis` | Keep alias; implementation stays in `analysis.retryAnalysis`. | [F07](StoreDependencyFunctionFlows.md#sdr-f07-analysis-seat-lifecycle) |
| `stopAnalysis` | Keep alias; implementation stays in `analysis.stopAnalysis`. | [F07](StoreDependencyFunctionFlows.md#sdr-f07-analysis-seat-lifecycle) |
| `enterInGameAnalysis` | Keep alias; implementation stays in `move.enterInGameAnalysis`. | [F13](StoreDependencyFunctionFlows.md#sdr-f13-navigation-and-analysis-mode) |
| `exitInGameAnalysis` | Small GamesStore boundary wrapper; core stays in original composable. | [F13](StoreDependencyFunctionFlows.md#sdr-f13-navigation-and-analysis-mode) |
| `enterBoardEdit` | Keep alias; implementation stays in `boardEdit.enterBoardEdit`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `applyBoardEdit` | Keep alias; implementation stays in `boardEdit.applyBoardEdit`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `clearBoard` | Keep alias; implementation stays in `boardEdit.clearBoard`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `deleteChessPiece` | Keep alias; implementation stays in `boardEdit.deleteChessPiece`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `moveChessPiece` | Keep alias; implementation stays in `boardEdit.moveChessPiece`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `resetBoardToStartPosition` | Keep alias; implementation stays in `boardEdit.resetBoardToStartPosition`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `toggleChessPiece` | Keep alias; implementation stays in `boardEdit.toggleChessPiece`. | [F19](StoreDependencyFunctionFlows.md#sdr-f19-board-edit-actions) |
| `resignGame` | Move only cyclic orchestration to GamesStore; lower implementation retained. | [F15](StoreDependencyFunctionFlows.md#sdr-f15-result-and-draw-actions) |
| `offerDraw` | Keep alias; implementation stays in `status.offerDraw`. | [F15](StoreDependencyFunctionFlows.md#sdr-f15-result-and-draw-actions) |
| `acceptDrawOffer` | Move only cyclic orchestration to GamesStore; lower implementation retained. | [F15](StoreDependencyFunctionFlows.md#sdr-f15-result-and-draw-actions) |
| `declineDrawOffer` | Keep alias; implementation stays in `status.declineDrawOffer`. | [F15](StoreDependencyFunctionFlows.md#sdr-f15-result-and-draw-actions) |
| `withdrawDrawOffer` | Keep alias; implementation stays in `status.withdrawDrawOffer`. | [F15](StoreDependencyFunctionFlows.md#sdr-f15-result-and-draw-actions) |

Representative retained return entries are `offerDraw: status.offerDraw`, `reassignPlayer: playerTurn.reassignPlayer`, `enterInGameAnalysis: move.enterInGameAnalysis`, `getTakeBackMoveCount: move.getTakeBackMoveCount`, every analysis/board-edit alias, and workspace `getGame/listGames`. No pass-through GamesStore function is added to those APIs.

## Precise split contracts

- `move.commitHistoryMove(game, detailedMove, selectedPath, selectedNode, selectedPosition)` retains the existing accepted history mutation, including clock setup and non-pruning policy. Store owns only cancellation/revalidation/restart.
- `move.rewind(game, targetNode, count, hadLivePath)` retains tree/path/snapshot mutation and starts/returns its existing analysis-work promise; Store clears/stops first and requests next play before awaiting that promise.
- `move.navigateToNode/exitInGameAnalysis` retain their bodies and report whether they actually returned to live. Their store wrappers use that internal boolean to request eligible play and preserve the existing public void result. `enterInGameAnalysis` stays an alias.
- `clock.pauseGame(game, reason, timestamp)` retains state mutation, trusting the store wrapper's synchronous expiry check. `clock.resumeGame(game, reason, timestamp)` retains reason filtering and state/clock mutation and reports whether actual play can resume; the store wrapper alone flushes/restarts.
- `status.finaliseResignation(game, colour)` and `status.finaliseDrawAgreement(game)` retain the existing accepted field/clock/queue/timestamp changes. Store's public coordinators guard and await the old handler before calling them.
- Workspace `createGame/insertGame/startGameFromSetup` keep metadata, ID policy, hydration, player/seat assignment, clocks, canonical collection and existing setup cleanup. Extract only their activation tails into `workspace.activateGame` and `workspace.activateRestoredGame`, retaining that code in the same module.
- The workspace wrapper/activation split is provisional: registration must remain at the original admission/setup refresh boundary, without an intervening await. Merely attaching before actual-turn/analysis startup is insufficient to prove the same flow.
- Keep `playerTurn.reassignPlayer` in place; replace its timestamp/queue callbacks with whole objects and preserve its registration refresh at the original position. No result/pause/engine-assignment logic migrates.

## Complete source-function disposition

All 144 existing named functions are accounted for below. A split row explicitly names both destinations; it does not mean the whole body moves. Private factories and new thin helpers are not counted as old functions.

| Current source | Existing functions | Retained owner / necessary split |
| --- | --- | --- |
| [GamesStore.ts](../src/state/GamesStore.ts) | `onAutosaveFailed`, `_moveCommitted`, `_timestampGame` | record; existing store API retained where public |
| [GamesStore.ts](../src/state/GamesStore.ts) | `clearPremoves` | premove; existing store API retained |
| [GameAnalysisComposable.ts](../src/state/game/GameAnalysisComposable.ts) | `_createAssignedEngine`, `createAnalysisSeat`, `_stopAssignedEngine`, `_disposeAnalysisSubscription`, `_resolveAnalysisSeat`, `_subscribeToAnalysis`, `_clearAnalysisSeatLines`, `_startAnalysisSeat`, `_getTargetSeats`, `refreshAnalysisForGame`, `getVisibleAnalysis`, `captureMoveAnalysis`, `addAnalysisEngine`, `removeAnalysisEngine`, `disposeAnalysisForGame`, `refreshAnalysis`, `retryAnalysis`, `stopAnalysis` | analysis |
| [GameBoardEditComposable.ts](../src/state/game/GameBoardEditComposable.ts) | `_assertBoardEditState`, `_applyEdit`, `enterBoardEdit`, `applyBoardEdit`, `clearBoard`, `deleteChessPiece`, `moveChessPiece`, `resetBoardToStartPosition`, `toggleChessPiece` | boardEdit |
| [GameClockComposable.ts](../src/state/game/GameClockComposable.ts) | `isTimedGame`, `_hasRunningClock`, `_canPauseForReason`, `initialiseClockSnapshot`, `startClock`, `resumeClock`, `applyMove`, `_getExpiredColour`, `_finaliseTimeout`, `reconcileTimeout` | clock |
| [GameClockComposable.ts](../src/state/game/GameClockComposable.ts) | `refreshRuntimeRegistrations`, `_settleTimeout`, `syncClock` | GamesStore |
| [GameClockComposable.ts](../src/state/game/GameClockComposable.ts) | `pauseGame`, `resumeGame` | clock core + GamesStore boundary wrapper |
| [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts) | `_appendPremove`, `_revalidatePremoves` | premove |
| [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts) | `_refreshRenderedAnalysis`, `_applyLiveMove`, `_finaliseLiveMove`, `commitLiveMove`, `_returnToLiveNode`, `_advanceRenderedAnalysisBranch`, `_commitLiveAnalysisMove`, `_commitStandaloneAnalysisMove`, `replaceWithAnalysisRoot`, `_resolveMove`, `getTakeBackMoveCount`, `enterInGameAnalysis` | move |
| [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts) | `_commitHistoryRewriteMove`, `makeMove` | GamesStore |
| [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts) | `takeBack` | move rewind core + GamesStore cancellation/restart coordinator |
| [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts) | `navigateToNode`, `exitInGameAnalysis` | move core + GamesStore successor-request wrapper |
| [GamePlayerTurnComposable.ts](../src/state/game/GamePlayerTurnComposable.ts) | `createPlayerSnapshot`, `normalisePlayers`, `_initialisePlayerRuntime`, `getSideToMovePlayer`, `isEnginePlayer`, `_clearDeferredPlayerMove`, `_clearPendingPlayerTurn`, `clearPlayerTurnRuntime`, `flushDeferredPlayerMove`, `attemptPlayerMove`, `_tryPremove`, `_requestPlayerMove`, `_requestEngineMove`, `_playerMoveHandler`, `requestPlayerMoveIfNeeded`, `reassignPlayer` | playerTurn |
| [GamePositionComposable.ts](../src/state/game/GamePositionComposable.ts) | `applyPremoveProjection`, `getPremoveProjection`, `createGameRuntime`, `requireGameRuntime`, `getNodeAtPath`, `getRenderedNode`, `getLiveNode`, `_genPositionAtPath`, `_getAliasedLivePosition`, `getRenderedPosition`, `getLivePosition`, `setRenderedPath`, `setLivePath`, `appendRenderedPath`, `appendLivePath`, `_appendChildIndex`, `invalidateRenderedPosition`, `replaceMoveTree`, `pathsEqual`, `isPathPrefix`, `_hydrateMoveNode`, `getPathToNode`, `isNodeInTree`, `hydrateGame` | position |
| [GameStatusComposable.ts](../src/state/game/GameStatusComposable.ts) | `isLiveState`, `isPausedLiveState`, `isLiveAnalysisState`, `isPausedLiveAnalysisState`, `isPausedState`, `isAnyLiveAnalysisState`, `isAnalysisState`, `isLiveTurnReadyForMove`, `getAnalysisState`, `getLiveState`, `getPausedState`, `getLiveAnalysisState`, `getLiveAnchorColour`, `updateGameStateAfterPosition`, `updateGameResultFromLivePosition`, `assertNotPausedForAction`, `canExploreAnalysis`, `assertExplorationAllowed`, `assertOngoingLiveAction`, `assertMoveAllowed`, `isOngoingLiveGame`, `isLiveHistoryReview`, `offerDraw`, `declineDrawOffer`, `withdrawDrawOffer` | status |
| [GameStatusComposable.ts](../src/state/game/GameStatusComposable.ts) | `resignGame`, `acceptDrawOffer` | status field core + GamesStore cancellation coordinator |
| [GameWorkspaceComposable.ts](../src/state/game/GameWorkspaceComposable.ts) | `_createGameMetadata`, `_repairDuplicateGameId`, `_getGameIndex`, `_getExistingGameIds`, `_replaceGame`, `_hydrateAndInsertGame`, `createGame`, `startGameFromSetup`, `_startLiveGame`, `insertGame`, `getGame`, `listGames` | workspace |

## Flow notation and lifecycle boundary

The companion document keeps execution trees for all public entries. `ALIAS` means the public name still points at the original composable method. `WRAPPER` means only the stated coordination crosses the store boundary. `SYNC/AWAIT/START/RESUME/WRITE` distinguish execution, completion, existing handler continuation and state mutation. A private owner-qualified name identifies its module, not an exported object method.

Focus registration must retain the current source flow: each existing refresh first invokes/clears the actual unsubscribe, then subscribes only for an ongoing, timed, running live/live-analysis clock. Preserve every existing refresh call, including reassignment, pause/resume and result actions, and retain scope-disposal detachment at its existing cleanup position. The proposed registration-owner cut needs a concrete acyclic call arrangement that preserves those boundaries before implementation; an inactive permanent listener is not an equivalent substitute. See [F20](StoreDependencyFunctionFlows.md#sdr-f20-lifecycle-and-disposal).

Preserve existing cancellation, engine stops, promises, retry mechanism and cleanup semantics. Withdraw unrelated lower `close()` APIs, retry/disposal redesign and collection/identity policy changes from this plan. Any separate runtime defect needs its own demonstrated fix rather than expanding this dependency refactor.

## Implementation and verification

1. Extract the existing shared callback bodies into whole record/premove objects; retain call sites.
2. Cut the specific move/player-turn, clock/player-turn and status/player-turn edges listed above. Keep unaffected functions/aliases.
3. Add only the thin navigation/clock/workspace wrappers and necessary lower result/outcome helpers.
4. Resolve focus registration ownership while preserving the existing refresh calls, eligibility, unsubscribe/replacement sequence and synchronous boundaries; keep workspace activation implementation below it.
5. Remove unused callback fields, forwarding lambdas and later-assigned dependencies; retain existing eight feature composables.
6. Compare before/after call traces under the call-wiring-only constraint, then validate the graph, all 36 API dispositions, all 144 source-function dispositions and the complete function flows before implementation review. Revise any conflicting proposed split rather than changing runtime flow to fit it.

For code changes run `npm run check:code`, type checking and affected unit/application tests; final integration includes build and affected browser journeys. Preserve current premove/Deferred/held reply/retry, clock, history rewrite/pruning, analysis, reassignment, setup and identity behaviour. Use F12 on returned whole-object methods and confirm the implementation remains reachable. Planning validation checks links, flow coverage and acyclic object wiring; it is not application execution evidence.

Detailed calls, arguments, branches and await semantics remain in [StoreDependencyFunctionFlows.md](StoreDependencyFunctionFlows.md).
