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
| `GamesStore._assertMoveAllowed` |
| `GamesStore._resolveMoveContext` |
| `GamesStore._applyMoveByContext` |
| `GamesStore._updateClockAfterMove` |
| `GamesStore._commitLiveMove` |

| `GameRuleService.isMoveLegal` |
| --- |

| `GameRuleService.applyMove` |
| --- |

| `TimeControlService.applyMove` |
| --- |
| `TimeControlService._applyIncrement` |
| `TimeControlService._switchActiveColour` |

| `MoveUpdateService.addMainlineMove` |
| --- |

| `GameView._handleCommittedMoveResult` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.refreshAnalysis` |
| `GameView._requestPlayerMoveIfNeeded` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GamesStore._buildEnginePositionState` |
| `GamesStore._syncAnalysisPosition` |
| `GamesStore._registerAnalysisSubscription` |
| `GamesStore._startAnalysisSearch` |

| `GamesStore._syncAnalysisPosition` |
| --- |
| `EngineRuntimeService.syncPosition` |

| `GamesStore._registerAnalysisSubscription` |
| --- |
| `EngineRuntimeService.subscribeToAnalysis` |

| `GamesStore._startAnalysisSearch` |
| --- |
| `EngineRuntimeService.startAnalysis` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GamesStore._applyAnalysisUpdate` |

| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.requestPlayerMove` |

#### Flow B - Analysis-Only Move
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `GameView._refreshVisibleAnalysisAfterCommittedMove` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._resolveMoveContext` |
| `GamesStore._applyMoveByContext` |
| `GamesStore._commitAnalysisMove` |

| `GameRuleService.isMoveLegal` |
| --- |

| `GameRuleService.applyMove` |
| --- |

| `MoveUpdateService.addAnalysisMove` |
| --- |

| `GameView._refreshVisibleAnalysisAfterCommittedMove` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.refreshAnalysis` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GamesStore._buildEnginePositionState` |
| `GamesStore._syncAnalysisPosition` |
| `GamesStore._registerAnalysisSubscription` |
| `GamesStore._startAnalysisSearch` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GamesStore._applyAnalysisUpdate` |

- State/settings coverage: `makeMove` dispatches by `gameState`. `LiveWhiteTurn` and `LiveBlackTurn` commit live moves and may trigger a player-engine reply. `AnalysisWhiteMove`, `AnalysisBlackMove`, and `LiveAnalysisFrom*` stay analysis-only. `BoardEdit`, paused live states, and `Checkmate` block live move progression.
- Continuous analysis update loop: `GamesStore._buildEnginePositionState` -> `GamesStore._syncAnalysisPosition` -> `EngineRuntimeService.syncPosition` -> `GamesStore._registerAnalysisSubscription` -> `EngineRuntimeService.subscribeToAnalysis` -> `GamesStore._startAnalysisSearch` -> `EngineRuntimeService.startAnalysis` -> `GameView._handleAnalysisRuntimeUpdate` -> `GamesStore._applyAnalysisUpdate` -> `AnalysisPanel` rerender for the affected engine row.
- Runtime ownership detail: see [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for the lower-layer mutation sequence behind `syncPosition`, `subscribeToAnalysis`, `startAnalysis`, and streamed runtime updates.
- Requirement verification: `Pass`. The move commits once and fans out to history, clocks, and analysis from one store boundary.

### SCN-MOVE-02 - Illegal Move Attempt

#### Flow
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `GameRuleService.isMoveLegal` |
| `GamesStore._refreshLegalTargets` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._rejectIllegalMove` |
| `GamesStore._refreshLegalTargets` |

| `GameRuleService.isMoveLegal` |
| --- |

- Requirement verification: `Pass`. Rejection happens before tree, clock, or persistence mutation.

### SCN-MOVE-03 - Pawn Promotion Resolution

#### Flow A - Build The Promotion Move Before Submission
| `Chessboard.moveAttempt` |
| --- |
| `UiStateStore.showModal` |
| `Chessboard._completePromotionMove` |
| `GamesStore.makeMove` |
| `GameView._handleCommittedMoveResult` |

| `UiStateStore.showModal` |
| --- |

| `Chessboard._completePromotionMove` |
| --- |
| `GameRuleService.isMoveLegal` |

#### Flow B - Cancel Promotion Before Submission
| `PromotionModal.cancelled` |
| --- |
| `UiStateStore.showModal` |
| `UiStateStore.hideModal` |

| `UiStateStore.hideModal` |
| --- |

- UI surface coverage: promotion uses the shared `PiecePalette` surface, hosted either as a board-local overlay or inside the shared dialog shell, and stays local to the current move attempt.
- Settings coverage: baseline `gameplay.promotionPolicy` is `requireExplicitSelection` only, so promotion stays blocked until an explicit piece choice is received.
- Process note: once the selected piece is merged into the move, `GamesStore.makeMove` simply follows the same context-specific commit path as `SCN-MOVE-01`. There is no pending-promotion state on the game model.
- Requirement verification: `Pass`. Promotion remains explicit without introducing a special pending-move game state.

## Engine-Controlled Turn

### Live Non-Local Player Move Generation

#### Flow A - Successful Player Engine Turn
| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| GamesStore.getGame |
| GamesStore.requestPlayerMove |
| GamesStore.makeMove |

| GamesStore.requestPlayerMove |
| --- |
| GamesStore._buildEnginePositionState |
| GamesStore._syncPlayerTurnPosition |
| GamesStore._startPlayerTurnSearch |
| GamesStore._awaitPlayerTurnMove |

| GamesStore._syncPlayerTurnPosition |
| --- |
| EngineRuntimeService.syncPosition |

| GamesStore._startPlayerTurnSearch |
| --- |
| EngineRuntimeService.startPlayerTurn |

| GamesStore._awaitPlayerTurnMove |
| --- |
| EngineRuntimeService.awaitPlayerTurnMove |

| GamesStore.makeMove |
| --- |
| GamesStore._assertMoveAllowed |
| GamesStore._resolveMoveContext |
| GamesStore._applyMoveByContext |

#### Flow B - Unexpected Exit During Player Turn
| `GamesStore._pollPlayerSessionHealth` |
| --- |
| `GamesStore._markPlayerNonActive` |
| `GamesStore.pauseGame` |
| `GameView._openRuntimeErrorDialog` |

#### Flow C - Player Turn Completes While Paused
| `GamesStore._awaitPlayerTurnMove` |
| --- |
| `GamesStore._storeDeferredPlayerMove` |

| `GamesStore._storeDeferredPlayerMove` |
| --- |
| `GamesStore._captureDeferredPlayerMoveContext` |

- Runtime distinction: analysis search keeps streaming updates over time, while a player-engine turn waits only for the final awaited move and then ends that turn-scoped search.
- State gate: `GamesStore.requestPlayerMove` is valid only for `LiveWhiteTurn` or `LiveBlackTurn` with `resultState = ongoing` when the side to move is assigned to an active non-local player.
- Guardrails: player-engine turn generation is blocked in non-live analysis, live analysis, board edit, paused live games, and `Checkmate`.
- Paused completion rule: if an already-started player-engine turn resolves while the game is paused, the result is recorded as deferred output only. `GamesStore.makeMove(...)` is not called until resume clears the paused state and the deferred result is revalidated against the live position and side to move.
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
| `GamesStore._assertPlayerReassignmentAllowed` |
| `GamesStore._captureVisibleSetupAnchor` |
| `GamesStore._applyPlayerReassignment` |

| `GameView._refreshRuntimeAfterPlayerReassignment` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.refreshAnalysis` |
| `GameView._requestPlayerMoveIfNeeded` |

- State coverage: player reassignment is valid in live states, paused live states, live-analysis states, and non-live analysis states for the baseline `PlayerType.Local` or `PlayerType.Engine` seat model.
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
| `GamesStore._setHighlightPathFromNode` |
| `GamesStore._deriveGameState` |

| `GameView._refreshVisibleAnalysisAfterNavigation` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.refreshAnalysis` |
| `GamesStore.getVisibleAnalysis` |

- Runtime selector coverage: `HistoryPanel.nodeSelected` carries a hydrated `IMoveNode` from the current tree. `GamesStore.navigateToNode` validates that node against the current root before deriving persisted selector bookkeeping, and ignores stale nodes by refreshing from current store state.
- State coverage: entering an earlier node moves the game into the matching live-analysis or non-live analysis state and suppresses `GameView._requestPlayerMoveIfNeeded`; returning to the live node restores the matching live or paused live state. Paused live games block history navigation until resume.
- Requirement verification: `Pass`. Board, history, and analysis bind to the same visible node.

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)

#### Flow
| `Chessboard.moveSubmittedFromHistory` |
| --- |
| `GamesStore.makeMove` |
| `UserSettingService.getSettings` |
| `TimeControlService.applyMove` |
| `MoveUpdateService.addMainlineMove` |
| `MoveUpdateService.rewriteMainline` |
| `GameView._requestPlayerMoveIfNeeded` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applyHistoryRewritePolicy` |
| `GamesStore._confirmMainlineRewriteIfNeeded` |
| `GamesStore._updateClockAfterMove` |
| `GamesStore._promoteNewContinuation` |
| `GamesStore._restoreCurrentPositionAfterRewrite` |

| `UserSettingService.getSettings` |
| --- |

| `TimeControlService.applyMove` |
| --- |
| `TimeControlService._applyIncrement` |
| `TimeControlService._switchActiveColour` |

| `MoveUpdateService.addMainlineMove` |
| --- |

| `MoveUpdateService.rewriteMainline` |
| --- |

- Settings coverage: `gameplay.takebackPolicy = rewriteMainline` routes this flow into live mainline mutation. `gameplay.confirmMainlineRewrite` decides whether `_confirmMainlineRewriteIfNeeded` is a no-op or a blocking prompt.
- Requirement verification: `Pass`. The public surface can keep the old future as a variation while promoting the new continuation.

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)

#### Flow A - Stay On The Analysis Branch
| `Chessboard.moveSubmittedFromHistory` |
| --- |
| `GamesStore.makeMove` |
| `UserSettingService.getSettings` |
| `MoveUpdateService.addAnalysisMove` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applyAnalysisOnlyHistoryPolicy` |
| `GamesStore._handleAnalysisBranchExitBehaviour` |

| `UserSettingService.getSettings` |
| --- |

| `MoveUpdateService.addAnalysisMove` |
| --- |

#### Flow B - Return To The Live Node After The Analysis Move
| `Chessboard.moveSubmittedFromHistory` |
| --- |
| `GamesStore.makeMove` |
| `UserSettingService.getSettings` |
| `MoveUpdateService.addAnalysisMove` |
| `GamesStore.navigateToNode` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._applyAnalysisOnlyHistoryPolicy` |
| `GamesStore._handleAnalysisBranchExitBehaviour` |
| `GamesStore._restoreLiveNodeAfterAnalysisBranch` |

| `UserSettingService.getSettings` |
| --- |

| `MoveUpdateService.addAnalysisMove` |
| --- |

| `GamesStore.navigateToNode` |
| --- |

- Settings coverage: `gameplay.takebackPolicy = TakebackPolicy.AnalysisOnly` keeps the live node unchanged. `gameplay.analysisBranchExitBehaviour` decides whether the game returns to the live node immediately or stays on the analysis branch.
- Requirement verification: `Pass`. Analysis-only continuation does not mutate the live node.

### SCN-HIST-04 - Automatic Pruning After Live Move From The Latest Node

#### Flow
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `MoveUpdateService.pruneFutureMoves` |
| `TimeControlService.applyMove` |
| `MoveUpdateService.addMainlineMove` |
| `GameView._requestPlayerMoveIfNeeded` |
| `SavedGamesStore.saveGame` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._pruneLatestAnalysisContinuationIfNeeded` |
| `GamesStore._updateClockAfterMove` |
| `GamesStore._commitCurrentPositionMove` |
| `GamesStore._reconcileLiveAndVisibleNodes` |

| `MoveUpdateService.pruneFutureMoves` |
| --- |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- UI surface coverage: there is no user-facing prune action or confirmation dialog in the baseline. The pruning action is automatic and is triggered by the next real live move from the same latest node after in-game analysis exit.
- Runtime selector coverage: `GamesStore` compares the current live move against the stored in-game-analysis entry anchor and runs the automatic pruning action through `MoveUpdateService.pruneFutureMoves` only when live play resumes from that same latest node. After pruning and move commit, the store reacquires the surviving live and visible nodes from the new tree.
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
| `GamesStore._pauseClock` |
| `GamesStore._markPauseOwner` |

| `GamesStore.pauseGame` |
| --- |
| `GamesStore._assertPausable` |
| `GamesStore._pauseClock` |
| `GamesStore._markPauseOwner` |

#### Flow B - Resume
| `GameControlPanel.resumeRequested` |
| --- |
| `GamesStore.resumeGame` |
| `GameView._requestPlayerMoveIfNeeded` |

| `GamesStore.resumeGame` |
| --- |
| `GamesStore._assertResumable` |
| `GamesStore._resumeClock` |

| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.requestPlayerMove` |

- State coverage: pause and resume are valid only for timed `LiveWhiteTurn` or `LiveBlackTurn` states with `resultState = ongoing`.
- Paused-surface rule: once paused, the game surface blocks history navigation, move entry, takeback, draw, resign, in-game-analysis entry, and board edit until resume.
- Paused-exception rule: player reassignment and analysis-engine management remain allowed while paused because they are treated as configuration actions rather than gameplay actions.
- Deferred-engine rule: analysis searches may finish while paused and update read-only snapshots, while any player-engine move that resolves during pause is held as deferred output and revalidated on resume before commit.
- Requirement verification: `Pass`. Double-pause and resume-after-finish are blocked centrally, and paused live play is interaction-locked apart from resume.

### SCN-TIME-03 - Increment Applied After Move

#### Flow
| `GamesStore.makeMove` |
| --- |
| `GamesStore._updateClockAfterMove` |
| `TimeControlService.applyMove` |

| `TimeControlService.applyMove` |
| --- |
| `TimeControlService._applyIncrement` |
| `TimeControlService._switchActiveColour` |

- Requirement verification: `Pass`. Increment logic remains coupled to successful move commit rather than UI ticks.

### SCN-TIME-04 - Timeout Ends Game

#### Flow A - Register Focus-Return Clock Reconciliation
| `GamesStore._registerRunnableSessionSubscriptions` |
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
| `GamesStore._reconcileClock` |
| `GamesStore._finaliseTimeoutIfNeeded` |
| `GamesStore._lockLiveMoves` |

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
| `GamesStore._maybeAutoPauseForMenu` |
| `GamesStore._rememberPauseOwner` |

#### Flow B - Return From The Menu Action
| `GameView._handleMenuInterruptionCompleted` |
| --- |
| `GamesStore.resumeGame` |

| `GamesStore.resumeGame` |
| --- |
| `GameView._resumeIfMenuOwnedPause` |
| `GamesStore._resumeClock` |

- Settings coverage: `gameSession.autoPauseOnMenu` controls whether timed live games are paused for save, settings, and similar interrupting flows.
- Interruption rule: while the menu-owned pause is active, the game surface is inert and any player-engine move that becomes ready remains deferred until the paired resume path revalidates it.
- Requirement verification: `Pass`. Auto-pause is gated by settings, active clock state, and pause ownership.

## Game Controls

### SCN-CTRL-01 - Takeback Action

#### Flow
| `GameControlPanel.takeBackRequested` |
| --- |
| `GamesStore.takeBack` |
| `MoveUpdateService.takeBack` |
| `GameView._refreshVisibleAnalysisAfterCommittedMove` |

| `GamesStore.takeBack` |
| --- |
| `GamesStore._assertTakeBackAllowed` |
| `GamesStore._rewindVisibleAndLiveNodes` |
| `GamesStore._rebuildClockFromHistory` |

| `MoveUpdateService.takeBack` |
| --- |

- Requirement verification: `Pass`. Takeback policy and clock recomputation remain inside one mutation boundary.
- State gate: paused live play blocks takeback through the same paused-state assertion boundary used by other game-surface mutations.

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
| `GamesStore._assertResultMutable` |
| `GamesStore._finaliseResult` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- Requirement verification: `Pass`. Confirmation and final result persistence are both covered.
- State gate: paused live play blocks resignation until resume restores an interactive live state.

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
| `GamesStore._assertResultMutable` |
| `GamesStore._captureDrawOfferContext` |
| `GameView._openDrawResolveDialog` |

| `GamesStore.acceptDrawOffer` |
| --- |
| `GamesStore._acceptDrawOffer` |
| `GamesStore._finaliseResult` |

#### Flow B - Send A Draw Offer To A Non-Local Opponent
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.offerDraw` |
| `GamesStore._setDrawOfferState` |
| `SavedGamesStore.saveGame` |

| `GamesStore.offerDraw` |
| --- |
| `GamesStore._assertResultMutable` |
| `GamesStore._setDrawOfferState` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

#### Flow C - Accept An Incoming Non-Local Offer
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.acceptDrawOffer` |
| `GamesStore._finaliseResult` |
| `GamesStore._clearDrawOfferStateIfNeeded` |
| `SavedGamesStore.saveGame` |

| `GamesStore.acceptDrawOffer` |
| --- |
| `GamesStore._acceptDrawOffer` |
| `GamesStore._finaliseResult` |
| `GamesStore._clearDrawOfferStateIfNeeded` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

#### Flow D - Withdraw An Outgoing Non-Local Offer
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.withdrawDrawOffer` |
| `GamesStore._clearDrawOfferStateIfNeeded` |
| `SavedGamesStore.saveGame` |

| `GamesStore.withdrawDrawOffer` |
| --- |
| `GamesStore._withdrawNonLocalDrawOffer` |
| `GamesStore._clearDrawOfferStateIfNeeded` |

| `SavedGamesStore.saveGame` |
| --- |
| `SavedGameIndexService.getAutosaveFilePath` |
| `SerializationService.writeGameDocument` |

- UI surface coverage: local-local resolution uses the shared dialog shell. Non-local opponents use the LED-like pending-offer indicator on `GameControlPanel`.
- State gate: paused live play blocks offer, accept, decline, and withdraw actions until resume; any pending-offer indicator is read-only while paused.
- Requirement verification: `Pass`. The baseline keeps local-local resolution explicit while letting engine-backed non-local participation define the same indicator-based model that a future adapter can reuse.

### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode

#### Flow A - Enter In-Game Analysis
| `GameControlPanel.analysisRequested` |
| --- |
| `GamesStore.enterInGameAnalysis` |
| `GamesStore._pauseForAnalysisEntry` |
| `GamesStore._cloneAnalysisContext` |

| `GamesStore.enterInGameAnalysis` |
| --- |
| `GamesStore._assertInGameAnalysisAllowed` |
| `GamesStore._pauseForAnalysisEntry` |
| `GamesStore._cloneAnalysisContext` |

#### Flow B - Exit In-Game Analysis
| `GameControlPanel.analysisExitRequested` |
| --- |
| `GamesStore.exitInGameAnalysis` |
| `GamesStore._restoreLiveNode` |
| `GamesStore._resumeAfterAnalysisIfOwned` |

| `GamesStore.exitInGameAnalysis` |
| --- |
| `GamesStore._restoreLiveNode` |
| `GamesStore._resumeAfterAnalysisIfOwned` |

- State coverage: in-game analysis is available for ongoing live games and may also be entered after timeout while preserving the stored final result. Paused live games must resume before analysis entry is allowed. Exiting the mode is prompt-free and restores the live node immediately; if analysis began from the latest live node, any exploratory continuation may remain visible as a variation until `SCN-HIST-04` cleanup is triggered by the next real live move from that node.
- Requirement verification: `Pass`. Analysis mode gives both-colour move control without mutating the live line.

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode

#### Flow A - Blocked Attempt
| `GameControlPanel.boardEditRequested` |
| --- |
| `GamesStore._assertBoardEditAllowed` |
| `UiStateStore.showModal` |

| `UiStateStore.showModal` |
| --- |

#### Flow B - Allowed Attempt
| `GameControlPanel.boardEditRequested` |
| --- |
| `GamesStore._assertBoardEditAllowed` |
| `GamesStore.enterBoardEdit` |

| `GamesStore.enterBoardEdit` |
| --- |
| `GamesStore._enterBoardEditContext` |

- UI surface coverage: the blocked action explanation uses the shared dialog shell and may offer dismiss-only handling or a future setup shortcut without mutating the live game context directly.
- Requirement verification: `Pass`. Board editing stays isolated to non-live analysis states without leaking the rule into components.

