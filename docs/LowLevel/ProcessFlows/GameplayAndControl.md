# Gameplay And Control Flows

## Scope
This document covers `SCN-MOVE-01` to `SCN-CTRL-05` and `SCN-ENGINE-03`.

Persistence note: this document focuses on active-game mutation. When a flow needs the resulting workspace persisted, presentation follows up with `SavedGamesStore.saveGame(...)`; that caller-owned save step is shown only where persistence behaviour is itself part of the scenario or materially affects the branch.

## Move Execution

### SCN-MOVE-01 - Legal Move on Board

#### Flow A - Live Move At The Current Position
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `GameView._handleCommittedMoveResult` |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.makeMove` |
| `GameStatusComposable.assertMoveAllowed` |
| `GamePlayerTurnComposable.attemptPlayerMove` |
| `GamePlayerTurnComposable.playerMoveHandler` |
| `GameMoveComposable.commitLiveMove` |
| `GameClockComposable.applyMove` |
| `GameAnalysisComposable.refreshAnalysisForGame` *(background)* |

| `MoveApplicationService.applyMove` |
| --- |

| `TimeControlService.applyMove` |
| --- |
| `TimeControlService._applyIncrement` |
| `TimeControlService._switchActiveColour` |

| `MoveHistoryService.addMainlineMove` |
| --- |

| `GameView._handleCommittedMoveResult` |
| --- |
| `GamesStore.getGame` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GameAnalysisComposable.refreshAnalysisForGame` |
| `GameAnalysisComposable.startAnalysisSeat` |
| `GameAnalysisComposable.subscribeToAnalysis` |

| `GameAnalysisComposable.startAnalysisSeat` |
| --- |
| `EngineRuntimeService.ensureReady` |
| `EngineRuntimeService.startAnalysis` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GameAnalysisComposable.subscribeToAnalysis callback` |

| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| --- |
| `GamePlayerTurnComposable.requestPlayerMove` |

#### Flow B - Analysis-Only Move
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `GameView._refreshVisibleAnalysisAfterCommittedMove` |

| `GamesStore.makeMove` |
| --- |
| `GameStatusComposable.assertMoveAllowed` |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.commitStandaloneAnalysisMove` |
| `GameAnalysisComposable.refreshAnalysisForGame` *(background)* |

| `MoveApplicationService.applyMove` |
| --- |

| `MoveHistoryService.addAnalysisMove` |
| --- |

| `GameView._refreshVisibleAnalysisAfterCommittedMove` |
| --- |
| `GamesStore.getGame` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GameAnalysisComposable.refreshAnalysisForGame` |
| `GameAnalysisComposable.startAnalysisSeat` |
| `GameAnalysisComposable.subscribeToAnalysis` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GameAnalysisComposable.subscribeToAnalysis callback` |

- State/settings coverage: `makeMove` dispatches by `gameState`. `LiveWhiteTurn` and `LiveBlackTurn` commit live moves and may trigger a player-engine reply. `AnalysisWhiteMove`, `AnalysisBlackMove`, and `LiveAnalysisFrom*` stay analysis-only. `BoardEdit` and ordinary paused states block move submission; explicit analysis, including paused analysis, permits rendered-branch moves while actual turn/clock ownership remains independent; terminal results transition to non-live analysis and `resultState` prevents further live progression. Checkmate remains `CheckState.Checkmate` on the completed move and as a derived position cache, not a `GameState`.
- Continuous analysis update loop: `GameAnalysisComposable.refreshAnalysisForGame` -> `GameAnalysisComposable.startAnalysisSeat` -> `GameAnalysisComposable.subscribeToAnalysis` -> `EngineRuntimeService.startAnalysis(engine, game, request)` (owns `ensureReady` and cancellation) -> client state-machine updates -> guarded subscription callback selects three rendered lines -> `touchGame` -> `AnalysisPanel` rerenders the affected seat. A live move while browsing history preserves the unchanged rendered analysis.
- Runtime ownership detail: see [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for the lower-layer state transitions behind analysis start, streamed updates, player turns, and pondering.
- Requirement verification: `Pass`. The move commits once and fans out to history, clocks, and analysis from one store boundary.

### SCN-MOVE-02 - Legal Move Filtering

#### Flow A - App Move Selection
| `Chessboard.pieceSelected` |
| --- |
| `GameRuleUtility.genLegalMovesForPiece` |
| `GameRuleUtility.toDetailedMove` |
| `Chessboard.moveSubmitted` |

#### Flow B - Player Engine Result
| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| --- |
| `GameRuleUtility.isMoveLegal` |
| `MoveApplicationService.genPosition` *(detached sequential validation)* |
| `GameRuleUtility.isMoveLegal` *(optional ponder move)* |
| `GamePlayerTurnComposable.attemptPlayerMove` |

- App-owned board and analysis interactions can submit only moves produced from legal move targets, so `GamesStore.makeMove` does not redundantly revalidate them.
- The player-engine result is the external move-producing boundary. `EngineRuntimeService.awaitPlayerTurnMove` validates the best move against the captured search position and any ponder continuation against a detached position after that move. Invalid output fails the provider before `attemptPlayerMove`; the engine-agnostic handler, deferred flush, and commit path do not revalidate it.

### SCN-MOVE-03 - Pawn Promotion Resolution

#### Flow A - Build The Promotion Move Before Submission
| `Chessboard.commitTarget` |
| --- |
| `Chessboard.pendingPromotionMoves` *(board-local chooser; no move submitted)* |
| `Chessboard.choosePromotion` |
| `Chessboard.emitMove` |
| `GameRuleUtility.toDetailedMove` |
| `Chessboard.moveAttempted` |
| `GameView.makeMove` / `requestMoves` |
| `GamesStore.makeMove` |

#### Flow B - Cancel Promotion Before Submission
| `Chessboard` inline chooser `Cancel` |
| --- |
| `Chessboard.clearSelection` *(clears selected square and pending choices)* |

- UI surface coverage: promotion uses the inline Chessboard popover, exposed as the named Pawn promotion group. Each choice has an accessible name identifying colour and kind. There is no separate PiecePalette or shared modal in this flow.
- Cancellation and pending-choice boundary: no move, capture, turn or history mutation occurs before a choice. Cancel permits a different move to be selected. Position/edit-mode changes also clear local selection.
- Settings coverage: baseline `gameplay.promotionPolicy` is `requireExplicitSelection` only, so promotion stays blocked until an explicit piece choice is received.
- Process note: once the selected piece is merged into the move, `GamesStore.makeMove` simply follows the same context-specific commit path as `SCN-MOVE-01`. There is no pending-promotion state on the game model.
- Requirement verification: `Pass`. Promotion remains explicit without introducing a special pending-move game state.
- Journey verification: JRN-PROMO-01–05 cover both colours, every quiet/capture choice, gestures/orientation and promoted save/reload/takeback; see [the owned review](../../../journeys/definitions/promotion/ScenarioReview.md) and [execution record](../../JourneyImplementation.md#promotion-verification). JRN-RULE-01–06 add castling, en passant, king-safety rejection, timed rule-resolved draws and special-move restoration; see the [Rules review](../../../journeys/definitions/rules/ScenarioReview.md).

## Engine-Controlled Turn

### Live Non-Local Player Move Generation

#### Flow A - Successful Player Engine Turn
| GamePlayerTurnComposable.requestPlayerMoveIfNeeded |
| --- |
| GamePlayerTurnComposable.requestPlayerMove |
| create and store the shared `Deferred<IMove>` and handler promise |
| GamePlayerTurnComposable.playerMoveHandler |

| GamePlayerTurnComposable.requestEngineMove |
| --- |
| EngineRuntimeService.ensureReady |
| EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove, signal) |

| EngineRuntimeService.startPlayerTurn |
| --- |
| EngineClient.startPlayerTurn |
| EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition) |
| begin optional `EngineRuntimeService.startPondering(engine, game, engineMove, ponderMove)` |
| GamePlayerTurnComposable.attemptPlayerMove |
| GamePlayerTurnComposable.playerMoveHandler |
| GameMoveComposable.commitLiveMove |

#### Flow B - Unexpected Exit During Player Turn
| `EngineRuntimeService player-turn promise` |
| --- |
| `GamePlayerTurnComposable.requestPlayerMove error handler` |
| `GamesStore.pauseGame` |
| `GameView._openRuntimeErrorDialog` |

#### Flow C - Player Turn Completes While Paused
| `EngineRuntimeService.startPlayerTurn` |
| --- |
| begin optional pondering from the guarded result |
| `GamePlayerTurnComposable.attemptPlayerMove` |

| `GamePlayerTurnComposable.playerMoveHandler` |
| --- |
| `game.$.deferredPlayerMove = move` |

| `GamePlayerTurnComposable.flushDeferredPlayerMove` after resume |
| --- |
| `GameMoveComposable.commitLiveMove` |

- Runtime distinction: analysis search keeps streaming updates over time, while a player-engine turn waits only for the final awaited move and then ends that turn-scoped search.
- State gate: `requestPlayerMoveIfNeeded` uses existing actual readiness: an ongoing live path in unpaused ordinary-live or explicit-analysis state, with no pending turn owner. Selected-path equality is not required. Local and engine players use the same game-level deferred turn.
- Guardrails: player-engine turn generation is blocked in non-live analysis, board edit, paused live games, and whenever `resultState` is not ongoing. A checkmating move records `CheckState.Checkmate` before the game transitions to non-live analysis.
- Paused completion rule: if an already-started player-engine turn resolves while the game is paused, the guarded result is accepted through the same `attemptPlayerMove(...)` and recorded as deferred output. Available pondering has already begun directly from the engine result. When pause clears, `flushDeferredPlayerMove(...)` commits it without revalidation, engine lookup, or a second pondering request.
- Completion rule: the player-engine turn completes only when `EngineRuntimeService.awaitPlayerTurnMove(...)` resolves with a valid move. The baseline defines no no-response timeout.
- Silent-engine rule: if the engine process is still running but has not replied with a valid move, the turn remains pending and the live clock keeps running.
- Runtime-error rule: malformed player-turn output or other unexpected runtime exceptions are logged and surfaced through the owning standard error-handling path without inventing automatic reconnect, automatic stop, or timeout behaviour.
- Unexpected-exit rule: process termination is the only automatic disconnect trigger. The owning flow marks the affected seat unavailable or disconnected, pauses the live game immediately, and opens the standard runtime error dialog.
- Runtime ownership detail: see [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for the explicit runtime-service and engine-client mutation steps behind player-turn preparation, search start, awaited completion, malformed output, and unexpected exit.

### SCN-ENGINE-03 - Change Player Assignment During Game

#### Flow
| `PlayerPanel.playerSelectionConfirmed` |
| --- |
| `UiStateStore.showModal` |
| `EnginesStore.createPlayer` |
| `GamesStore.reassignPlayer` |
| `GameView._refreshRuntimeAfterPlayerReassignment` |

| `UiStateStore.showModal` |
| --- |

| `EnginesStore.createPlayer` |
| --- |

| `GamesStore.reassignPlayer` |
| --- |
| `GamePlayerTurnComposable.reassignPlayer` |
| `GamePlayerTurnComposable.reassignPlayer` |
| `GamePlayerTurnComposable.reassignPlayer` |

| `GameView._refreshRuntimeAfterPlayerReassignment` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.refreshAnalysis` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |

- State coverage: player reassignment is valid in live states, paused live states, live-analysis states, and non-live analysis states for the baseline `PlayerType.Local` or `PlayerType.Engine` seat model. Board edit disables player-reassignment presentation and rejects reassignment at the store boundary.
- Requirement verification: `Pass`. Player reassignment stays explicit at the store boundary, cleanly supports conversion into setup/analysis from the visible context, preserves ongoing live games when no setup transition is needed, and reuses the normal player-engine turn gate.

## History And Branching

### SCN-HIST-01 - Navigate Move History Node

#### Flow
| `HistoryPanel.nodeSelected` |
| --- |
| `GamesStore.navigateToNode` |
| `GameView._refreshVisibleAnalysisAfterNavigation` |

| `GamesStore.navigateToNode` |
| --- |
| `GamePositionComposable.setRenderedPath` |
| `GameStatusComposable.updateGameStateAfterPosition` |

| `GameView._refreshVisibleAnalysisAfterNavigation` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.refreshAnalysis` |
| `GamesStore.getVisibleAnalysis` |

- Runtime selector coverage: `HistoryPanel.nodeSelected` carries a hydrated `IMoveNode` from the current tree. `GamesStore.navigateToNode` validates that node against the current root before deriving persisted selector bookkeeping, and ignores stale nodes by refreshing from current store state.
- Start position selects the root through the same navigation boundary. Live position resolves the persisted live path through the current tree rather than requiring a populated runtime cache. Membership checks validate every parent-child link before deriving a path, including detached nodes whose stale parent reference remains.
- State coverage: ordinary history review keeps the ordinary live state and actual colour. Background turns/clock continue while selected history stays independent. Explicit Analyse uses its existing analysis state family. Genuine pauses lock ordinary history; paused explicit analysis permits history/moves and preserves actual pause ownership.
- Requirement verification: `Pass`. Board, history, and analysis bind to the selected visible node while live play remains independent.

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)

#### Flow
| `Chessboard.moveSubmittedFromHistory` |
| --- |
| `GamesStore.makeMove` |
| `TimeControlService.applyMove` |
| `MoveHistoryService.addMainlineMove` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.commitHistoryRewriteMove` |
| `GamePositionComposable.getRenderedNode/getRenderedPosition` |
| `GamePositionComposable.setLivePath` with the rendered path, node, and position references |
| restart the selected node clock snapshot from the current timestamp |
| `GameMoveComposable.applyLiveMove` |
| `GameClockComposable.applyMove` |
| `MoveHistoryService.addMainlineMove` |
| `GamePositionComposable.appendLivePath` |
| `GameMoveComposable.finaliseLiveMove` |

| `TimeControlService.applyMove` |
| --- |
| `TimeControlService._applyIncrement` |
| `TimeControlService._switchActiveColour` |

| `MoveHistoryService.addMainlineMove` |
| --- |

- Per-game coverage: `game.gameplayOptions.allowTakeback = true` routes this flow into live mainline mutation.
- Requirement verification: `Pass`. `commitHistoryRewriteMove(game, move)` obtains the rendered node and position itself, cancels the old live turn, aliases `livePath` to `game.renderedPath`, restarts the historical clock snapshot, and directly invokes the shared application and finalisation steps before appending that shared selector once through `livePath`. It never calls `commitLiveMove` or its pruning action. Rendered and live caches share the position object mutated by the replacement move, while the old continuation remains attached as a sibling variation.

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)

#### Flow - Explicit Analysis Required

`GameView Analyse -> GamesStore.enterInGameAnalysis -> GameMoveComposable.enterInGameAnalysis -> detached selected canonical board`.

`board/PV -> GameView._requestMoves/_applyMoves -> GamesStore.makeMove -> _commitLiveAnalysisMove -> _advanceRenderedAnalysisBranch -> MoveHistoryService.addAnalysisMove`.

- With Takeback disabled, ordinary historical input is disabled until explicit Analyse. Both existing exit-preference settings leave explicit analysis selected; only a deliberate Exit/Live selection returns to actual play.
- With Takeback enabled, ordinary historical input keeps its existing rewrite confirmation. Explicit analysis bypasses that confirmation and does not rewrite actual play.

### SCN-HIST-04 - Automatic Pruning After Live Move From The Latest Node

#### Flow
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `MoveHistoryService.pruneFutureMoves` |
| `TimeControlService.applyMove` |
| `MoveHistoryService.addMainlineMove` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| `SavedGamesStore.saveGame` |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.commitLiveMove` |
| `GameClockComposable.applyMove` |
| `GameMoveComposable.applyLiveMove` |
| `GamePositionComposable.appendLivePath` |
| `GameMoveComposable.finaliseLiveMove` |

| `MoveHistoryService.pruneFutureMoves` |
| --- |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- UI surface coverage: there is no user-facing prune action or confirmation dialog in the baseline. The pruning action is automatic and is triggered by the next real live move from the same latest node after in-game analysis exit.
- Runtime selector coverage: `GamesStore` advances actual play independently during analysis and runs the automatic pruning action through `MoveHistoryService.pruneFutureMoves` when real play resumes from the current latest live node with exploratory descendants still attached. Pruning mutates that node in the existing authoritative tree; the following move commit attaches its child and advances the selectors without replacing the tree. The separate history-rewrite flow retains old moves that were actually played.
- Requirement verification: `Pass`. Latest-node exploratory branches remain inspectable after analysis exit, but the automatic pruning action discards them once real play supersedes them.

## Time Control

### SCN-TIME-01 - Clock Ticks During Play

#### Flow
| `GameView.onClockTick` |
| --- |
| `GamesStore.getGame` |
| `GameView._buildClockReadModel` |
| `TimeControlService.getRemainingTime` |
| `PlayerPanel._formatRemainingTime` |

| `GamesStore.getGame` |
| --- |

| `TimeControlService.getRemainingTime` |
| --- |
| `TimeControlService._applyElapsedTime` |

- UI timing rule: render loops and timer callbacks are cadence only. They request authoritative remaining-time reads but do not mutate stored clock state directly.
- Requirement verification: `Pass`. Time reads stay authoritative without moving mutation logic into the view.

### SCN-TIME-02 - Pause and Resume Clocks

#### Flow A - Pause
| `GameControlPanel.pauseRequested` |
| --- |
| `GamesStore.pauseGame` |
| `GameClockComposable.pauseGame` |
| `GameClockComposable.pauseGame` |

| `GamesStore.pauseGame` |
| --- |
| `GameClockComposable.pauseGame` |
| `GameClockComposable.pauseGame` |
| `GameClockComposable.pauseGame` |

#### Flow B - Resume
| `GameControlPanel.resumeRequested` |
| --- |
| `GamesStore.resumeGame` |

| `GamesStore.resumeGame` |
| --- |
| `GameClockComposable.resumeGame` |
| `GameClockComposable.resumeGame` |

| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| --- |
| `GamePlayerTurnComposable.requestPlayerMove` |

- State coverage: manual and menu pause or resume are valid only for ongoing timed live-family states with an active clock. Timed `LiveWhiteTurn` and `LiveBlackTurn` pause into `PausedWhiteTurn` or `PausedBlackTurn`, while clocked live-analysis contexts pause into the matching `PausedLiveAnalysisFrom*` state. Analyse no longer acquires a pause reason, including in untimed games.
- Paused-surface rule: actual moves, Takeback and result actions stay blocked. Explicit Analyse entry, analysis moves/history and Exit remain available alongside Resume. Final real Resume alone flushes held actual output.
- Paused-exception rule: player reassignment and analysis-engine management remain allowed while paused because they are treated as configuration actions rather than gameplay actions.
- Deferred-engine rule: analysis searches may finish while paused and update rendered seat results, while any guarded player-engine move that resolves during pause is held as deferred output and committed without a second validation once play returns to a playable live state.
- Requirement verification: `Pass`. Double-pause and resume-after-finish are blocked centrally, and paused live play is interaction-locked apart from resume.

### SCN-TIME-03 - Increment Applied After Move

#### Flow
| `GamesStore.makeMove` |
| --- |
| `GameClockComposable.applyMove` |
| `TimeControlService.applyMove` |

| `TimeControlService.applyMove` |
| --- |
| `TimeControlService._applyIncrement` |
| `TimeControlService._switchActiveColour` |

- Requirement verification: `Pass`. Increment logic remains coupled to successful move commit rather than UI ticks.

### SCN-TIME-04 - Timeout Ends Game

#### Flow A - Register Focus-Return Clock Reconciliation
| `GameClockComposable.refreshRuntimeRegistrations` |
| --- |
| `PlatformEventService.subscribeToAppFocusReturned` |

#### Flow B - Reconcile The Clock
| `GameView.onClockTick` |
| --- |
| `GamesStore.syncClock` |
| `TimeControlService.getRemainingTime` |
| `TimeControlService.hasExpired` |
| `SavedGamesStore.saveGame` |
| `GameView._openTimeoutModalIfNeeded` |

| `GamesStore.syncClock` |
| --- |
| `GameClockComposable.syncClock` |
| `GameClockComposable.syncClock` |
| `GameClockComposable.syncClock` |

| `TimeControlService.getRemainingTime` |
| --- |

| `TimeControlService.hasExpired` |
| --- |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

| `GameView._openTimeoutModalIfNeeded` |
| --- |

- Timing rule: timeout finalisation is triggered from an authoritative clock read. View timer ticks and registered focus-return callbacks may request `syncClock`, but they do not decide timeout independently.
- Registration rule: focus-return registration exists only while the session is a runnable timed live game. Untimed, paused, finished, and non-live contexts do not keep that callback active.
- Requirement verification: `Pass`. Timeout finalisation stays in the store and cannot be duplicated by the view.

### SCN-TIME-05 - Menu Actions Auto-Pause Timed Games

#### Flow A - Leave The Board For A Menu Action
| `GameView._handleMenuInterruptionRequested` |
| --- |
| `GamesStore.pauseGame` |

| `GamesStore.pauseGame` |
| --- |
| `GameClockComposable.pauseGame` |
| `GameClockComposable.pauseGame` |

#### Flow B - Return From The Menu Action
| `GameView._handleMenuInterruptionCompleted` |
| --- |
| `GamesStore.resumeGame` |

| `GamesStore.resumeGame` |
| --- |
| `GameView._resumeIfMenuOwnedPause` |
| `GameClockComposable.resumeGame` |

- Settings coverage: `gameSession.autoPauseOnMenu` controls whether timed live games are paused for save, settings, and similar interrupting flows.
- Interruption rule: while the menu-owned pause is active, the game surface is inert and any guarded player-engine move that becomes ready remains deferred until the paired resume path commits it.
- Requirement verification: `Pass`. Auto-pause is gated by settings, active clock state, and pause ownership.

## Game Controls

### SCN-CTRL-01 - Takeback Action

#### Flow
| `GameControlPanel.takeBackRequested` |
| --- |
| `GamesStore.takeBack` |
| `MoveHistoryService.takeBack` |
| `GameView._refreshVisibleAnalysisAfterCommittedMove` |

| `GamesStore.takeBack` |
| --- |
| `GameStatusComposable.assertNotPausedForAction` |
| enforce `game.gameplayOptions.allowTakeback` for live games |
| `GameMoveComposable.getTakeBackMoveCount`: in local-versus-engine games, include the local player's last move and any engine reply; disable until the local player has moved |
| `GameMoveComposable.takeBack` |
| `GamePositionComposable.getLiveNode` |
| `GamePositionComposable.setRenderedPath` |
| `GamePositionComposable.setLivePath` |
| `GameClockComposable.startClock` from the retained node snapshot |
| `GameClockComposable.refreshRuntimeRegistrations` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| `GameAnalysisComposable.refreshAnalysisForGame` |

| `MoveHistoryService.takeBack` |
| --- |

- Requirement verification: `Pass`. Live-game takeback is policy-gated, rewinds from the authoritative live node to a live ancestor even while an analysis branch is rendered, and restarts that node's clock snapshot from the current timestamp.
- State gate: all genuine pauses block actual Takeback. Unpaused explicit analysis uses the actual live node/count and game permission; Takeback returns selection to the rewound actual node without creating an Analysis pause.
- Move ownership: local-versus-engine takeback removes the local player's last move together with any subsequent engine reply. During engine thinking it cancels the pending turn and removes only the local move. An engine's opening move alone cannot be taken back. Local/local play and standalone analysis rewind one ply; an explicit move count still selects that many plies.

### SCN-CTRL-02 - Resign Game

#### Flow
| `GameControlPanel.resignRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.resignGame` |
| `SavedGamesStore.saveGame` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.resignGame` |
| --- |
| `GameStatusComposable.resignGame` |
| `GameStatusComposable.assertNotPausedForAction` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- Requirement verification: `Pass`. Confirmation and final result persistence are both covered.
- State gate: paused live play and paused live-analysis block resignation until resume restores an interactive live state.

### SCN-CTRL-03 - Draw Offer Flow

#### Flow A - Local Versus Local Draw Offer
| `GameControlPanel.drawRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.offerDraw` |
| `UiStateStore.showModal` |
| `GamesStore.acceptDrawOffer` |
| `SavedGamesStore.saveGame` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.offerDraw` |
| --- |
| `GameStatusComposable.offerDraw` |
| `GameStatusComposable.assertNotPausedForAction` |

| `GamesStore.acceptDrawOffer` |
| --- |
| `GameStatusComposable.acceptDrawOffer` |
| `GameStatusComposable.assertNotPausedForAction` |

#### Flow B - Send A Draw Offer To A Non-Local Opponent
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.offerDraw` |
| `SavedGamesStore.saveGame` |

| `GamesStore.offerDraw` |
| --- |
| `GameStatusComposable.offerDraw` |
| `GameStatusComposable.assertNotPausedForAction` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

#### Flow C - Accept An Incoming Non-Local Offer
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.acceptDrawOffer` |
| `SavedGamesStore.saveGame` |

| `GamesStore.acceptDrawOffer` |
| --- |
| `GameStatusComposable.acceptDrawOffer` |
| `GameStatusComposable.assertNotPausedForAction` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

#### Flow D - Withdraw An Outgoing Non-Local Offer
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.withdrawDrawOffer` |
| `SavedGamesStore.saveGame` |

| `GamesStore.withdrawDrawOffer` |
| --- |
| `GameStatusComposable.withdrawDrawOffer` |
| `GameStatusComposable.assertNotPausedForAction` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- UI surface coverage: local-local resolution uses the shared dialog shell. Non-local opponents use the LED-like pending-offer indicator on `GameControlPanel`.
- State gate: paused live play and paused live-analysis block offer, accept, decline, and withdraw actions until resume; any pending-offer indicator is read-only while paused.
- Requirement verification: `Pass`. The baseline keeps local-local resolution explicit while letting engine-backed non-local participation define the same indicator-based model that a future adapter can reuse.

### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode

#### Flow A - Enter In-Game Analysis

`GameView input action -> playback.cancel -> GamesStore.enterInGameAnalysis -> GameMoveComposable.enterInGameAnalysis -> copy selected canonical position/path -> matching LiveAnalysisFrom/PausedLiveAnalysisFrom state -> publish selection`.

#### Flow B - Exit In-Game Analysis

`GameView input action -> playback.cancel -> GamesStore.exitInGameAnalysis -> _returnToLiveNode -> shared latest actual path/position -> paused/live/terminal state -> publish`.

- Entry starts at the selected move and preserves actual clock, pending turn, pause owners and held output. Repeated entry is a no-op. Ordinary review alone does not enable analysis input.
- Explicit analysis permits both colours to explore, including during genuine pauses. Only actual unpaused turns advance the live node; actual result actions and Takeback keep their independent restrictions.
- Exit/Live selection never resumes or flushes actual play. It preserves terminal results and genuine pauses. Analysis branches left behind by background progression remain history. Current-parent exploration is pruned only on the existing next actual move, unless it would delete selected descendants.
- The existing paused panel retains Resume; GameView composes the contextual Analyse/Exit action without changing component APIs.

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode

#### Flow A - Blocked Attempt
| `GameControlPanel.boardEditRequested` |
| --- |
| `GameBoardEditComposable.enterBoardEdit` |
| `UiStateStore.showModal` |

| `UiStateStore.showModal` |
| --- |

#### Flow B - Allowed Attempt
| `GameControlPanel.boardEditRequested` |
| --- |
| `GameBoardEditComposable.enterBoardEdit` |
| `GamesStore.enterBoardEdit` |

| `GamesStore.enterBoardEdit` |
| --- |
| `GameBoardEditComposable.enterBoardEdit` |

- UI surface coverage: the blocked action explanation uses the shared dialog shell and may offer dismiss-only handling or a future setup shortcut without mutating the live game context directly.
- Requirement verification: `Pass`. Board editing stays isolated to non-live analysis states without leaking the rule into components.

