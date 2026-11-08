# GamesStore

## Purpose
Provide the single Pinia façade (`useGamesStore`, store id `gamesStore`) for open active games. The store composes eleven focused game-state composables under `src/state/game/`, each owning a distinct area of `IGame` and its runtime `$` state, and keeps only the cross-area coordination that would otherwise form a dependency cycle between them. Presentation sees one public game boundary; the composables remain implementation details beneath it.

## Public Interface
```ts
// re-exported from '@/contracts' (contracts/state/PauseReason.ts)
const enum PauseReason {
  Manual = 'manual',
  Menu = 'menu',
  Analysis = 'analysis' // retained for compatibility; no current flow pauses with it
}

autosaveError: string // setup-store ref, unwrapped on the store instance
onAutosaveFailed(listener: (message: string) => void): () => void
createGame(request: ICreateGameRequest): Promise<IGame>
startGameFromSetup(game: IGame, request: IStartGameFromSetupRequest): Promise<void>
insertGame(game: IGame): Promise<IGame>
getGame(gameId: string): ReadonlyGame | undefined
listGames(): readonly ReadonlyGame[]
makeMove(game: IGame, rawMove: IMoveRaw): Promise<void>
clearPremoves(game: IGame): void
getTakeBackMoveCount(game: IGame): number
takeBack(game: IGame, moveCount?: number): Promise<void>
navigateToNode(game: IGame, node: IMoveNode): void
getVisibleAnalysis(game: IGame): IVisibleAnalysis | undefined
syncClock(game: IGame, nowUtc: ClockTimestamp): Promise<void>
pauseGame(game: IGame, reason: PauseReason): Promise<void>
resumeGame(game: IGame, reason: PauseReason): Promise<void>
reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void>
addAnalysisEngine(game: IGame, engineProfile: IEngineRecord): Promise<void>
removeAnalysisEngine(game: IGame, engineIndex: number): Promise<void>
refreshAnalysis(game: IGame): Promise<void>
retryAnalysis(game: IGame, engineIndex: number): Promise<void>
stopAnalysis(game: IGame, engineIndex?: number): Promise<void>
enterInGameAnalysis(game: IGame): Promise<void>
exitInGameAnalysis(game: IGame): void
enterBoardEdit(game: IGame): void
applyBoardEdit(game: IGame, rootPosition: IBoardPosition): void
clearBoard(game: IGame): void
deleteChessPiece(game: IGame, boardId: BoardId): void
moveChessPiece(game: IGame, from: BoardId, to: BoardId): void
resetBoardToStartPosition(game: IGame): void
toggleChessPiece(game: IGame, boardId: BoardId, piece: IChessPiece): void
resignGame(game: IGame, colour: PlayerColour): Promise<void>
offerDraw(game: IGame): Promise<void>
acceptDrawOffer(game: IGame): Promise<void>
declineDrawOffer(game: IGame): Promise<void>
withdrawDrawOffer(game: IGame): Promise<void>
```

The 36 members appear in the order the store returns them. Twenty-nine are direct aliases of a composable method or state ref; `makeMove`, `takeBack`, `navigateToNode`, `exitInGameAnalysis`, `resumeGame`, `resignGame` and `acceptDrawOffer` are façade functions described under [Façade coordination](#façade-coordination).

`makeMove` accepts coordinate/promotion intentions. Eligible off-turn Local input against a non-Local opponent appends the supplied `IMoveRaw` reference to the premove queue before canonical enrichment; the input producer owns possible targets and promotion. Other routes select the canonical rendered position, check integer board IDs and the exact legal target/promotion, then enrich a fresh legal candidate through `toDetailedMove` immediately before analysis, history-rewrite or actual-turn delivery. Supplied colour, kind, capture, check and runtime caches are ignored. Invalid history input is rejected before it can cancel the current actual turn. If selection, analysis, pause or takeback policy changes while a valid rewrite drains the old turn, that rewrite is released and the existing turn is rearmed. Detailed engine output and stored history remain full moves; board application/replay requires an existing `IMoveCandidate`. See the [raw API design and retention audit](../../../ArchivedPlans/RawMoveSubmissionDesign.md).

`clearPremoves` removes the runtime premove queue if present; it is the only public queue action and serves board cancellation and tab close. `getTakeBackMoveCount` supplies both the default `takeBack` count and presentation's enabled state. `autosaveError` keeps the last move-count autosave failure text (cleared by the next successful autosave); presentation currently consumes failures only through `onAutosaveFailed`, whose returned function removes the listener.

`getGame` and `listGames` return the canonical reactive objects typed as `ReadonlyGame`. Presentation casts that same object to `IGame` when passing it back to an action; no copy exists to cast. `GameView` additionally reads runtime fields (`premoveQueue`, `pendingPlayerTurnPromise`, `deferredPlayerMove`) for drawing and consumes `resultNotificationPending` directly (see [Clock, pause and results](#clock-pause-and-results)).

## Internal Composition

### Construction and dependency graph
```ts
const position = useGamePosition();
const record = useGameRecord();
const premove = useGamePremove({ position });
const turnRuntime = useGameTurnRuntime({ position });
const status = useGameStatus({ position, record, premove });
const analysis = useGameAnalysis({ position, record });
const clock = useGameClock({ position, status, record, premove, turnRuntime });
const move = useGameMove({ position, status, clock, analysis, record, premove });
const playerTurn = useGamePlayerTurn({ position, status, record, premove, move, clock, turnRuntime });
const boardEdit = useGameBoardEdit({ position, status, analysis, move, record });
const workspace = useGameWorkspace({ position, status, clock, analysis, playerTurn, record, premove });
```

| Order | Composable (`src/state/game/`) | Direct composable dependencies | Owned area |
| --- | --- | --- | --- |
| 1 | `GamePositionComposable` | none | move-tree hydration, rendered/live selectors and caches, path queries, premove projection |
| 2 | `GameRecordComposable` | none | `metadata.updatedAt` timestamping, move-count autosave queue and failure feedback |
| 3 | `GamePremoveComposable` | `position` | runtime premove FIFO append, clear and whole-queue revalidation |
| 4 | `GameTurnRuntimeComposable` | `position` | cancellation of the current turn and held output |
| 5 | `GameStatusComposable` | `position`, `record`, `premove` | game/result/reason/draw-offer state, guards and result finalisers |
| 6 | `GameAnalysisComposable` | `position`, `record` | analysis seats, subscriptions, refresh/retry/stop, move-analysis capture |
| 7 | `GameClockComposable` | `position`, `status`, `record`, `premove`, `turnRuntime` | clock snapshots, timeout settlement, pause ownership, focus-return registration |
| 8 | `GameMoveComposable` | `position`, `status`, `clock`, `analysis`, `record`, `premove` | live/history/analysis commits, takeback rewind, navigation, analysis entry/exit, root replacement |
| 9 | `GamePlayerTurnComposable` | `position`, `status`, `record`, `premove`, `move`, `clock`, `turnRuntime` | seated players, current-turn Deferred/handler, engine requests, premove execution, reassignment |
| 10 | `GameBoardEditComposable` | `position`, `status`, `analysis`, `move`, `record` | board-edit mode and direct piece manipulation |
| 11 | `GameWorkspaceComposable` | `position`, `status`, `clock`, `analysis`, `playerTurn`, `record`, `premove` | open-game collection, creation, setup start, insertion and hydration |

Each dependency is a whole composable object typed from its factory's inferred `ReturnType` (for example `GameMoveComposable = ReturnType<typeof useGameMove>`); callers invoke concrete `owner.method(...)` calls. The graph has 37 acyclic edges and the lower chain `playerTurn -> move -> clock -> status` has no reverse call. Lower composables never import `GamesStore`, and no child receives the whole store. **Why:** the earlier composition injected handwritten callback signatures and late-bound functions, which hid which implementation ran, broke code navigation, and concealed real cycles (`move.makeMove -> playerTurn` while `playerTurn` commits through `move`; `clock.syncClock -> playerTurn` while `playerTurn` reaches `clock`; result actions in `status` needing `playerTurn`). Late setters/getters, a generic event bus or an action lane were rejected because they conceal the same cycles. The invariant is an acyclic whole-object graph in which a composable never calls upward; minimising edge count is not a goal. If a new action needs a higher composable from below, move only that coordination into the façade. The [restructuring plan](../../../ArchivedPlans/StoreDependencyRestructuringPlan.md#the-dependency-cuts-and-why-each-is-needed) and [function flows](../../../ArchivedPlans/StoreDependencyFunctionFlows.md) record every cut and call trace.

The composables are internal; presentation and other stores depend only on `useGamesStore`. **Why:** game actions span position, history, clock, result, analysis and turn state; making each area a public sibling store would require same-layer store calls, expose partial workflows and obscure which boundary owns an atomic action. File boundaries may change, but `GamesStore` remains the one public mutation authority. The single presentation import beneath the façade is `GameView` instantiating its own `useGamePosition()` for the pure `getPremoveProjection` query, as approved in [PRE-F03](../../../ArchivedPlans/PreMovePlan%28ToDo%29.md#pre-f03---derive-displaced-pieces-and-red-squares); `GamePositionComposable` holds no state, so that instance shares nothing with the store's.

### Façade coordination
| Public member | Façade work | Lower implementation retained |
| --- | --- | --- |
| `makeMove` | Routes raw input to premove append or one context-specific commit; private `_commitHistoryRewriteMove` drains the old turn, re-checks the captured selection and rearms the turn | `status.assertMoveAllowed`, `premove.appendPremove`, `move.resolveMove`, `move.commitStandaloneAnalysisMove`, `move.commitLiveAnalysisMove`, `move.commitHistoryMove`, `playerTurn.attemptPlayerMove` |
| `takeBack` | Guards, drains the turn, stops seated player engines, requests the successor turn, then awaits the analysis work the rewind started | `move.getTakeBackMoveCount` (default count), `move.rewind` |
| `navigateToNode`, `exitInGameAnalysis` | Request the next turn only when the lower method reports it returned to a ready live node | `move.navigateToNode`, `move.exitInGameAnalysis` |
| `resumeGame` | Guards paused-and-ongoing, routes expiry to `syncClock`, then flushes held output and requests the turn when the last pause owner was removed and the turn is ready | `clock.getExpiredColour`, `clock.syncClock`, `clock.resumeClockState`, `playerTurn.flushDeferredPlayerMove`, `playerTurn.requestPlayerMoveIfNeeded` |
| `resignGame`, `acceptDrawOffer` | Guard, drain the turn, apply the result, refresh clock registration | `status.finaliseResignation` / `status.finaliseDrawAgreement`, `clock.refreshRuntimeRegistrations` |
| scope disposal (`onScopeDispose`) | For every open game: clear premoves, drain the turn, dispose analysis, stop seated player engines, detach focus return; failures are logged with `logHandledError` | `premove.clearPremoves`, `playerTurn.clearPlayerTurnRuntime`, `analysis.disposeAnalysisForGame`, `EngineRuntimeService.stopEngine` |

**Why:** each public wrapper needs `playerTurn` (to drain, flush or request a turn) around work owned by a composable that `playerTurn` already depends on. The lower method therefore reports an outcome (a boolean or returned promise) instead of calling upward. Scope disposal sits in the façade because it is the store scope's lifecycle boundary and spans every game-owning composable. The restructuring was call-wiring only: branch order, await boundaries and side-effect order were preserved, so these wrappers add no new decisions.

### Runtime field ownership
The persisted game shape stays independent of composable boundaries, and runtime fields keep their flat `IGame.$` (`IGameRuntime`) representation. Each field has one owning composable; any other write is a named boundary action listed here.

| Field | Owner | Other named writers |
| --- | --- | --- |
| `IGame.$` itself, `renderedNode`, `renderedPosition`, `liveNode`, `livePosition`; `IMoveNode.$.parent` on hydration | `position` | none (new nodes receive `$.parent` from `MoveHistoryService`) |
| `premoveQueue` | `premove` | `playerTurn._tryPremove` shifts the due head and removes an emptied queue |
| `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController`, `deferredPlayerMove` | `playerTurn` | `turnRuntime.clearPlayerTurnRuntime` aborts, rejects, drains and clears held output |
| `pauseReasons`, `focusReturnUnsubscribe` | `clock` | `workspace` reconstructs `[PauseReason.Manual]` on hydration; `playerTurn.reassignPlayer` clears reasons on conversion to free analysis; façade disposal calls the unsubscribe |
| `resultNotificationPending` | `status` (`flagResultNotification`) | `GameView` consumes and clears it |
| `IPlayer.$`, player `IAssignedEngine.$` | `playerTurn` | none |
| analysis-seat `IAssignedEngine.$` | `analysis` | none |

**Why:** changing the shared contract merely to mirror implementation files would create persistence and consumer churn, while leaving ownership implicit would permit two composables to mutate the same field independently. A replacement must keep every writer named.

### GamePositionComposable
- **Factory:** `useGamePosition()`; no dependencies and no state of its own.
- **Owns:** hydration (`hydrateGame`, private `_hydrateMoveNode`), runtime access (`createGameRuntime`, `requireGameRuntime`), lazy selector caches (`getNodeAtPath`, `getRenderedNode`, `getLiveNode`, `getRenderedPosition`, `getLivePosition`), selector bookkeeping (`setRenderedPath`, `setLivePath`, `appendRenderedPath`, `appendLivePath`, `invalidateRenderedPosition`, `replaceMoveTree`), path queries (`pathsEqual`, `isPathPrefix`, `getPathToNode`, `isNodeInTree`) and premove projection (`applyPremoveProjection`, `getPremoveProjection`).
- **Public members:** none.
- **Collaborators:** `MoveApplicationService.genPosition`/`applyMove`, `MoveHistoryService.getMoveSequence`, chess coordinate helpers.

### GameRecordComposable
- **Factory:** `useGameRecord()`; no composable dependencies.
- **State:** `autosaveError` ref, a listener `Set`, a per-game move-count `WeakMap` and the serial `_autosaveQueue` promise chain.
- **Functions:** `timestampGame` (sets only `metadata.updatedAt`), `moveCommitted` (counts each mainline or analysis-node append and queues an autosave at the configured interval), `onAutosaveFailed`.
- **Public members:** `autosaveError`, `onAutosaveFailed`.
- **Collaborators:** `UserSettingService.getSettings()` for `gameSession.autosaveAfterMoveCount`; `useSavedGamesStore().saveGame`, resolved lazily inside the queued save (see [Dependencies](#dependencies)).

### GamePremoveComposable
- **Factory:** `useGamePremove({ position })`.
- **Functions:** `appendPremove(game, player, rawMove)`, `clearPremoves(game)`, `revalidatePremoves(game)`.
- **Public members:** `clearPremoves`.
- **Collaborators:** `position.requireGameRuntime`/`getLivePosition`/`applyPremoveProjection`, `MoveApplicationService.genPosition`, `genCandidateMovesForPiece`.

### GameTurnRuntimeComposable
- **Factory:** `useGameTurnRuntime({ position })`.
- **Functions:** `clearPlayerTurnRuntime(game)` clears `deferredPlayerMove`, aborts the current controller with `Aborted`, rejects the pending `Deferred` with that reason and awaits the existing handler.
- **Public members:** none; `playerTurn` re-exports the same method as `clearPlayerTurnRuntime`.
- **Why it exists:** timeout settlement in `clock` must drain the current turn, but `playerTurn` depends on `clock` through `move`. A cancellation-only owner below `clock` removes that cycle without moving focus registration or adding an await.

### GameStatusComposable
- **Factory:** `useGameStatus({ position, record, premove })`.
- **Owns:** `gameState`, `resultState`, `resultReason` and `drawOfferState` transitions, and arming `resultNotificationPending`.
- **Functions:** predicates (`isLiveState`, `isPausedLiveState`, `isPausedState`, `isLiveAnalysisState`, `isPausedLiveAnalysisState`, `isAnyLiveAnalysisState`, `isAnalysisState`, `isLiveTurnReadyForMove`, `isOngoingLiveGame`, `isLiveHistoryReview`, `canExploreAnalysis`); state selectors (`getAnalysisState`, `getLiveState`, `getPausedState`, `getLiveAnalysisState`, `getLiveAnchorColour`, `updateGameStateAfterPosition`); guards (`assertNotPausedForAction`, `assertExplorationAllowed`, `assertOngoingLiveAction`, `assertMoveAllowed`); results (`updateGameResultFromLivePosition`, `flagResultNotification`, `finaliseResignation`, `finaliseDrawAgreement`); draw actions (`offerDraw`, `declineDrawOffer`, `withdrawDrawOffer`).
- **Public members:** `offerDraw`, `declineDrawOffer`, `withdrawDrawOffer`.
- **Collaborators:** `TimeControlService.pauseClock`, `resolveGameResult`, `record.timestampGame`, `premove.clearPremoves`.

### GameAnalysisComposable
- **Factory:** `useGameAnalysis({ position, record })`.
- **State:** `analysisDisposers`, a `WeakMap<IAssignedEngine, () => void>` holding the active subscription disposer per seat engine.
- **Owns:** `game.analysis.seats` and each seat's assigned-engine runtime `$`.
- **Functions:** `createAnalysisSeat`, `refreshAnalysisForGame(game, engineIndex?)`, `getVisibleAnalysis`, `captureMoveAnalysis`, `addAnalysisEngine`, `removeAnalysisEngine`, `disposeAnalysisForGame`, `refreshAnalysis`, `retryAnalysis`, `stopAnalysis`; private `_createAssignedEngine`, `_startAnalysisSeat`, `_subscribeToAnalysis`, `_disposeAnalysisSubscription`, `_clearAnalysisSeatLines`, `_stopAssignedEngine`.
- **Public members:** `getVisibleAnalysis`, `addAnalysisEngine`, `removeAnalysisEngine`, `refreshAnalysis`, `retryAnalysis`, `stopAnalysis`.
- **Collaborators:** `EngineRuntimeService.ensureRuntime`/`subscribeToAnalysis`/`startAnalysis`/`stopAnalysis`/`stopEngine`, `analysisSeatSchema`, `AnalysisTimestamp`.

### GameClockComposable
- **Factory:** `useGameClock({ position, status, record, premove, turnRuntime })`.
- **State:** `pendingTimeouts`, a `WeakMap<IGame, Promise<void>>` holding the one in-flight timeout settlement per game.
- **Owns:** `clockSnapshot` transitions, `pauseReasons`, `focusReturnUnsubscribe` and timeout finalisation.
- **Functions:** `isTimedGame`, `initialiseClockSnapshot`, `startClock`, `resumeClock`, `applyMove`, `refreshRuntimeRegistrations`, `reconcileTimeout`, `syncClock`, `pauseGame`, `resumeClockState`, `getExpiredColour`.
- **Public members:** `syncClock`, `pauseGame`.
- **Collaborators:** `TimeControlService`, `PlatformEventService.subscribeToAppFocusReturned`, `turnRuntime.clearPlayerTurnRuntime`.

### GameMoveComposable
- **Factory:** `useGameMove({ position, status, clock, analysis, record, premove })`.
- **Functions:** `resolveMove`, `commitLiveMove`, `commitHistoryMove`, `commitLiveAnalysisMove`, `commitStandaloneAnalysisMove`, `replaceWithAnalysisRoot`, `getTakeBackMoveCount`, `rewind`, `navigateToNode`, `enterInGameAnalysis`, `exitInGameAnalysis`; private `_applyLiveMove`, `_finaliseLiveMove`, `_advanceRenderedAnalysisBranch`, `_returnToLiveNode`, `_refreshRenderedAnalysis`.
- **Public members:** `getTakeBackMoveCount`, `enterInGameAnalysis`; the rest are reached through façade functions.
- **Rule:** never requests a player turn. Commit, navigation and exit methods return whether the caller should request one.
- **Collaborators:** `MoveApplicationService.applyMove`/`genPosition`, `MoveHistoryService.addMainlineMove`/`addAnalysisMove`/`pruneFutureMoves`/`takeBack`/`createMoveTree`, `genLegalMovesForPiece`, `toDetailedMove`.

### GamePlayerTurnComposable
- **Factory:** `useGamePlayerTurn({ position, status, record, premove, move, clock, turnRuntime })`.
- **Owns:** seated players and their runtime, the current-turn fields and held output.
- **Functions:** `createPlayerSnapshot`, `normalisePlayers`, `getSideToMovePlayer`, `isEnginePlayer`, `clearPlayerTurnRuntime` (alias of `turnRuntime`), `flushDeferredPlayerMove`, `attemptPlayerMove`, `requestPlayerMoveIfNeeded`, `reassignPlayer`; private `_initialisePlayerRuntime`, `_requestPlayerMove`, `_requestEngineMove`, `_playerMoveHandler`, `_tryPremove`.
- **Public members:** `reassignPlayer`.
- **Collaborators:** `EngineRuntimeService.ensureRuntime`/`ensureReady`/`startPlayerTurn`/`stopEngine`, `TimeControlService.pauseClock`, `Deferred`, `playerSchema`, `genLegalMovesForPiece`, `toDetailedMove`.

### GameBoardEditComposable
- **Factory:** `useGameBoardEdit({ position, status, analysis, move, record })`.
- **Functions:** `enterBoardEdit`, `applyBoardEdit`, `clearBoard`, `deleteChessPiece`, `moveChessPiece`, `resetBoardToStartPosition`, `toggleChessPiece`; private `_assertBoardEditState`, `_applyEdit`.
- **Public members:** all seven.
- **Collaborators:** `MoveApplicationService.clearBoard`/`deletePiece`/`movePiece`/`togglePiece`, `createInitialBoardPosition`, `move.replaceWithAnalysisRoot`.

### GameWorkspaceComposable
- **Factory:** `useGameWorkspace({ position, status, clock, analysis, playerTurn, record, premove })`.
- **State:** `games`, the `ref<IGame[]>` open-game collection that owns canonical reactive game references.
- **Functions:** `createGame`, `startGameFromSetup`, `insertGame`, `getGame`, `listGames`; private `_createGameMetadata`, `_repairDuplicateGameId`, `_getGameIndex`, `_getExistingGameIds`, `_replaceGame`, `_hydrateAndInsertGame`, `_assignPlayer`, `_createPlayers`, `_startLiveGame`.
- **Public members:** all five.
- **Collaborators:** `MoveHistoryService.createMoveTree`, `UserSettingService.getSettingsOrDefault` (restore analysis policy), `createInitialBoardPosition`, `crypto.randomUUID`.

## Responsibilities
- create live games or non-live analysis games from creation input, resolving optional colour randomisation once
- accept ownership of caller-supplied saved-game payloads and hydrate those same objects into canonical reactive workspaces
- transition a prepared non-live analysis game into a live game without losing its prepared root or move tree
- copy per-game `gameplayOptions` (`allowTakeback`, `showLiveAnalysisMoves`) from the creation or setup request
- retain time-control values supplied at creation or setup by reference, create persisted player snapshots through `playerSchema`, and copy selected reusable engine profiles into analysis seats
- enforce allowed actions from `GameState`, `ResultState`, pause ownership and the per-game takeback policy
- route raw move input to premove, live, history-rewrite, live-analysis or standalone-analysis commits, and coordinate legality, move-tree, clock, result and recorded-analysis changes
- keep actual live play (clock, engine turns, premoves) progressing while the user reviews history or explores in-game analysis
- queue a human's premoves against a non-local opponent and execute each through the ordinary local turn
- reconcile live clocks on timer ticks or focus return so timeout finalisation stays inside the store boundary
- register and tear down focus-return callbacks through the layer-2 platform-event boundary
- coordinate layered Manual and Menu pauses, holding guarded engine output until the final resume
- change one side's player assignment, including conversion from live play into free analysis
- record resignation and draw offers, and expose explicit accept, decline and withdraw boundaries
- arm a one-shot result notification for the game view whenever a live game ends
- add or remove per-game analysis seats and coordinate refresh, retry, stop and readonly seat reads on `IGame.analysis`
- run board-edit sessions for non-live workspaces
- count committed moves and queue move-count autosaves
- own `livePath` and `renderedPath` selection on the game, while `MoveHistoryService` stays limited to tree mutation
- expose live game objects through deep-readonly observation types; state changes go through explicit store actions rather than defensive read clones

## State And Settings Notes

### Move intake and commits
- `makeMove` is the explicit dispatcher for input submitted against the currently rendered board. `status.assertMoveAllowed` first throws for `Paused*Turn`, `BoardEdit` and other blocked states, while any explicit live-analysis state (including paused) is allowed. On an ongoing live game following the live selector (`renderedPath === livePath`, not in explicit analysis), input for a non-Local side to move is appended to the premove queue when exactly one seat is Local, and rejected otherwise. Everything else is resolved by `move.resolveMove` and then dispatched: no live path to `commitStandaloneAnalysisMove`; explicit analysis to `commitLiveAnalysisMove`; history review of the live line (`isLiveHistoryReview`: rendered path a strict prefix of `livePath`) with `allowTakeback` to `_commitHistoryRewriteMove`; any other independent selection throws `Enter analysis to explore this historical position.`; the following-live board to `playerTurn.attemptPlayerMove`. **Why:** a public method that always meant "commit live" could mutate a different position from the one the user sees, while a generic finaliser flag hid context-specific clock, result, selector and refresh policies. The explicit-analysis branch precedes the rewrite branch so that an exploratory move from a historical anchor can never rewrite actual play merely because the anchor is a prefix of `livePath` ([background analysis flow 2](../../../ArchivedPlans/BackgroundAnalysisPlan.md#2-enter-a-board-move-or-select-a-pv)).
- `MoveApplicationService.applyMove` only mutates one supplied board position. `_applyLiveMove` shares clock application, recorded-analysis capture, board mutation, mainline-node insertion, live-path append, clock-snapshot assignment and `record.moveCommitted`. `commitLiveMove` and `commitHistoryMove` keep separate parent-selection, pruning and selector policies, then share `_finaliseLiveMove` for result, state, premove revalidation, analysis refresh and focus registration. Both reconcile timeout before mutating and return `true` only after a commit, so the turn handler or façade requests the successor.
- Analysis moves do not pass through a generic finalisation function or a live-versus-analysis flag. `_advanceRenderedAnalysisBranch` owns only rendered-position detachment (when the rendered position is the live position object), in-place application, analysis-node insertion, rendered-path selection and `record.moveCommitted`. `commitLiveAnalysisMove` and `commitStandaloneAnalysisMove` then apply their own state and refresh policy. **Why:** the former flag-driven `_finaliseMove` hid those differences and could finalise the wrong position reference; consolidation is safe only if each context's policies remain explicit.
- A history rewrite is coordinated by the façade's private `_commitHistoryRewriteMove`: it captures the rendered node, position and path, awaits `clearPlayerTurnRuntime`, and releases the rewrite (rearming the existing turn) if the game ended, the selection changed, explicit analysis or a pause began, or takeback was disabled meanwhile. Otherwise `move.commitHistoryMove` clears premoves, makes the captured rendered path, node and position the live selector by reference, restarts the selected node's clock snapshot from the current timestamp, sets the live state and applies the move. It neither calls `commitLiveMove` nor prunes; the old live continuation remains a sibling variation and the new child becomes the mainline. **Why:** reversing selector ownership would mutate the old live position and attach the replacement below the wrong parent, and reusing the historical running timestamp would charge all elapsed review time. Draining before mutation guarantees a late provider cannot commit into the replaced continuation.
- `commitLiveMove` prunes the live parent's existing children before appending, unless the rendered path is a strict descendant of the live path (the branch the user is viewing). Once actual play passes an anchor, its branch is kept as history through Exit, navigation and save/restore. **Why:** pruning is limited to the user's own current-move case ([BA-Q1](../../../ArchivedPlans/BackgroundAnalysisPlan.md#audit-decisions-and-remaining-clarification)); deleting a branch that background play has made historical would discard work the user is still reading.
- App-owned interactions submit moves selected from generated legal targets; the store still resolves legality once at intake. Player-engine output is validated by `EngineRuntimeService` (including any ponder reply) before it reaches the engine-agnostic handler. A premove is context-stale, so it is checked when it becomes due (`_tryPremove`) and after each actual commit (`revalidatePremoves`). **Why:** duplicating checks in the client, turn handler and commit path lets asynchronous layers validate against different positions; the invariant is validation where untrusted or context-stale input becomes accepted.
- `record.moveCommitted` runs after every mainline append and every analysis-node append; rewinds, root replacement and queue edits do not count. `timestampGame` records metadata only and is not a rendering signal.

### Selection, history review and in-game analysis
- `renderedNode`, `liveNode`, `renderedPosition` and `livePosition` are optional derived caches over the single authoritative move tree and mutable persistent paths. When `renderedPath` is the same array as `livePath`, the getters alias both node and position caches; otherwise each selector keeps its own. Explicit setters seed or invalidate only their caches, append helpers push onto their own selector and advance its node cache, and `replaceMoveTree` invalidates all four. **Why:** reference identity records whether rendered state should follow a live mutation, while cache ownership stays with the transition that changes its authoritative selector.
- Two modes share the live game. History review is a `Live*Turn` or `Paused*Turn` state whose rendered path is a different array from `livePath`; explicit analysis is a `LiveAnalysisFrom*` or `PausedLiveAnalysisFrom*` state. `gameState` says whether exploration is enabled and path identity says whether the board follows live play; no extra review flag or control-mode value exists. **Why:** two indicators for the same fact could disagree; reusing existing data was an explicit constraint of the [background analysis plan](../../../ArchivedPlans/BackgroundAnalysisPlan.md#existing-data-determines-the-behaviour).
- `navigateToNode` is the public history-navigation boundary. `assertExplorationAllowed` throws in `BoardEdit` and during a Manual or Menu pause outside explicit analysis; paused explicit analysis may navigate. Nodes that fail `isNodeInTree` (stale, pruned or from another tree) are ignored and the caller refreshes from store state. Selecting a node whose path equals `livePath` returns to live through `_returnToLiveNode`, which also leaves explicit analysis. Otherwise the store installs a new independent path: explicit analysis keeps its family with actual and selected colours, an ongoing live game keeps `Live*Turn`/`Paused*Turn` with the actual side, and other games use `updateGameStateAfterPosition`. History selection never implicitly enters analysis.
- `enterInGameAnalysis` is a no-op without a live path, when already in explicit analysis, or during `BoardEdit`. It accepts ordinary live, Manual/Menu-paused live and ended live games. It copies the rendered path and position so the selection is independent even at equal path values, then selects the matching (paused) `LiveAnalysisFrom*` state, or `Analysis*Move` for an ended game. It does not pause, change pause reasons, clear or rearm the actual turn, or touch the clock. **Why:** the user's [live-progress decision](../../../questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) and [paused-entry decision](../../../questions/play/Q-PLAY-003-PausedAnalysisEntry.md) replaced the earlier rule that analysis entry froze the clock and turn; only the owning Resume may release a genuine pause. `PauseReason.Analysis` is retained for compatibility only.
- `exitInGameAnalysis` is a no-op without a live path, or when an ongoing game is not in explicit analysis. It reuses `_returnToLiveNode`: restore the shared `livePath` reference and live caches, select `Analysis*Move` for an ended game, `Paused*Turn` while a pause owner remains, otherwise `Live*Turn`, and refresh analysis only if the selected path changed. It never resumes, flushes held output or replays a reply.
- `gameplayOptions.showLiveAnalysisMoves` is persisted by the store but enforced by presentation: `AnalysisPanel` shows principal variations when the game has no live path, has ended, or the option is enabled. A selected suggestion re-enters `makeMove`, so live, review, live-analysis and free-analysis contexts follow the same dispatch as board input.

### Premoves
- The queue is runtime-only data at `game.$.premoveQueue?: IPremoveQueue` (`{ player, moves }`). `moves` is a `shallowReactive<IMoveRaw[]>` that retains the exact supplied references: push/shift/clear are observable while entries are not deep-converted. The queue is never serialised; restored games start without one.
- `makeMove` decides eligibility before canonical enrichment: an ongoing live game following the live selector, a non-Local side to move and exactly one Local seat. Hotseat and engine-versus-engine games never queue, and history review or explicit analysis never append. `appendPremove` trusts the producer's possible, completed move and neither validates, timestamps nor counts it.
- When `_requestPlayerMove` arms a Local turn it calls `_tryPremove`: the queue head is matched against `genLegalMovesForPiece` on the actual live position, enriched with `toDetailedMove`, shifted, and delivered to `attemptPlayerMove` with no intervening await. An illegal due head clears the whole queue and leaves the local turn waiting. If a pause wins before the handler commits, the accepted move is held in `deferredPlayerMove` with only the tail queued; `getPremoveProjection` draws that held move first.
- `_finaliseLiveMove` calls `revalidatePremoves`, which replays the remaining queue on a detached copy of the new live position with speculative movement rules (`genCandidateMovesForPiece`, source colour equal to the queue owner) and clears the whole queue at the first failure or once the game has ended.
- The whole queue is cleared at structural boundaries: resignation, draw agreement, timeout, history rewrite, takeback rewind, root replacement, reassignment, setup start and store disposal, plus presentation's board cancellation and tab close through `clearPremoves`.
- **Why:** entries are plain future input feeding the one existing actual-turn owner, so a queued move becomes history, a clock transition or recorded analysis only when the due turn accepts it. Per-entry promises, turn records, a scheduler, stored anchors or expected piece kinds were rejected because they duplicate turn ownership and can revive stale intentions. The invariant is at most one current-turn owner and no partial execution of an invalid sequence. See the [premove data structure](../../../ArchivedPlans/PremoveDataStructure.md) and [premove plan](../../../ArchivedPlans/PreMovePlan%28ToDo%29.md#whole-queue-validation).

### Player turns
- `requestPlayerMoveIfNeeded` is the single arming gate. It requires `isLiveTurnReadyForMove` (ongoing result, a live path, and a `Live*Turn` or unpaused `LiveAnalysisFrom*` state) and no existing pending turn; it does not require rendered and live selection to match. **Why:** mode-specific gates let local/engine combinations drift and can arm competing owners for one turn. Dropping the selection-equality condition is what lets engine replies and successor turns continue during review and analysis. The invariant is at most one current-turn owner regardless of provider type.
- `IGame.$.pendingPlayerTurnPromise` is the one deferred move for the current live turn, armed for Local and Engine players alike. `_requestPlayerMove` throws if one exists, then stores the `Deferred`, its started handler promise and its `AbortController` before an engine provider starts. Every ownership-changing action (resignation, accepted draw, timeout, reassignment, setup start, history rewrite, takeback and disposal) calls `clearPlayerTurnRuntime`, which aborts, rejects with the abort reason and awaits the handler before changing state. The handler clears the three fields in its `finally` block. **Why:** starting the provider first permits fast output to arrive before the completion owner exists; separate provider/UI promises could each run commit handling.
- Local board submission, a due premove and a guarded engine result all enter `attemptPlayerMove`, resolve the same deferred and await the same handler. Resolution and cancellation race through this single settlement point. Engine delivery also checks its real abort signal before calling `attemptPlayerMove`. An unexpected provider failure is logged and retried after 500 ms through `requestPlayerMoveIfNeeded`; `Aborted` returns without retry. **Why:** separate handlers duplicated pause and commit policy and let provider timing influence ownership; deferred identity plus first settlement ensures a late provider can affect only the turn that started it.
- If a guarded result settles while the game is paused, the handler records it in `deferredPlayerMove` only. The final real Resume calls `flushDeferredPlayerMove`, which clears the slot first and commits only if the turn is ready; otherwise the output is discarded. Entry, Exit and non-final pause removal never flush. **Why:** pause cannot mutate the live position, and repeating legality, engine lookup or pondering would duplicate completed engine-boundary work.
- Player creation, reassignment and restore wrap the base engine runtime from `EngineRuntimeService.ensureRuntime` with `shallowReactive` before engine work starts, so availability and error updates reach the player strip while maps, promises and process handles keep their identities.
- `reassignPlayer` throws during `BoardEdit` and is a no-op when the schema-parsed old and new players are equal. Otherwise it drains the turn, stops the previous engine player, clears premoves and installs the snapshot. When either seat becomes empty it converts to free analysis on the selected position: materialise and stop the clock, drop `livePath`, clear result, reason, draw offer and `pauseReasons`, and select `Analysis*Move`; root, tree and rendered path are kept. With both seats filled it preserves the current state family using the actual side. It timestamps, refreshes focus registration and calls the arming gate, which starts an engine provider or leaves a Local deferred waiting. It never starts a fresh live game; `startGameFromSetup` owns that.

### Clock, pause and results
- `syncClock` accepts a `ClockTimestamp`, not a string. **Why:** this action performs elapsed-time arithmetic at the clock ownership boundary; accepting strings would duplicate parsing and permit non-canonical timestamp input below the shared timestamp schema.
- Concurrent `syncClock` calls share the one pending settlement in `pendingTimeouts`. `_settleTimeout` captures the clock snapshot, drains the turn, and finalises only if the snapshot is still the same object and the game is still ongoing. Timeout clears premoves, stops the clock, records the win for the opponent and `ResultReason.Timeout`, arms the result notification, timestamps and refreshes registration. `GameView`'s clock tick calls `syncClock` when a displayed side reaches zero.
- Manual and Menu pause apply only to an ongoing game in a live or unpaused explicit-analysis state with a timed, running clock; adding a reason to an already paused game only layers that reason. Pause reconciles expiry first, pauses the clock, and selects `Paused*Turn` with the actual side or the matching `PausedLiveAnalysisFrom*` state. Resume removes only its own reason; while another remains, the game stays paused. The final removal resumes the clock, restores the unpaused family and lets the façade flush held output and arm the turn. Menu return therefore cannot auto-resume a Manual pause.
- Any pause blocks actual moves, takeback, resignation and draw actions, and board-edit entry. Paused explicit analysis still permits exploratory moves and history navigation ([BA-Q4](../../../ArchivedPlans/BackgroundAnalysisPlan.md#audit-decisions-and-remaining-clarification)). Player reassignment and analysis-engine management remain available while paused. The pause and move assertions throw rather than silently no-op, with the blocked `gameState` in the message.
- `refreshRuntimeRegistrations` first detaches the game's focus-return callback, then subscribes `syncClock` through `PlatformEventService.subscribeToAppFocusReturned` only for an ongoing, timed game with a running clock in a `Live*Turn` or unpaused `LiveAnalysisFrom*` state. It runs at every boundary that can change that eligibility: insertion, live commits, pause and resume, timeout, resignation, draw agreement, reassignment, setup start and takeback. Close-trigger autosave registration belongs to `SavedGamesStore`.
- Hydration reconstructs `[PauseReason.Manual]` for every persisted paused state, because runtime owners are excluded from the save schema. A restored paused analysis permits exploration immediately; Resume restarts actual timing while the analysis selection remains.
- Rule-resolved endings, resignation, draw agreement and timeout stop both clocks, clear any draw offer, select an `Analysis*Move` state and call `flagResultNotification`. Known gap: `GameClockComposable._finaliseTimeout` does not currently clear `drawOfferState`, so a pending offer survives a timeout; this is flagged as a code defect, not intended behaviour. A terminal move also stores the stopped snapshot on its node. Later analysis preserves the recorded outcome.
- `resultNotificationPending` is a one-shot runtime flag. `GameView` checks it on its clock tick, clears it and opens `GameResultModal`. **Why:** the flag lives on the game runtime, so the announcement survives route remounts and tab switches and is consumed once by whichever view next displays the game, without a store-to-view callback or watcher; being runtime-only, a restored game is never re-announced.
- `offerDraw` records an `Outgoing` `drawOfferState` from the actual side to move. `acceptDrawOffer` finalises a draw, `declineDrawOffer` clears the offer, and `withdrawDrawOffer` clears only an outgoing offer. All four use `assertOngoingLiveAction`, which permits ordinary live and history-review states but rejects explicit analysis and any pause. No current flow creates an `Incoming` offer; `GameControlPanel` already accepts one for a future non-local participant.
- Takeback asserts exploration is allowed and no pause applies, and on a game with a live path requires `gameplayOptions.allowTakeback`. The default count from `getTakeBackMoveCount` is 1, except that a Local-versus-Engine game counts back to and including the Local player's latest move (0 if it has none). The façade drains the turn and stops seated player engines first. `move.rewind` then clears premoves and calls `MoveHistoryService.takeBack`, which removes every descendant of the retained ancestor, selects that ancestor (a live game's two selectors share one new path array, so selection follows live again), and clears result and reason. A live game restarts the retained node's clock snapshot from now in a `Live*Turn` state, which also leaves explicit analysis; free-analysis takeback rewinds the rendered branch. The store does not itself reject takeback after a result, so a live-path takeback after a finished game resumes live play; presentation hides Takeback in the finished control mode.

### Analysis seats
- Seat identity is the current row index in `game.analysis.seats`. `addAnalysisEngine` rejects a second seat with the same `displayName` and more than four seats, then copies `displayName`, `entryPath`, `clientType` and a shallow copy of `options` from the profile; the profile `id` is not retained. It is assignment-only: `AnalysisEngineSelectionModal` awaits it and then calls `retryAnalysis` for the new index unless the game is in `BoardEdit`.
- `removeAnalysisEngine` disposes the seat's subscription, starts its engine stop, removes that seat object, timestamps and then awaits cleanup. `startGameFromSetup` and store disposal call `disposeAnalysisForGame` before replacing or abandoning seats.
- `refreshAnalysisForGame(game, engineIndex?)` clears the targeted seats synchronously, then starts independent `_startAnalysisSeat` calls. In `BoardEdit`, or when the rendered path equals the live path and the recorded result reason is checkmate or stalemate, it calls `stopAnalysis` instead because no move exists to search. Callers do not await engine startup to see the updated board. `refreshAnalysis` and `retryAnalysis` throw in `BoardEdit`.
- `_startAnalysisSeat` wraps `shallowReactive(toRaw(EngineRuntimeService.ensureRuntime(engine)))`, preserving the backing runtime and its process, map and async owners, subscribes, and starts a three-line infinite search. Failures are logged only when the seat is still current and the error is not `Aborted`.
- `_subscribeToAnalysis` disposes any earlier subscription for that engine and returns `_isCurrent`, true while the disposer is active and the seat still resolves for that engine. Updates are ignored when not current or in `BoardEdit`, and keep at most three lines. **Why:** callback identity protects the registration being detached; it is the seat's real owner check, not a numeric stale-result marker ([cleanup decisions](../../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions)).
- Explicit Stop retains the last lines and their completion flag; position changes, Refresh and Retry clear affected results. Stop timestamps a seat only if it is still assigned and no newer subscription owns it.
- `getVisibleAnalysis` returns `undefined` when no seats exist, otherwise `{ engineSeats: [...seats] }` with the canonical reactive seats in order, including empty ones; it performs no position filtering.
- Before an actual move is applied, `captureMoveAnalysis` copies seats that have lines through `analysisSeatSchema` into the new node's `recordedAnalysis`, only when the rendered path equals the live path by value. Exploratory appends never capture records.
- `insertGame` refreshes analysis after restore only when `settings.analysis.resumeLiveAnalysisAfterRestore` is enabled, the game is not in `BoardEdit` and it has seats; `createGame` and `startGameFromSetup` refresh whenever seats exist.

### Board edit
- `enterBoardEdit` is the public toggle. It throws while paused, and is a no-op for any workspace that retains a live path (live, live-analysis or finished live games) and for live-family states. From non-live analysis it stops analysis, selects `BoardEdit` and timestamps; calling it again selects `Analysis*Move` for the rendered side and refreshes analysis. `GameControlPanel` shows an explanatory message instead of calling it during in-game analysis.
- `toggleChessPiece` replaces a different piece, removes an equal kind-and-colour piece or adds to an empty square; `deleteChessPiece` removes a present piece; `moveChessPiece` relocates the source piece; `clearBoard` empties all squares. Each asserts `BoardEdit` before validating or mutating input. **Why:** these are public mutation boundaries that can be invoked outside the current UI; relying on hidden controls would allow callers to edit a live game.
- Piece edits target the rendered position (the root when the rendered path is empty). A no-op edit preserves history and results. The first effective edit of a non-root position, or of a root that has children, promotes that board through `move.replaceWithAnalysisRoot`, clearing premoves and history and installing a fresh clock snapshot and tree with no live path. Later edits mutate the same root in place, reset result and draw offer and invalidate the rendered cache. Each effective square mutation clears the board's runtime metadata, including `isStandardInitialPosition`.
- `resetBoardToStartPosition` asserts `BoardEdit` and always replaces the root with `createInitialBoardPosition()`, which carries known start-position metadata. `applyBoardEdit` is the full-position replacement boundary, asserts `BoardEdit` and does not touch the supplied position's runtime metadata. **Why:** UI visibility is not authorisation; omitting the gate here would bypass the assertions on every piece-level edit path.

### Workspace, hydration and persistence
- The `games` collection owns canonical reactive game references. `_replaceGame` returns the stored proxy, and hydration registrations, turn and analysis startup and later actions use that same object, so `createGame`, `insertGame`, `getGame` and `listGames` agree on identity while `toRaw` of the inserted game is the supplied payload. Rendering tracks the fields and arrays it reads; no publication counter, revision prop, holder map or `markRaw` opt-out exists. **Why:** the retired `workspaceRevision` counter forced manual notification and parallel ownership ([removal plan](../../../ArchivedPlans/WorkspaceRevisionRemovalPlan.md)); the invariant is one canonical reactive object per game, wrapped rather than cloned.
- `insertGame` takes ownership of the supplied payload: repair a duplicate ID, `hydrateGame` (parent links, independent rendered path for `*AnalysisFrom*` states, shared path otherwise, fresh runtime), reconstruct Manual pause ownership, normalise player runtimes, store the game, refresh focus registration, call the arming gate, then refresh analysis under the restore policy. Reopen, internal load, recent reopen, import and session restore all use it.
- Restore hydration belongs to `GamesStore`, not to `SerializationService` or `SavedGamesStore`. **Why:** runtime references depend on active-workspace ownership; hydrating during document validation would introduce state assumptions, while deferring hydration past insertion would leave node traversal broken.
- Duplicate-ID repair assigns a fresh UUID and updated timestamp when the payload's ID is already open, so loading an open game's save from `SavedGamesView` opens a renamed copy. `HomeView` reopens a recent entry by reusing the open game instead. An in-source owner note on `_repairDuplicateGameId` states that reopening a game saved at a different point should revert to that state rather than copy it; that behaviour is not implemented.
- `createGame` builds the root (`request.rootPosition` or the initial position), a new tree with the initial clock snapshot, metadata from `crypto.randomUUID`, and seats from `analysisEngineProfiles`. It creates a live game, with a started clock, only when both seats are assigned; otherwise `Analysis*Move` for the root side to move. `gameplayOptions` copies `allowTakeback` and `showLiveAnalysisMoves` as supplied; `copyGameRequest` in presentation and settings applies their defaults.
- `startGameFromSetup` disposes analysis and drains the turn concurrently, clears premoves, applies the request's name, players, time control, options and fresh seats, and re-initialises the clock. With both seats assigned it makes the current rendered path the live selector by reference and starts live play; otherwise it drops the live path and stays in analysis. It then timestamps, refreshes registration, arms the turn and awaits analysis refresh.
- `randomiseColours` is resolved once at creation or setup when both seats are assigned. A fair draw keeps or swaps the participants, then snapshots each with its resolved colour. Engine configuration and custom names stay with their participant; built-in Local names `White`/`Black` become `Player 1`/`Player 2`. Partial assignments keep their slots. The flag is creation-only and is not stored on `IGame`.
- There is no public remove or close action. Closing a tab changes `UiStateStore` and clears premoves; the game stays in the collection until store disposal.
- `GameRecordComposable` counts commits per game and, at each positive `gameSession.autosaveAfterMoveCount` interval, appends `saveGame(game, { targetKind: SaveGameTargetKind.Autosave })` to one serial queue without awaiting it. Success clears `autosaveError`; failure stores the message and notifies `onAutosaveFailed` listeners while keeping the queue usable. The live canonical game is serialised when the queued write runs.

### Async ownership and reactivity
- The store uses no watchers or equivalent reactive subscriptions. Rendering reads reactive game data; effects run at explicit action boundaries, engine callbacks and the view's lifecycle and clock tick.
- No generation, epoch or sequence counter invalidates async work. Each async operation has an explicit owner: the current turn's `Deferred`/`AbortController`/handler, the per-game `pendingTimeouts` settlement, the per-engine analysis disposer with `_isCurrent`, and the serial autosave queue. Duplicate starts are prevented at the owner (`_requestPlayerMove` throws on an existing turn, `syncClock` returns the pending settlement), and superseded work is cancelled and drained at its action boundary before replacement. The remaining identity checks (the captured clock snapshot in `_settleTimeout`, the captured rendered node and path in `_commitHistoryRewriteMove`) test the selection or clock that the action is about to change, not a version token. See [AGENTS.md](../../../../AGENTS.md#async-work-and-watchers) and the [cleanup plan](../../../ArchivedPlans/CodeCleanupPlan.md).

## Dependencies
- Internal composables: `GamePositionComposable`, `GameRecordComposable`, `GamePremoveComposable`, `GameTurnRuntimeComposable`, `GameStatusComposable`, `GameAnalysisComposable`, `GameClockComposable`, `GameMoveComposable`, `GamePlayerTurnComposable`, `GameBoardEditComposable`, `GameWorkspaceComposable`
- Layer-2 services: `MoveApplicationService`, `MoveHistoryService`, `TimeControlService`, `EngineRuntimeService`, `PlatformEventService`, `UserSettingService`
- Shared private utilities: chess rules and notation (`genLegalMovesForPiece`, `genCandidateMovesForPiece`, `toDetailedMove`, `resolveGameResult`, `createInitialBoardPosition`, board coordinate helpers), `Deferred`, timestamp classes, `logHandledError`
- Same-layer exception: `SavedGamesStore.saveGame`, called from `GameRecordComposable` only

`GamesStore` does not resolve platform adapters and does not use `PositionIdentityService` directly.

**Same-layer exception:** `GameRecordComposable.moveCommitted` resolves `useSavedGamesStore()` inside its queued autosave and calls `saveGame`. This contradicts the [dependency rule](../index.md#dependency-rules) that stores do not call sibling stores. It arose when move-count autosave moved from presentation into the store, and the [restructuring plan](../../../ArchivedPlans/StoreDependencyRestructuringPlan.md#outbound-dependencies) kept it unchanged because that pass was call-wiring only; no decision recorded it as a rule change. Lazy resolution keeps `SavedGamesStore` uninitialised during composition. It is documented as current behaviour, not as a precedent; a replacement must keep the serial queue, the per-game count and the failure notification.

Engine-profile selection from `EnginesStore` is bridged through presentation: modals read `EnginesStore.listConfiguredEngines()` and pass the chosen `IEngineRecord` or player snapshot into `GamesStore` actions.

## Scenario Coverage
- `SCN-GAME-01` to `SCN-GAME-03`
- `SCN-MOVE-01` to `SCN-MOVE-04`
- `SCN-HIST-01` to `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`
- `SCN-TIME-01` to `SCN-TIME-05`
- `SCN-CTRL-01` to `SCN-CTRL-05`
- `SCN-ENGINE-03`
- `SCN-SAVE-01` (move-count trigger only)
- `SCN-NAV-03`, `SCN-LOAD-01`, `SCN-IMPORT-01` (active-workspace insertion only)

## Notes
- The public interface is intentionally broad enough to cover every committed game-facing mutation without leaking domain-service calls into presentation code.
- `requestPlayerMoveIfNeeded` must remain a strict state check rather than a best-effort hint. Private turn creation rejects an existing pending turn; ownership-changing actions abort and drain the old handler before arming a replacement.
- `SavedGamesStore` owns saved-game serialisation, document reads and writes, restore lookup and external picker flows. `GamesStore` owns active-workspace creation, insertion, hydration and gameplay mutation once a payload is in hand, plus the move-count autosave trigger.
- Flow docs may refer to owner-private helpers such as duplicate-ID repair and workspace hydration. Those helpers remain private beneath the `GamesStore` façade in `GameWorkspaceComposable`; they are not shared utility-layer modules.
- `MoveHistoryService` mutates the one authoritative tree in place; rewrites retain existing node handles and never cause `GamesStore` to install a wrapper tree.
