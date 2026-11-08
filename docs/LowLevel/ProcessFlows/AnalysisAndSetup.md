# Analysis And Setup Flows

## Scope
This document covers `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03` and `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, plus analysis after a game ends and the analysis recorded on actual moves. Move routing, history and the game-end prompt are in [GameplayAndControl.md](GameplayAndControl.md). Engine operations, protocol states and process ownership below `EngineRuntimeService` are in [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md).

Persistence note: these flows change the canonical `IGame` and do not save it themselves. Analysis moves count towards the move-count autosave in `GameRecordComposable.moveCommitted`; other persistence is caller-owned through `SavedGamesStore.saveGame(...)` (see [PersistenceAndAdministration.md](PersistenceAndAdministration.md)).

Ownership: [GameAnalysisComposable](../../../src/state/game/GameAnalysisComposable.ts) owns the per-game seat roster, game subscriptions and seat results. [EngineRuntimeService](../../../src/domain/EngineRuntimeService.ts) owns operation cancellation, sequencing and availability on `engine.$`. [UciEngineClientBase](../../../src/platform/base/UciEngineClientBase.ts) owns protocol states for both the native and Worker clients. Shared utilities from `src/utility` are named in the notes rather than tabled, except `OperationOwner`, the ownership boundary of view playback. *(background)* marks work that the caller does not await.

## Shared Rendered Analysis Refresh

Every flow that changes the rendered position, and every explicit start, reaches this refresh.

| `GameAnalysisComposable.refreshAnalysisForGame(game, engineIndex?)` |
| --- |
| `_getTargetSeats(game, engineIndex)`: every seat, or only the seat at `engineIndex` |
| each target: `_disposeAnalysisSubscription(engine)` and `_clearAnalysisSeatLines(seat)` |
| `GamePositionComposable.getRenderedPosition(game)` |
| `BoardEdit`, or the rendered node is the live node and `resultReason` is `Checkmate` or `Stalemate`: `GameAnalysisComposable.stopAnalysis(game, engineIndex)` |
| otherwise: `GameAnalysisComposable._startAnalysisSeat(game, seat)` for each target, concurrently |
| `GameRecordComposable.timestampGame(game)` |

Callers: `GameMoveComposable._refreshRenderedAnalysis` (commits, navigation, Takeback, root replacement), `GameAnalysisComposable.refreshAnalysis` and `retryAnalysis`, `GameBoardEditComposable._applyEdit` and `enterBoardEdit`, and `GameWorkspaceComposable.createGame`, `startGameFromSetup` and `insertGame`.

| `GameAnalysisComposable._startAnalysisSeat(game, seat)` |
| --- |
| `seat.assignedEngine.$ = shallowReactive(toRaw(EngineRuntimeService.ensureRuntime(engine)))` |
| `GameAnalysisComposable._subscribeToAnalysis(game, seat)` |
| `seat.updatedAt = new AnalysisTimestamp()` |
| `EngineRuntimeService.startAnalysis(engine, game, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite })` - await |
| failure while the subscription is current, other than `Aborted`: log it |
| `finally`, still current: `GameRecordComposable.timestampGame(game)` |

| `GameAnalysisComposable._subscribeToAnalysis(game, seat)` |
| --- |
| `_disposeAnalysisSubscription(engine)` |
| `EngineRuntimeService.subscribeToAnalysis(engine, callback)` |
| store the disposer (mark inactive, unsubscribe) for that engine |
| return `_isCurrent`: active and the seat is still assigned to the game |

| `GameAnalysisComposable._subscribeToAnalysis: callback(update)` |
| --- |
| ignore when not current or in `BoardEdit` |
| `seat.updatedAt`; `seat.bestMove = update.bestMove`; `seat.lines = update.lines.slice(0, 3)`; `seat.isComplete = update.isFinal` |
| `GameRecordComposable.timestampGame(game)` |

| `AnalysisPanel.seats` computed |
| --- |
| `GamesStore.getVisibleAnalysis(game)?.engineSeats ?? []` |

| `GamesStore.getVisibleAnalysis(game)` |
| --- |
| alias of `GameAnalysisComposable.getVisibleAnalysis(game)`: no seats -> `undefined`; otherwise `{ engineSeats: [...game.analysis.seats] }` |

- Clear before start: targeted results are cleared synchronously before any engine starts, so the panel never shows lines for the previous position, and empty or `Starting` seats render before the first update. Each seat starts independently; a slow or failing engine does not delay the others. A refresh with an unchanged path (`_refreshRenderedAnalysis(game, false)`) only timestamps, so running searches and their results survive.
- Reactive runtime: `engine.$` is replaced by a shallow-reactive wrapper of the raw runtime, so availability and `lastError` written by `EngineRuntimeService` re-render the panel without deep proxies over host objects.
- Subscription ownership: each seat's game subscription is the owner of its results. `_isCurrent` requires that subscription to be active and the same seat object to still be in the roster. **Why:** an engine removed and re-added with the same name, or a seat replaced by setup, must not receive the old search's output. Position keys or counters were rejected because they cannot distinguish two identical positions in sequence (A -> B -> A). The service separately rejects output from a superseded operation; see [EngineRuntimeOwnership](EngineRuntimeOwnership.md#stream-analysis-output).
- Line limit: the runtime keeps every reported rank and validates all of them; the subscription renders the best three, which is also the persisted seat limit.
- Terminal live node: a checkmated or stalemated live position has no legal move to search, so the refresh stops those seats instead of starting them. Earlier nodes of a finished game, and positions ended by resignation, agreement, timeout or insufficient material, are analysed normally.
- `getVisibleAnalysis` returns all seats in roster order without filtering; empty, stopped, failed and restored seats remain present.

## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context

#### Flow A - Create A Free Analysis Workspace
| `GameCreationModal._submit()` |
| --- |
| `Free analysis` mode: `_effectiveRequest()` omits both players and sets `showLiveAnalysisMoves` |
| `useModalAction.run(action)` |
| `GameCreationModal._validateRequiredEngines(request)` returns immediately without both players |
| `GamesStore.createGame(request)` |
| `UiStateStore.openTab(game.metadata.id)` |
| `router.push('/game/' + game.metadata.id)` |

| `GamesStore.createGame(request)` |
| --- |
| alias of `GameWorkspaceComposable.createGame(request)` |

| `GameWorkspaceComposable.createGame(request)` |
| --- |
| `request.rootPosition` or a new standard start position |
| `GameClockComposable.initialiseClockSnapshot(request.timeControl)` |
| without both players: no `livePath`, `getAnalysisState(rootPosition.sideToMove)`, clock not started |
| `GamePlayerTurnComposable.createPlayerSnapshot` for any assigned seat |
| `MoveHistoryService.createMoveTree(initialClockSnapshot)` |
| `GameAnalysisComposable.createAnalysisSeat(profile, now)` for each analysis profile |
| `GameWorkspaceComposable._hydrateAndInsertGame(game)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` (no live path, so no turn) |
| seats present: `GameAnalysisComposable.refreshAnalysisForGame(game)` |

Quick game from Home or the menu uses the same `GamesStore.createGame` with the saved defaults; see [StartupAndNavigation.md](StartupAndNavigation.md).

#### Flow B - Convert A Live Game Into Free Analysis
| `PlayerSelectionModal._confirmPlayerSelection()` |
| --- |
| `Unassigned` selected |
| `GamesStore.reassignPlayer(game, colour, undefined)` |

`GamePlayerTurnComposable.reassignPlayer` cancels the turn, stops the replaced engine player, clears premoves and, because a seat is now empty, pauses the clock snapshot, removes `livePath`, clears result, offer and pause owners, and selects the analysis state of the selected position. The full table is in [SCN-ENGINE-03](GameplayAndControl.md#scn-engine-03---change-player-assignment-during-game). Analysis seats keep running on the selected position.

#### Flow C - Explore The Workspace
Board and PV moves commit as analysis branches through [SCN-MOVE-01 Flow B](GameplayAndControl.md#flow-b---move-in-free-analysis-or-after-a-result), each followed by the shared refresh. History navigation and one-ply Takeback use the ordinary flows in GameplayAndControl.

- `GameControlPanel` in `freeAnalysis` mode offers navigation, Takeback, Edit board and Start game.
- Requirement verification: `Pass`. A creation request with an unassigned side, or a reassignment to nobody, yields a non-live workspace that keeps its configured analysis seats.

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup

#### Flow A - Enter Board Edit
| `GameControlPanel._toggleBoardEdit()` (Edit board, `freeAnalysis` mode) |
| --- |
| `GameControlPanel._run(() => GamesStore.enterBoardEdit(game))` |

| `GamesStore.enterBoardEdit(game)` |
| --- |
| alias of `GameBoardEditComposable.enterBoardEdit(game)` |

| `GameBoardEditComposable.enterBoardEdit(game)` |
| --- |
| `GameStatusComposable.assertNotPausedForAction(game, 'Board edit entry')` |
| `game.livePath` exists: return |
| already `BoardEdit`: leave it (Flow D) |
| live, paused or live-analysis state: return |
| `GameAnalysisComposable.stopAnalysis(game)` *(background)* |
| `game.gameState = GameState.BoardEdit` |
| `GameRecordComposable.timestampGame(game)` |

#### Flow B - Apply An Edit
| `Chessboard._selectSquare(boardId)` in board edit |
| --- |
| emit `chessPieceToggled(boardId, { ...editPiece })` |

The other board-edit events are `chessPieceDeleted(boardId)` from `Chessboard._onContextMenu`, `chessPieceMoved(from, to)` from `Chessboard._onDrop`, and `boardCleared` / `boardReset` from the position-editor palette inside `Chessboard`. `GameView` binds each directly to `GamesStore.toggleChessPiece`, `deleteChessPiece`, `moveChessPiece`, `clearBoard` and `resetBoardToStartPosition`.

| `GamesStore.toggleChessPiece(game, boardId, piece)` |
| --- |
| alias of `GameBoardEditComposable.toggleChessPiece(game, boardId, piece)` |

| `GameBoardEditComposable.toggleChessPiece(game, boardId, piece)` |
| --- |
| `GameBoardEditComposable._assertBoardEditState(game)` |
| `GameBoardEditComposable._applyEdit(game, (position) => MoveApplicationService.togglePiece(position, boardId, piece))` |

`deleteChessPiece`, `moveChessPiece` and `clearBoard` follow the same two rows with `MoveApplicationService.deletePiece`, `movePiece` and `clearBoard`.

| `GameBoardEditComposable._applyEdit(game, edit)` |
| --- |
| target: `game.rootPosition` at the root selection, else `GamePositionComposable.getRenderedPosition(game)` |
| `edit(target)` returned `false`: return; history is kept |
| target is not the root, or the root has children: `GameMoveComposable.replaceWithAnalysisRoot(game, target, GameState.BoardEdit)` |
| otherwise: clear result, reason and offer; `GamePositionComposable.invalidateRenderedPosition(game)`; `GameAnalysisComposable.refreshAnalysisForGame(game)` *(background)* |

| `GameBoardEditComposable.resetBoardToStartPosition(game)` |
| --- |
| `GameBoardEditComposable._assertBoardEditState(game)` |
| `GameMoveComposable.replaceWithAnalysisRoot(game, startPosition, GameState.BoardEdit)` with a new standard start position |

| `GameMoveComposable.replaceWithAnalysisRoot(game, rootPosition, nextState)` |
| --- |
| `GamePremoveComposable.clearPremoves(game)` |
| `GameClockComposable.initialiseClockSnapshot(game.timeControl)` |
| `game.rootPosition = rootPosition` |
| `MoveHistoryService.createMoveTree(nextClockSnapshot)` |
| `GamePositionComposable.replaceMoveTree(game, moveTree)` |
| `GamePositionComposable.setRenderedPath(game, [], { node: moveTree.root })` |
| `GamePositionComposable.setLivePath(game, undefined)` |
| reset the clock snapshot, result, reason and offer; `game.gameState = nextState` |
| `GameMoveComposable._refreshRenderedAnalysis(game)` *(background)* |

`GamesStore.applyBoardEdit(game, rootPosition)` (alias of `GameBoardEditComposable.applyBoardEdit`) asserts board edit and calls `replaceWithAnalysisRoot` with a supplied root; no presentation flow calls it.

#### Flow C - Later Edits In The Same Session
| `GameBoardEditComposable._applyEdit(game, edit)` |
| --- |
| root selection with no children: mutate `game.rootPosition` in place |
| clear result, reason and offer; `GamePositionComposable.invalidateRenderedPosition(game)` |
| `GameAnalysisComposable.refreshAnalysisForGame(game)` *(background; stops seats while in `BoardEdit`)* |

#### Flow D - Leave Board Edit And Resume Analysis
| `GameControlPanel._toggleBoardEdit()` (Finish editing, `boardEdit` mode) |
| --- |
| `GameControlPanel._run(() => GamesStore.enterBoardEdit(game))` |

| `GameBoardEditComposable.enterBoardEdit(game)` in `BoardEdit` |
| --- |
| `game.gameState = getAnalysisState(getRenderedPosition(game).sideToMove)` |
| `GameAnalysisComposable.refreshAnalysisForGame(game)` *(background)* |

- First effective edit: the edited board becomes the root of a new root-only tree. **Why:** a board edit at a node with history, or at a root with continuations, would leave moves that no longer follow from the board. Replacing the tree keeps every stored move legal from its parent. Later edits at a root without children mutate that root in place, so a burst of edits does not rebuild the tree. An edit that changes nothing (`deletePiece` on an empty square, `movePiece` from an empty square or onto itself, `clearBoard` on an empty board) returns `false` and keeps history.
- Root identity: in-place edits keep the same `rootPosition` object. The UCI client therefore detects a new game boundary from the root FEN rather than object identity; see [EngineRuntimeOwnership](EngineRuntimeOwnership.md#analysis-runtime).
- State coverage: `GameState.BoardEdit` exists only without a live path. It blocks move submission, history navigation, player reassignment, Refresh and Retry (store throws; controls disabled), and the subscription callback ignores late updates. Entering stops engines; effective edits clear results; Finish editing restarts analysis.
- UI surface: the position-editor palette is part of `Chessboard.vue`, beside the board.
- Requirement verification: `Pass`.

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup

#### Flow
| `GameControlPanel._requestSetupStart()` (Start game, `freeAnalysis` mode) |
| --- |
| `useModal().open(GameCreationModal, { gameId })` |

| `GameCreationModal._submit()` |
| --- |
| setup mode prefills the name, Local players, options and the current seats' engines; both players are required |
| `useModalAction.run(action)` |
| `GameCreationModal._validateRequiredEngines(request)` |
| `signal.throwIfAborted()` |
| `GamesStore.startGameFromSetup(game, request)` |
| emit `dismissed` on success |

| `GameCreationModal._validateRequiredEngines(request)` |
| --- |
| each engine player: `EngineRuntimeService.getOptions({ ...assignedEngine, id: colour })` as an availability probe |
| failure: throw `<engine> is unavailable. Choose another player engine and try again.` |

| `GamesStore.startGameFromSetup(game, request)` |
| --- |
| alias of `GameWorkspaceComposable.startGameFromSetup(game, request)` |

| `GameWorkspaceComposable.startGameFromSetup(game, request)` |
| --- |
| `GameAnalysisComposable.disposeAnalysisForGame(game)` *(started before the next await)* |
| `GamePlayerTurnComposable.clearPlayerTurnRuntime(game)` |
| await the analysis disposal |
| `GamePremoveComposable.clearPremoves(game)` |
| name, `GameWorkspaceComposable._createPlayers(request)`, time control and gameplay options |
| `GamePositionComposable.getRenderedPosition(game)` |
| `GameAnalysisComposable.createAnalysisSeat(profile, now)` for each profile |
| `GameClockComposable.initialiseClockSnapshot(game.timeControl)` |
| both players: `GameWorkspaceComposable._startLiveGame(game, renderedPosition)`; otherwise no live path and analysis state |
| `GameRecordComposable.timestampGame(game)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` |
| `GameAnalysisComposable.refreshAnalysisForGame(game)` |

| `GameAnalysisComposable.disposeAnalysisForGame(game)` |
| --- |
| each seat: `_disposeAnalysisSubscription(engine)` and `_stopAssignedEngine(engine)` -> `EngineRuntimeService.stopEngine(engine)` |

| `GameWorkspaceComposable._startLiveGame(game, renderedPosition)` |
| --- |
| `GamePositionComposable.setLivePath(game, game.renderedPath, { node: getRenderedNode(game), position: renderedPosition })` |
| `GameClockComposable.startClock(game.clockSnapshot, renderedPosition.sideToMove, now)` |
| reset result and reason; `getLiveState(renderedPosition.sideToMove)` |

- State and settings coverage: the workspace leaves non-live analysis only when both seats are assigned. The newly chosen time control starts fresh clocks, and the per-game `showLiveAnalysisMoves` and `allowTakeback` choices are captured. Play starts from the selected node: its path becomes `livePath`, and the prepared root and tree are kept.
- Old seats: the captured old analysis engines are disposed before the new roster is installed, so none of them can deliver into the new seats.
- Requirement verification: `Pass (layer exception)`. `GameCreationModal._validateRequiredEngines` calls `EngineRuntimeService.getOptions` directly from presentation, as `useQuickGame` does, to probe each engine player before mutating the game. The exception is recorded in the [current exceptions](../Architecture/index.md#current-exceptions), with its rationale in the [quick game defaults design](../../ArchivedPlans/QuickGameDefaultsDesign.md#ownership-and-creation-flows).

## Analysis And Engine Runtime

### SCN-ANALYSIS-01 - Start Single Engine Analysis

#### Flow A - Automatic Refresh After A Rendered-Position Change
| `GameMoveComposable._refreshRenderedAnalysis(game, changed)` |
| --- |
| changed: `GameAnalysisComposable.refreshAnalysisForGame(game)` ([shared refresh](#shared-rendered-analysis-refresh)) |
| unchanged: `GameRecordComposable.timestampGame(game)` |

#### Flow B - Manual Refresh
The panel header's Refresh button, disabled in `BoardEdit` or without seats, runs the action below.

| `AnalysisPanel._run(action)` |
| --- |
| clear `errorMessage` |
| `GamesStore.refreshAnalysis(game)` |
| failure while the same game is shown: set `errorMessage` |

| `GamesStore.refreshAnalysis(game)` |
| --- |
| alias of `GameAnalysisComposable.refreshAnalysis(game)` |

| `GameAnalysisComposable.refreshAnalysis(game)` |
| --- |
| `BoardEdit`: throw |
| `GameAnalysisComposable.refreshAnalysisForGame(game)` |

| `EngineRuntimeService.startAnalysis(engine, game, request)` |
| --- |
| `_beginAnalysisOperation(runtime)`: abort and reject the previous service operation |
| capture `runtime.analysisCallback`; availability `Starting` |
| `_queueAnalysisOperation(runtime, operation, action)` |

The queued action calls `EngineRuntimeService.ensureReady(engine, signal)` and then `EngineClient.startAnalysis(engine, game, request, guardedCallback)`. Its full chain, streaming and stop protocol are in [EngineRuntimeOwnership](EngineRuntimeOwnership.md#analysis-runtime).

- UI surface: `AnalysisPanel.showMoves` is true without a live path, after a result, or when `gameplayOptions.showLiveAnalysisMoves` is set. Then each seat is a foldable group with status, depth and up to three lines of individually clickable moves. Otherwise the panel shows compact Evaluations rows with engine name and score. Engines keep searching in both views, and scores are shown from White's perspective.
- State gate: `refreshAnalysis` accepts live, paused, live-analysis and non-live analysis states and throws in `BoardEdit`. Paused play blocks move targets but not analysis management.
- Requirement verification: `Pass`. Startup, streaming and supersession are owned by the runtime boundary, not the view.

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis

#### Flow
| `GameAnalysisComposable.refreshAnalysisForGame(game)` |
| --- |
| `GameAnalysisComposable._startAnalysisSeat(game, seat)` for every seat, concurrently |

Each seat has its own `IAssignedEngine` copy with its own `engine.$`, process, operation and client session; one engine's failure records `Failed` and `lastError` on that seat only.

- Limit: at most four seats. `GameAnalysisComposable.addAnalysisEngine` rejects a fifth seat and a duplicate display name; `getGameCreationError` applies the same limits to creation and setup requests. `EnginesStore.validateAnalysisSelection` implements the same checks but has no production caller.
- UI surface: one group per seat, updated independently as each engine reports; folding is UI state in `IUiLayoutState.analysisEngineExpandedByIndex`.
- Requirement verification: `Pass`.

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis

#### Flow A - Stop Analysis Explicitly
| `AnalysisPanel._stop(seat)` (shown while `Running` or `Starting`) |
| --- |
| `AnalysisPanel._withSeat(seat, (game, index) => GamesStore.stopAnalysis(game, index))` |

| `GamesStore.stopAnalysis(game, engineIndex)` |
| --- |
| alias of `GameAnalysisComposable.stopAnalysis(game, engineIndex)` |

| `GameAnalysisComposable.stopAnalysis(game, engineIndex?)` |
| --- |
| each target: `_disposeAnalysisSubscription(engine)` |
| `EngineRuntimeService.stopAnalysis(engine)` - await |
| failure other than `Aborted`: log it |
| `finally`, seat still assigned and not resubscribed: `GameRecordComposable.timestampGame(game)` |

| `EngineRuntimeService.stopAnalysis(engine)` |
| --- |
| `_beginAnalysisOperation(runtime)` |
| queued: a search needs stopping and a process exists: `_assertProcessOpen`, then `EngineClient.stopAnalysis(engine)` |
| availability `Ready` with a process, otherwise `Unavailable` |

#### Flow B - Retry A Failed Engine
| `AnalysisPanel._retry(seat)` (shown for `Failed`) |
| --- |
| `AnalysisPanel._withSeat(seat, (game, index) => GamesStore.retryAnalysis(game, index))` |

| `GamesStore.retryAnalysis(game, engineIndex)` |
| --- |
| alias of `GameAnalysisComposable.retryAnalysis(game, engineIndex)` |

| `GameAnalysisComposable.retryAnalysis(game, engineIndex)` |
| --- |
| `BoardEdit`: throw |
| `GameAnalysisComposable.refreshAnalysisForGame(game, engineIndex)` |

#### Flow C - Unexpected Analysis Engine Exit
| `UciEngineClientBase._attachToProcess: onExit` |
| --- |
| session not `Stopped`: `UciEngineClientBase._failUciSession(session, UnexpectedExit error with exit detail)` |

A Worker engine reaches the same listener through `BrowserWorkerProcess._close`, called by its Worker `error` or `messageerror` handler or a failed `postMessage`. The next operation on that engine, normally the next position refresh or a Retry, finds the process closed in `EngineRuntimeService._initialiseEngine`, respawns it and performs a fresh handshake ([EngineRuntimeOwnership](EngineRuntimeOwnership.md#stop-restart-and-failure)).

- Stop retention: Stop keeps `lines`, `bestMove`, `updatedAt` and `isComplete`, and publishes `Ready` (or `Unavailable` without a process). A stopped search and a naturally completed search are different states; Refresh restarts a stopped seat.
- Unexpected exit: the session fails and the last valid lines stay visible. An exit while idle is not published by itself; availability keeps its last value until the next runtime operation, as stated in the [engine runtime contract](../../HighLevel/engine_runtime.md). Failures seen by service operations do record `Failed` and `lastError`.
- Malformed output: an unparsable `info` line is dropped without stopping the session. A recognised control line that is invalid for the current state fails the session and records `lastError`.
- Retry stays manual; there is no timeout, automatic reconnect or backoff for analysis seats.
- Requirement verification: `Pass`. Stop retention, cancellation, malformed-output handling and manual retry have automated coverage.

### SCN-ANALYSIS-04 - Click Suggested Move from Analysis Panel

#### Flow A - Select A Prefix
| `AnalysisPanel._selectMoves(line, moveIndex)` |
| --- |
| emit `moveSelected(line.pv.slice(0, moveIndex + 1))` |

Move buttons exist only when `showMoves` is true, and are disabled by the panel's `disabled` prop (board input disabled or board edit).

| `GameView.inputActions.line(moves)` |
| --- |
| ignore when `renderedBoard` is no longer the publication the action was created for |
| `GameView._playAnalysisLine(moves)` |

| `GameView._playAnalysisLine(moves)` |
| --- |
| return unless `showAnalysisMoves` and no line is playing |
| exploration: no live path, a final result or explicit in-game analysis |
| ordinary live play while the engine is to move: [premove branch](GameplayAndControl.md#flow-g---premove-from-an-analysis-line) |
| `GameView._requestMoves(exploration ? moves : moves.slice(0, 1))` |

#### Flow B - Free Analysis, Finished Game Or Explicit Analysis
| `GameView._requestMoves(moves)` |
| --- |
| `GameView._run(() => GameView._applyMoves(game, moves))` |

| `GameView._applyMoves(game, moves)` |
| --- |
| preflight the whole prefix on a detached copy, advancing it with `MoveApplicationService.applyMove` |
| `OperationOwner.run(action)` |
| each move: wait 350 ms from the second move; check signal, game, tree, analysis mode, result, input permission, board edit and expected path |
| `GamesStore.makeMove(game, rawMove)` |

`GamesStore.makeMove` commits each step through [SCN-MOVE-01 Flow B or Flow C](GameplayAndControl.md#scn-move-01---legal-move-on-board).

#### Flow C - Live Play At The Current Position
`_playAnalysisLine` submits only the first move. `_applyMoves` and `GamesStore.makeMove` then follow [SCN-MOVE-01 Flow A](GameplayAndControl.md#flow-a---local-move-at-the-live-position) through `attemptPlayerMove`.

#### Flow D - Live History Review
With Takeback allowed, `_requestMoves` opens the rewrite confirmation for the first move ([SCN-HIST-02](GameplayAndControl.md#scn-hist-02---continue-from-historical-node-takeback-allowed)). Without Takeback, `GameView.canInput` is false and the PV buttons are disabled until explicit Analyse.

#### Flow E - Cancel Playback
| `OperationOwner.cancel()` (the view's `playback` owner) |
| --- |
| abort the current controller, which also cancels the pending 350 ms wait |
| return the settled completion |

Callers: `GameView._activateGame`, `onBeforeRouteLeave`, `GameView._navigateToNode`, `GameView._runInputAction` and `GameView._handleMenuInterruptionRequested`. Unmount calls `OperationOwner.dispose()`, which also prevents later starts.

- Playback owner: `OperationOwner` aborts the current playback and serialises its settlement before a replacement starts. **Why:** it replaced the `playbackGeneration` counter, which had to be compared after every await and could not cancel the pending delay itself. The invariant is at most one playback; its `finally` cleanup (`isPlayingLine = false`) finishes before another can own the UI, and each step rechecks the actual game, tree, mode, result, permission and selected path as legality constraints. See the [code cleanup decisions](../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions).
- Utilities: the preflight uses `isMoveLegal` and `toDetailedMove`; the step wait is `abortableDelay`, which clears its timer on abort.
- Stale prefix: a prefix that is no longer legal is rejected whole before its first move, with the notice to Refresh analysis. Cancellation after a committed step keeps that step and drops the suffix.
- State coverage: non-live analysis and finished games always render move targets. Ongoing live play renders them only when `showLiveAnalysisMoves` is set. Genuine pauses disable them; paused explicit analysis allows full-prefix playback while actual play stays paused.
- Requirement verification: `Pass`. Individual move selection, prefix playback, first-move live submission, whole-prefix stale rejection and cancellation on game switch have journey and integration coverage; see the [analysis review](../../../journeys/definitions/analysis/ScenarioReview.md) and [execution evidence](../../ArchivedPlans/JourneyImplementation.md#analysis-verification).

### SCN-ANALYSIS-05 - Add or Remove Per-Game Analysis Engine During Game

#### Flow A - Add An Analysis Engine
| `AnalysisPanel._addEngine()` |
| --- |
| `canAdd`: fewer than four seats and more configured engines than seats |
| `useModal().open(AnalysisEngineSelectionModal, { gameId })` |

| `AnalysisEngineSelectionModal._confirmAnalysisEngine()` |
| --- |
| `useModalAction.run(action)` |
| `GamesStore.addAnalysisEngine(game, engineProfile)` |
| capture the new seat before awaiting the add |
| find that seat's current index |
| not `BoardEdit` and still assigned: `GamesStore.retryAnalysis(game, index)` |
| emit `dismissed` on success |

| `GamesStore.addAnalysisEngine(game, engineProfile)` |
| --- |
| alias of `GameAnalysisComposable.addAnalysisEngine(game, engineProfile)` |

| `GameAnalysisComposable.addAnalysisEngine(game, engineProfile)` |
| --- |
| duplicate display name: throw |
| four seats already: throw |
| `GameAnalysisComposable.createAnalysisSeat(engineProfile, new Date())` appended to the roster |
| `GameRecordComposable.timestampGame(game)` |

#### Flow B - Remove An Analysis Engine
| `AnalysisPanel._remove(seat)` |
| --- |
| `AnalysisPanel._withSeat(seat, action)` |
| `GamesStore.removeAnalysisEngine(game, index)` |
| `UiStateStore.setLayoutState(...)` with that index removed from `analysisEngineExpandedByIndex` |
| `UiStateStore.saveLayoutState()` |
| await removal and layout save together |

| `GamesStore.removeAnalysisEngine(game, engineIndex)` |
| --- |
| alias of `GameAnalysisComposable.removeAnalysisEngine(game, engineIndex)` |

| `GameAnalysisComposable.removeAnalysisEngine(game, engineIndex)` |
| --- |
| `_disposeAnalysisSubscription(engine)` |
| `_stopAssignedEngine(engine)` -> `EngineRuntimeService.stopEngine(engine)` *(started)* |
| remove the seat from the roster |
| `GameRecordComposable.timestampGame(game)` |
| await the engine stop |

- Add is assignment-only; the modal then starts only the new seat through `retryAnalysis`, so other seats keep their searches and results. During board edit the new seat waits for Finish editing.
- Remove disposes the subscription and removes the seat synchronously before awaiting process cleanup, so late output cannot reach it.
- State gate: add and remove are valid in live, paused, live-analysis and non-live analysis states. Paused play blocks move targets, not roster management.
- UI surface: the panel header owns Refresh and Add; each seat row owns Retry or Stop and Remove.
- Requirement verification: `Pass`.

### Analysis After Game End

#### Flow A - Result Transition
| `GameMoveComposable._finaliseLiveMove(game, livePosition, isLivePositionRendered)` |
| --- |
| final result recorded and state set to non-live analysis |
| `GameMoveComposable._refreshRenderedAnalysis(game, isLivePositionRendered)` *(background)* |

The shared refresh stops seats when the selected live node ends in checkmate or stalemate, and restarts them on the final position after insufficient material. Resignation, draw agreement and timeout do not refresh; their running searches continue on the selected position.

#### Flow B - Start Analysis From The Result Prompt
| `GameResultModal._analyse()` |
| --- |
| `useModalAction.run(() => GamesStore.refreshAnalysis(game))` |
| emit `dismissed` on success |

`GamesStore.refreshAnalysis` follows SCN-ANALYSIS-01 Flow B. A game without seats has nothing to start; seats are added from the panel (SCN-ANALYSIS-05).

#### Flow C - Explore The Finished Game
| `AnalysisPanel.showMoves` / `GameView.showAnalysisMoves` computed |
| --- |
| true once `resultState` is not `Ongoing`, whatever `showLiveAnalysisMoves` says |

Board input and PV playback are exploration (SCN-ANALYSIS-04 Flow B) and commit analysis branches through SCN-MOVE-01 Flow B. Navigating to earlier nodes restarts analysis on them.

| `UciEngineClientBase._completeAnalysis(engine, session, context, line)` |
| --- |
| `bestmove` without a move is accepted when the analysed position has no legal moves |
| `session.current = Ready`; final update through `context.onUpdate` |

- Visibility after a result: `showLiveAnalysisMoves` protects ongoing play from engine suggestions. **Why:** once actual play has ended there is nothing left to protect, and hiding PV moves would block review of how the game was decided. The invariant is that the preference applies only while `resultState` is `Ongoing`.
- Requirement verification: `Pass`.

### Recorded Move Analysis

| `GameMoveComposable._applyLiveMove(game, move, moveTimestamp)` |
| --- |
| `GameAnalysisComposable.captureMoveAnalysis(game)` before the live position changes |
| `nextNode.recordedAnalysis = recordedAnalysis` |

| `GameAnalysisComposable.captureMoveAnalysis(game)` |
| --- |
| return `undefined` unless the rendered path equals the live path |
| each seat with lines, copied through `analysisSeatSchema.parse(seat)` |
| `{ recordedAt: new AnalysisTimestamp(), seats }`, or `undefined` when no seat has lines |

- Only actual moves record analysis; exploratory and analysis-branch moves never do. Analysis of a different rendered position is never copied onto the actual move.
- The schema parse is a deliberate copy at a persistence boundary: the recorded snapshot is immutable history, while the live seat is cleared on the next refresh.
- Recorded analysis is saved with the game and is not shown in the sidebar.
