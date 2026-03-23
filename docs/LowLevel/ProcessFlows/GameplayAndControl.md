# Gameplay And Control Flows

## Scope
This document covers `SCN-MOVE-01` to `SCN-CTRL-05` and `SCN-ENGINE-03`.

## Move Execution

### SCN-MOVE-01 - Legal Move on Board
- Public flow: `GamesStore.makeMove` -> `GameRuleService.isMoveLegal` -> context dispatch to `GameRuleService.applyMove` and `MoveUpdateService` -> `TimeControlService.applyMove` when live clocks apply -> `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn`.
- Private design: `GamesStore._assertMoveAllowed` -> `_resolveMoveContext` -> `_applyMoveByContext` -> `_commitLiveMove` or `_commitAnalysisMove` -> `_updateClockAfterMove` -> `_refreshVisibleAnalysis` -> `_persistWorkspaceIfNeeded` -> `_maybeRequestEngineTurn`.
- State/settings coverage: `makeMove` accepts `liveGame` and `freeAnalysisSetup`, but dispatches by context. `liveGame + currentPosition + ongoing + not paused` commits a live move and may trigger a player-engine reply. `historyReview` routes through takeback-policy handling. `inGameAnalysis` and `freeAnalysisSetup` create analysis-only continuations and never trigger a live engine turn. `boardEdit`, paused live play, and final result states block live move progression.
- Continuous analysis update loop: `EngineClient.subscribeToAnalysis` -> `EnginesStore._forwardAnalysisUpdate` -> `AnalysisStore.applyAnalysisUpdate` -> `AnalysisStore.getVisibleAnalysis` -> `AnalysisPanel` rerender for the affected engine row.
- Requirement verification: `Pass`. The move commits once and fans out to history, clocks, and analysis from one store boundary.

### SCN-MOVE-02 - Illegal Move Attempt
- Public flow: `GamesStore.makeMove` -> `GameRuleService.isMoveLegal`.
- Private design: `GamesStore._assertMoveAllowed` -> `_rejectIllegalMove` -> `_refreshLegalTargets`.
- Requirement verification: `Pass`. Rejection happens before tree, clock, or persistence mutation.

### SCN-MOVE-03 - Pawn Promotion Resolution
- Public flow: `GamesStore.makeMove` -> `GameRuleService.requiresPromotionSelection` -> `UiStateStore.showModal({ kind: "promotion" })` -> `GamesStore.makeMove` with the selected promotion piece.
- Private design: `GamesStore._stagePendingPromotion` -> `_commitPromotionMove` -> `_clearPendingPromotion`; cancel uses `UiStateStore.hideModal`.
- UI surface coverage: promotion uses the shared `PiecePalette` surface, hosted either as a board-local overlay or inside the shared dialog shell, and stays local to the current move attempt.
- Settings coverage: baseline `gameplay.promotionPolicy` is `requireExplicitSelection` only, so promotion stays blocked until an explicit piece choice is received. No implicit timeout or default-queen branch is part of the committed flow.
- Requirement verification: `Pass`. Promotion remains an explicit store-owned mutation instead of a UI-side special case.

## Engine-Controlled Turn

### Live Engine Player Move Generation
- Public flow: `GamesStore.createGame`, `GamesStore.startGameFromSetup`, `GamesStore.makeMove`, `GamesStore.resumeGame`, `GamesStore.navigateToNode` returning to the live node, or `GamesStore.importGame` restore completion -> `GamesStore._maybeRequestEngineTurn` -> `EnginesStore.startPlayerTurn` -> `EngineClient.startSession` -> `EngineClient.syncPosition` -> `EngineClient.startAnalysis` -> final move callback -> `GamesStore.makeMove`.
- Private design: `GamesStore._maybeRequestEngineTurn` -> `_isEngineTurnPlayable` -> `EnginesStore._startPlayerTurnSearch` -> `_bindPlayerTurnCallbacks`; on the final callback `GamesStore` validates and commits the move through the normal mutation path.
- Runtime distinction: analysis search keeps streaming updates into `AnalysisStore`, while a player-engine turn waits only for the final move callback and then ends that turn-scoped search.
- State gate: `EnginesStore.startPlayerTurn` is valid only for `liveGame + currentPosition + ongoing + not paused` when the side to move is assigned to an engine. It is a strict no-op-or-reject boundary for `freeAnalysisSetup`, `historyReview`, `inGameAnalysis`, `boardEdit`, paused live games, expired clocks, and all final result states.
- Guardrails: player-engine turn generation is blocked in free analysis/setup, in-game analysis, history review, board edit, paused live games, and finished games. The same side-to-move gate is reused for `local/engine`, `engine/local`, and `engine/engine`.

### SCN-ENGINE-03 - Change Player Assignment During Game
- Public flow: `PlayerPanel.playerSelectionRequested` -> `UiStateStore.showModal({ kind: "playerSelection" })` -> `GamesStore.reassignPlayer` -> conditional `GamesStore._maybeRequestEngineTurn`.
- Private design: `GamesStore._assertPlayerReassignmentAllowed` -> `_captureVisibleSetupAnchor` -> `_applyPlayerReassignment` -> conditional `EnginesStore.stopEngine(gameId, previousEngineId, "player")` -> `_clearPendingTurnRequestIfNeeded` -> conditional `_switchWorkspaceToFreeAnalysisSetup` -> `_clearLiveResultAndClockStateForSetup` -> `_persistWorkspaceIfNeeded` -> conditional `_maybeRequestEngineTurn`.
- State coverage: player reassignment is valid for `liveGame` and `freeAnalysisSetup` workspaces in `currentPosition`, `historyReview`, and `inGameAnalysis`, except that future remote-player seats would remain disabled. If a live game reassignment leaves either side unassigned, the workspace converts to `freeAnalysisSetup` from the currently visible position and branch context while preserving the visible board and move tree. If reassignment keeps the workspace as a live game with both sides assigned, the same live game continues with the current time control and clock state. If reassignment happens while already in `freeAnalysisSetup`, the workspace remains in setup until the separate `startGameFromSetup` flow is used.
- Runtime guardrails: if the replaced seat already had a turn-scoped engine search in flight, that search is stopped before the reassignment is committed. When reassignment keeps the workspace as a playable live game, `_maybeRequestEngineTurn` may request at most one new turn for the side to move only when that side is now engine-controlled and there is no still-valid request already in flight for that seat and turn.
- Requirement verification: `Pass`. Player reassignment stays explicit at the store boundary, cleanly supports conversion into setup/analysis from the visible context, preserves ongoing live games when no setup transition is needed, and reuses the normal player-engine turn gate without merging in the separate start-from-setup flow.

## History And Branching

### SCN-HIST-01 - Navigate Move History Node
- Public flow: `GamesStore.navigateToNode` -> `MoveUpdateService.navigateToNode` -> `MoveUpdateService.getPosition` -> `AnalysisStore.getVisibleAnalysis`.
- Private design: `GamesStore._setVisibleNode` -> `_deriveInteractionContext` -> `_refreshVisibleAnalysisIfNeeded`.
- State coverage: entering an earlier node moves the workspace into `historyReview` and suppresses `_maybeRequestEngineTurn`; returning to the live node restores `currentPosition`, after which `_maybeRequestEngineTurn` may run again if the live side to move is engine-controlled.
- Requirement verification: `Pass`. Board, history, and analysis bind to the same visible node.

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)
- Public flow: `GamesStore.makeMove` -> `SettingsStore.getSettings` -> `MoveUpdateService.addMainlineMove` -> `MoveUpdateService.rewriteMainline`.
- Private design: `GamesStore._applyHistoryRewritePolicy` -> `_confirmMainlineRewriteIfNeeded` -> `_promoteNewContinuation` -> `_restoreCurrentPositionAfterRewrite` -> `_maybeRequestEngineTurn`.
- Settings coverage: `gameplay.takebackPolicy = rewriteMainline` routes this flow into live mainline mutation. `gameplay.confirmMainlineRewrite` decides whether `_confirmMainlineRewriteIfNeeded` is a no-op or a blocking prompt. Once the new continuation is promoted and the workspace returns to `currentPosition`, a live engine turn may be requested if the side to move is engine-controlled.
- Requirement verification: `Pass`. The public surface can keep the old future as a variation while promoting the new continuation.

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)
- Public flow: `GamesStore.makeMove` -> `SettingsStore.getSettings` -> `MoveUpdateService.addAnalysisMove` -> optional `MoveUpdateService.navigateToNode`.
- Private design: `GamesStore._applyAnalysisOnlyHistoryPolicy` -> `_handleAnalysisBranchExitBehaviour` -> optional `_restoreLiveNodeAfterAnalysisBranch`.
- Settings coverage: `gameplay.takebackPolicy = analysisOnly` keeps the live node unchanged. `gameplay.analysisBranchExitBehaviour = returnToLiveNode` restores `currentPosition` immediately after the analysis move, while `stayOnBranch` keeps the workspace off the live node in analysis review. `_maybeRequestEngineTurn` stays suppressed for both branches until the workspace is back on the live current node.
- Requirement verification: `Pass`. Analysis-only continuation does not mutate the live node.

### SCN-HIST-04 - Prune Future Moves from Selected Node
- Public flow: `UiStateStore.showModal({ kind: "pruneFuture" })` -> `GamesStore.pruneFuture` -> `MoveUpdateService.pruneFutureMoves` -> `GamesStore.saveGame`.
- Private design: `GamesStore._confirmPruneIfNeeded` -> `_assertRootPruneAllowed` -> `_pruneTreeFromNode` -> `_reconcileLiveAndVisibleNodes` -> `_persistWorkspace`.
- UI surface coverage: prune confirmation uses the shared dialog shell with a danger-focused confirmation row before irreversible mutation is allowed through.
- Settings coverage: `gameplay.confirmPruneFutureMoves` decides whether the prune confirmation modal is required. `gameplay.allowRootPrune` decides whether pruning from the root node is allowed or rejected before mutation.
- Requirement verification: `Pass`. Root-prune policy and irreversible confirmation both sit behind the store boundary.

## Time Control

### SCN-TIME-01 - Clock Ticks During Play
- Public flow: `GamesStore.getGame` + `TimeControlService.getRemainingTime` through a presentation-safe clock read helper.
- Private design: `GameView._buildClockReadModel` -> `TimeControlService._applyElapsedTime`; `PlayerPanel._formatRemainingTime`.
- UI timing rule: render loops and timer callbacks are cadence only. They request authoritative remaining-time reads but do not mutate stored clock state directly.
- Requirement verification: `Pass`. Time reads stay authoritative without moving mutation logic into the view.

### SCN-TIME-02 - Pause and Resume Clocks
- Public flow: `GamesStore.pauseGame` -> `GamesStore.resumeGame`.
- Private design: `GamesStore._assertPausable` -> `_pauseClock` -> `_markPauseOwner`; resume uses `_assertResumable` -> `_resumeClock` -> `_maybeRequestEngineTurn`.
- State coverage: pause and resume are valid only for timed `liveGame + currentPosition + ongoing` states. `resumeGame` restores clock progression but only requests an engine turn after resume when the resumed context is playable live current-position state and the side to move is engine-controlled.
- Requirement verification: `Pass`. Double-pause and resume-after-finish are blocked centrally.

### SCN-TIME-03 - Increment Applied After Move
- Public flow: `GamesStore.makeMove` -> `TimeControlService.applyMove`.
- Private design: `GamesStore._updateClockAfterMove` -> `TimeControlService._applyIncrement` -> `_switchActiveColour`.
- Requirement verification: `Pass`. Increment logic remains coupled to successful move commit rather than UI ticks.

### SCN-TIME-04 - Timeout Ends Game
- Public flow: cadence read or move-boundary check -> `GamesStore.syncClock` -> `TimeControlService.getRemainingTime` -> `TimeControlService.hasExpired` -> `GamesStore.saveGame`.
- Private design: `GamesStore._reconcileClock` -> `_finaliseTimeoutIfNeeded(resultState, "timeout")` -> `_lockLiveMoves` -> `_persistWorkspace` -> `UiStateStore.showModal({ kind: "timeout" })`.
- Timing rule: timeout finalisation is triggered from an authoritative clock read. View timer ticks may request `syncClock`, but they do not decide timeout independently.
- Requirement verification: `Pass`. Timeout finalisation stays in the store and cannot be duplicated by the view, while post-timeout analysis can still remain read-only against the stored result.

### SCN-TIME-05 - Menu Actions Auto-Pause Timed Games
- Public flow: menu intent -> conditional `GamesStore.pauseGame(..., "menu")` -> external flow -> conditional `GamesStore.resumeGame(..., "menu")`.
- Private design: `GamesStore._maybeAutoPauseForMenu` -> `_rememberPauseOwner`; return uses `_resumeIfMenuOwnedPause`.
- Settings coverage: `session.autoPauseOnMenu` controls whether timed live games are paused for save/settings and similar interrupting flows. Pause ownership prevents an unrelated return path from auto-resuming a manually paused game or a game paused for analysis-mode entry.
- Requirement verification: `Pass`. Auto-pause is gated by settings, active clock state, and pause ownership.

## Game Controls

### SCN-CTRL-01 - Takeback Action
- Public flow: `GamesStore.takeBack` -> `MoveUpdateService.takeBack`.
- Private design: `GamesStore._assertTakeBackAllowed` -> `_rewindVisibleAndLiveNodes` -> `_rebuildClockFromHistory` -> `_refreshVisibleAnalysis`.
- Requirement verification: `Pass`. Takeback policy and clock recomputation remain inside one mutation boundary.

### SCN-CTRL-02 - Resign Game
- Public flow: `UiStateStore.showModal({ kind: "resign" })` -> `GamesStore.resignGame` -> `GamesStore.saveGame`.
- Private design: `GamesStore._assertResultMutable` -> `_finaliseResult(resultState, "resignation")` -> `_persistWorkspace`.
- Requirement verification: `Pass`. Confirmation and final result persistence are both covered.

### SCN-CTRL-03 - Draw Offer Flow
- Public flow: local-local branch `GameControlPanel.drawRequested` -> `UiStateStore.showModal({ kind: "drawOffer" })` -> `GamesStore.offerDraw` -> `UiStateStore.showModal({ kind: "drawResolve" })` -> `GamesStore.resolveDrawOffer` -> conditional `GamesStore.saveGame`; engine or future-remote branch `GameControlPanel.drawRequested` -> `GamesStore.offerDraw` -> pending incoming-offer indicator on `GameControlPanel` -> later `GameControlPanel.drawRequested` or external callback -> `GamesStore.resolveDrawOffer` -> conditional `GamesStore.saveGame`.
- Private design: `GamesStore._assertResultMutable` -> `_captureDrawOfferContext` -> `_throttleRepeatedDrawOffer` -> local-local `_openDrawOfferPrompt` and `_openLocalDrawResolvePrompt` or non-local `_markPendingExternalDrawOffer` -> optional `_resolveExternalDrawOffer` -> optional `_finaliseResult("drawn", "drawAgreement")` -> `_persistWorkspace`.
- UI surface coverage: local player versus local player uses the shared dialog shell for both the initial offer confirmation and the opposing local side's accept-or-decline step. Engine-controlled and future remote seats do not use a dialog-hosted response step; instead, the draw control shows a pending-offer indicator light when an incoming non-local draw offer is waiting and the next draw press accepts immediately.
- Integration note: `resolveDrawOffer` remains a public store boundary for any future engine or remote callback even if the underlying adapter never emits that callback. If UCI exposes no draw-response message, the adapter may simply never call the boundary.
- Requirement verification: `Pass`. The baseline keeps local-local resolution explicit while letting engine and future remote participants share the indicator-based offer model.
### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode
- Public flow: `GamesStore.enterInGameAnalysis` -> analysis moves continue through `GamesStore.makeMove` -> `GamesStore.exitInGameAnalysis`.
- Private design: entry uses `_assertInGameAnalysisAllowed` -> `_pauseForAnalysisEntry` -> `_cloneAnalysisContext`; exit uses `_promptForDirtyAnalysisExitIfNeeded` -> `UiStateStore.showModal({ kind: "analysisExitDirty", payload: { gameId } })` -> `_restoreLiveNode` -> `_resumeAfterAnalysisIfOwned`.
- State coverage: in-game analysis is available for ongoing live games and may also be entered after timeout while preserving the stored final result. Entry is blocked for `freeAnalysisSetup`, `boardEdit`, paused states that cannot be analysis-owned, and non-timeout final results. While active, analysis moves are legal for both colours, clocks do not progress, the live node does not advance, and `_maybeRequestEngineTurn` remains suppressed until the mode exits back to the live node.
- UI surface coverage: entering or leaving in-game analysis does not imply any panel-visibility side effect. Dirty-exit handling is explicit through the shared dialog shell instead of a hidden `UiStateStore.togglePanel` policy.
- Requirement verification: `Pass`. Analysis mode gives both-colour move control without mutating the live line.

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode
- Public flow: blocked board-edit intent -> `UiStateStore.showModal({ kind: "boardEditBlocked" })`; allowed cases continue to `GamesStore.enterBoardEdit`.
- Private design: `GamesStore._assertBoardEditAllowed` returns a reason token; `UiStateStore` owns the explanatory prompt.
- UI surface coverage: the blocked action explanation uses the shared dialog shell and may offer dismiss-only handling or a future setup shortcut without mutating the live game context directly.
- Requirement verification: `Pass`. Board editing stays isolated to `freeAnalysisSetup` without leaking the rule into components.


