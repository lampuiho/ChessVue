# Gameplay And Control Flows

## Scope
This document covers `SCN-MOVE-01` to `SCN-CTRL-05` and `SCN-ENGINE-03`.

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
| `GamesStore._persistWorkspaceIfNeeded` |

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
| `EnginesStore.startAnalysis` |
| `GameView._requestEngineTurnIfNeeded` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

| `GameView._requestEngineTurnIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startPlayerTurn` |

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
| `GamesStore._persistWorkspaceIfNeeded` |

| `GameRuleService.isMoveLegal` |
| --- |

| `GameRuleService.applyMove` |
| --- |

| `MoveUpdateService.addAnalysisMove` |
| --- |

| `GameView._refreshVisibleAnalysisAfterCommittedMove` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startAnalysis` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

- State/settings coverage: `makeMove` accepts `WorkspaceKind.LiveGame` and `WorkspaceKind.FreeAnalysisSetup`, but dispatches by context. `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition + ResultState.Ongoing + not paused` commits a live move and may trigger a player-engine reply. `WorkspaceKind.FreeAnalysisSetup`, `InteractionContext.HistoryReview`, and `InteractionContext.InGameAnalysis` stay analysis-only. `InteractionContext.BoardEdit`, paused live play, and final result states block live move progression.
- Continuous analysis update loop: the layer-2 engine runtime path -> `GameView._handleAnalysisRuntimeUpdate` -> `AnalysisStore.applyAnalysisUpdate` -> `AnalysisPanel` rerender for the affected engine row.
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

#### Flow A - Require An Explicit Promotion Choice
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.makeMove` |
| `GameView._handleMakeMoveResult` |
| `UiStateStore.showModal` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._stagePendingPromotion` |

| `GameView._handleMakeMoveResult` |
| --- |

| `UiStateStore.showModal` |
| --- |

#### Flow B - Commit The Selected Promotion Piece
| `PromotionModal.pieceSelected` |
| --- |
| `GamesStore.makeMove` |
| `GameView._handleCommittedMoveResult` |
| `UiStateStore.hideModal` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._commitPromotionMove` |
| `GamesStore._clearPendingPromotion` |

| `UiStateStore.hideModal` |
| --- |

- UI surface coverage: promotion uses the shared `PiecePalette` surface, hosted either as a board-local overlay or inside the shared dialog shell, and stays local to the current move attempt.
- Settings coverage: baseline `gameplay.promotionPolicy` is `requireExplicitSelection` only, so promotion stays blocked until an explicit piece choice is received.
- Process note: once the selected piece is merged into the move, `GamesStore.makeMove` rejoins the same context-specific commit path as `SCN-MOVE-01`. Live current-position moves call `TimeControlService.applyMove` before `MoveUpdateService.addMainlineMove`, while analysis contexts call `MoveUpdateService.addAnalysisMove`.
- Requirement verification: `Pass`. Promotion remains an explicit store-owned mutation instead of a UI-side special case.

## Engine-Controlled Turn

### Live Engine Player Move Generation

#### Flow
| `GameView._requestEngineTurnIfNeeded` |
| --- |
| GamesStore.getGame |
| EnginesStore.startPlayerTurn |
| EnginesStore._handlePlayerTurnMove |

| EnginesStore.startPlayerTurn |
| --- |
| EnginesStore._startPlayerTurnSearch |
| EnginesStore._bindPlayerTurnCallbacks |

| EnginesStore._handlePlayerTurnMove |
| --- |
| GamesStore.makeMove |
| GameView._handleCommittedMoveResult |

| GamesStore.makeMove |
| --- |
| GamesStore._assertMoveAllowed |
| GamesStore._resolveMoveContext |
| GamesStore._applyMoveByContext |

- Runtime distinction: analysis search keeps streaming updates inside `EnginesStore`, while a player-engine turn waits only for the final move callback and then ends that turn-scoped search.
- State gate: `EnginesStore.startPlayerTurn` is valid only for `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition + ResultState.Ongoing + not paused` when the side to move is assigned to an engine.
- Guardrails: player-engine turn generation is blocked in free analysis/setup, in-game analysis, history review, board edit, paused live games, and finished games.

### SCN-ENGINE-03 - Change Player Assignment During Game

#### Flow
| `PlayerPanel.playerSelectionConfirmed` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.reassignPlayer` |
| `EnginesStore.stopEngine` |
| `GameView._refreshRuntimeAfterPlayerReassignment` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.reassignPlayer` |
| --- |
| `GamesStore._assertPlayerReassignmentAllowed` |
| `GamesStore._captureVisibleSetupAnchor` |
| `GamesStore._applyPlayerReassignment` |
| `GamesStore._persistWorkspaceIfNeeded` |

| `EnginesStore.stopEngine` |
| --- |

| `GameView._refreshRuntimeAfterPlayerReassignment` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startAnalysis` |
| `GameView._requestEngineTurnIfNeeded` |

- State coverage: player reassignment is valid for `WorkspaceKind.LiveGame` and `WorkspaceKind.FreeAnalysisSetup` workspaces in `InteractionContext.CurrentPosition`, `InteractionContext.HistoryReview`, and `InteractionContext.InGameAnalysis` for the baseline `PlayerType.Local` or `PlayerType.Engine` seat model.
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
| `GamesStore._setVisiblePathFromNode` |
| `GamesStore._deriveInteractionContext` |

| `GameView._refreshVisibleAnalysisAfterNavigation` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startAnalysis` |
| `AnalysisStore.getVisibleAnalysis` |

- State coverage: entering an earlier node moves the workspace into `InteractionContext.HistoryReview` and suppresses `GameView._requestEngineTurnIfNeeded`; returning to the live node restores `InteractionContext.CurrentPosition`.
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
| `GameView._requestEngineTurnIfNeeded` |

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

- Settings coverage: `gameplay.takebackPolicy = TakebackPolicy.AnalysisOnly` keeps the live node unchanged. `gameplay.analysisBranchExitBehaviour` decides whether the workspace returns to `InteractionContext.CurrentPosition` immediately or stays on the analysis branch.
- Requirement verification: `Pass`. Analysis-only continuation does not mutate the live node.

### SCN-HIST-04 - Prune Future Moves from Selected Node

#### Flow
| `HistoryPanel.pruneRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.pruneFuture` |
| `MoveUpdateService.pruneFutureMoves` |
| `GamesStore.saveGame` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.pruneFuture` |
| --- |
| `GamesStore._confirmPruneIfNeeded` |
| `GamesStore._assertRootPruneAllowed` |
| `GamesStore._pruneTreeFromNode` |
| `GamesStore._reconcileLiveAndVisibleNodes` |

| `MoveUpdateService.pruneFutureMoves` |
| --- |

| `GamesStore.saveGame` |
| --- |
| `GamesStore._buildPersistedWorkspace` |
| `GamesStore._persistWorkspace` |

- UI surface coverage: prune confirmation uses the shared dialog shell with a danger-focused confirmation row before irreversible mutation is allowed through.
- Runtime selector coverage: the selected history node reaches this flow as a hydrated `IMoveNode`; `GamesStore` derives any persisted path bookkeeping internally before and after the prune mutation.
- Settings coverage: `gameplay.confirmPruneFutureMoves` decides whether the prune confirmation modal is required. `gameplay.allowRootPrune` decides whether pruning from the root node is allowed or rejected before mutation.
- Requirement verification: `Pass`. Root-prune policy and irreversible confirmation both sit behind the store boundary.

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
| `GameView._requestEngineTurnIfNeeded` |

| `GamesStore.resumeGame` |
| --- |
| `GamesStore._assertResumable` |
| `GamesStore._resumeClock` |

| `GameView._requestEngineTurnIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startPlayerTurn` |

- State coverage: pause and resume are valid only for timed `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition + ResultState.Ongoing` states.
- Requirement verification: `Pass`. Double-pause and resume-after-finish are blocked centrally.

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
| `GamesStore.saveGame` |
| `GameView._openTimeoutModalIfNeeded` |

| `GamesStore.syncClock` |
| --- |
| `GamesStore._reconcileClock` |
| `GamesStore._finaliseTimeoutIfNeeded` |
| `GamesStore._lockLiveMoves` |
| `GamesStore._persistWorkspace` |

| `TimeControlService.getRemainingTime` |
| --- |

| `TimeControlService.hasExpired` |
| --- |

| `GamesStore.saveGame` |
| --- |
| `GamesStore._buildPersistedWorkspace` |

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

- Settings coverage: `session.autoPauseOnMenu` controls whether timed live games are paused for save, settings, and similar interrupting flows.
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

### SCN-CTRL-02 - Resign Game

#### Flow
| `GameControlPanel.resignRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.resignGame` |
| `GamesStore.saveGame` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.resignGame` |
| --- |
| `GamesStore._assertResultMutable` |
| `GamesStore._finaliseResult` |
| `GamesStore._persistWorkspace` |

| `GamesStore.saveGame` |
| --- |
| `GamesStore._buildPersistedWorkspace` |
| `GamesStore._persistWorkspace` |

- Requirement verification: `Pass`. Confirmation and final result persistence are both covered.

### SCN-CTRL-03 - Draw Offer Flow

#### Flow A - Local Versus Local Draw Offer
| `GameControlPanel.drawRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.offerDraw` |
| `UiStateStore.showModal` |
| `GamesStore.acceptDrawOffer` |
| `GamesStore.saveGame` |

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
| `GamesStore.saveGame` |

| `GamesStore.offerDraw` |
| --- |
| `GamesStore._assertResultMutable` |
| `GamesStore._setDrawOfferState` |

| `GamesStore.saveGame` |
| --- |
| `GamesStore._buildPersistedWorkspace` |

#### Flow C - Accept An Incoming Non-Local Offer
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.acceptDrawOffer` |
| `GamesStore._finaliseResult` |
| `GamesStore._clearDrawOfferStateIfNeeded` |
| `GamesStore.saveGame` |

| `GamesStore.acceptDrawOffer` |
| --- |
| `GamesStore._acceptDrawOffer` |
| `GamesStore._finaliseResult` |
| `GamesStore._clearDrawOfferStateIfNeeded` |

| `GamesStore.saveGame` |
| --- |
| `GamesStore._buildPersistedWorkspace` |

#### Flow D - Withdraw An Outgoing Non-Local Offer
| `GameControlPanel.drawRequested` |
| --- |
| `GamesStore.withdrawDrawOffer` |
| `GamesStore._clearDrawOfferStateIfNeeded` |
| `GamesStore.saveGame` |

| `GamesStore.withdrawDrawOffer` |
| --- |
| `GamesStore._withdrawNonLocalDrawOffer` |
| `GamesStore._clearDrawOfferStateIfNeeded` |

| `GamesStore.saveGame` |
| --- |
| `GamesStore._buildPersistedWorkspace` |

- UI surface coverage: local-local resolution uses the shared dialog shell. Non-local opponents use the LED-like pending-offer indicator on `GameControlPanel`.
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
| `UiStateStore.showModal` |
| `GamesStore._resumeAfterAnalysisIfOwned` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.exitInGameAnalysis` |
| --- |
| `GamesStore._promptForDirtyAnalysisExitIfNeeded` |
| `GamesStore._restoreLiveNode` |
| `GamesStore._resumeAfterAnalysisIfOwned` |

- State coverage: in-game analysis is available for ongoing live games and may also be entered after timeout while preserving the stored final result.
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
| `GamesStore._snapshotPreEditState` |

- UI surface coverage: the blocked action explanation uses the shared dialog shell and may offer dismiss-only handling or a future setup shortcut without mutating the live game context directly.
- Requirement verification: `Pass`. Board editing stays isolated to `WorkspaceKind.FreeAnalysisSetup` without leaking the rule into components.

