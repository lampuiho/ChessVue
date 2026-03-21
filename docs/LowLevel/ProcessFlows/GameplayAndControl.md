# Gameplay And Control Flows

## Scope
This document covers `SCN-MOVE-01` to `SCN-CTRL-05`.

## Move Execution

### SCN-MOVE-01 - Legal Move on Board
- Public flow: `GamesStore.makeMove` -> `GameRuleService.isMoveLegal` -> `GameRuleService.applyMove` -> `MoveUpdateService.addMainlineMove` -> `TimeControlService.applyMove` -> `AnalysisStore.refreshAnalysis`.
- Private design: `GamesStore._assertMoveAllowed` -> `_resolveMoveContext` -> `_commitLiveMove` -> `_updateClockAfterMove` -> `_refreshVisibleAnalysis` -> `_persistWorkspaceIfNeeded`.
- Requirement verification: `Pass`. The move commits once and fans out to history, clocks, and analysis from one store boundary.

### SCN-MOVE-02 - Illegal Move Attempt
- Public flow: `GamesStore.makeMove` -> `GameRuleService.isMoveLegal`.
- Private design: `GamesStore._assertMoveAllowed` -> `_rejectIllegalMove` -> `_refreshLegalTargets`.
- Requirement verification: `Pass`. Rejection happens before tree, clock, or persistence mutation.

### SCN-MOVE-03 - Pawn Promotion Resolution
- Public flow: `GamesStore.makeMove` -> `GameRuleService.requiresPromotionSelection` -> `UiStateStore.showModal("promotion")` -> `GamesStore.makeMove` with the selected promotion piece.
- Private design: `GamesStore._stagePendingPromotion` -> `_commitPromotionMove` -> `_clearPendingPromotion`; cancel uses `UiStateStore.hideModal`.
- Requirement verification: `Pass`. Promotion remains an explicit store-owned mutation instead of a UI-side special case.

## History And Branching

### SCN-HIST-01 - Navigate Move History Node
- Public flow: `GamesStore.navigateToNode` -> `MoveUpdateService.navigateToNode` -> `MoveUpdateService.getPosition` -> `AnalysisStore.getVisibleAnalysis`.
- Private design: `GamesStore._setVisibleNode` -> `_deriveInteractionContext` -> `_refreshVisibleAnalysisIfNeeded`.
- Requirement verification: `Pass`. Board, history, and analysis bind to the same visible node.

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)
- Public flow: `GamesStore.makeMove` -> `SettingsStore.getSettings` -> `MoveUpdateService.addMainlineMove` -> `MoveUpdateService.rewriteMainline`.
- Private design: `GamesStore._applyHistoryRewritePolicy` -> `_confirmMainlineRewriteIfNeeded` -> `_promoteNewContinuation`.
- Requirement verification: `Pass`. The public surface can keep the old future as a variation while promoting the new continuation.

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)
- Public flow: `GamesStore.makeMove` -> `SettingsStore.getSettings` -> `MoveUpdateService.addAnalysisMove` -> optional `MoveUpdateService.navigateToNode`.
- Private design: `GamesStore._applyAnalysisOnlyHistoryPolicy` -> `_handleAnalysisBranchExitBehaviour`.
- Requirement verification: `Pass`. Analysis-only continuation does not mutate the live node.

### SCN-HIST-04 - Prune Future Moves from Selected Node
- Public flow: `UiStateStore.showModal("pruneFuture")` -> `GamesStore.pruneFuture` -> `MoveUpdateService.pruneFutureMoves` -> `GamesStore.saveGame`.
- Private design: `GamesStore._confirmPruneIfNeeded` -> `_pruneTreeFromNode` -> `_reconcileLiveAndVisibleNodes` -> `_persistWorkspace`.
- Requirement verification: `Pass`. Root-prune policy and irreversible confirmation both sit behind the store boundary.

## Time Control

### SCN-TIME-01 - Clock Ticks During Play
- Public flow: `GamesStore.getGame` + `TimeControlService.getRemainingTime` through a presentation-safe clock read helper.
- Private design: `GameView._buildClockReadModel` -> `TimeControlService._applyElapsedTime`; `PlayerPanel._formatRemainingTime`.
- Requirement verification: `Pass`. Time reads stay authoritative without moving mutation logic into the view.

### SCN-TIME-02 - Pause and Resume Clocks
- Public flow: `GamesStore.pauseGame` -> `GamesStore.resumeGame`.
- Private design: `GamesStore._assertPausable` -> `_pauseClock` -> `_markPauseOwner`; resume uses `_assertResumable` -> `_resumeClock`.
- Requirement verification: `Pass`. Double-pause and resume-after-finish are blocked centrally.

### SCN-TIME-03 - Increment Applied After Move
- Public flow: `GamesStore.makeMove` -> `TimeControlService.applyMove`.
- Private design: `GamesStore._updateClockAfterMove` -> `TimeControlService._applyIncrement` -> `_switchActiveColour`.
- Requirement verification: `Pass`. Increment logic remains coupled to successful move commit rather than UI ticks.

### SCN-TIME-04 - Timeout Ends Game
- Public flow: `GamesStore.syncClock` -> `TimeControlService.getRemainingTime` -> `TimeControlService.hasExpired` -> `GamesStore.saveGame`.
- Private design: `GamesStore._reconcileClock` -> `_finaliseTimeoutIfNeeded` -> `_lockLiveMoves` -> `_persistWorkspace` -> `UiStateStore.showModal("timeout")`.
- Requirement verification: `Pass`. Timeout finalisation stays in the store and cannot be duplicated by the view.

### SCN-TIME-05 - Menu Actions Auto-Pause Timed Games
- Public flow: menu intent -> conditional `GamesStore.pauseGame(..., "menu")` -> external flow -> conditional `GamesStore.resumeGame(..., "menu")`.
- Private design: `GamesStore._maybeAutoPauseForMenu` -> `_rememberPauseOwner`; return uses `_resumeIfMenuOwnedPause`.
- Requirement verification: `Pass`. Auto-pause is gated by settings, active clock state, and pause ownership.

## Game Controls

### SCN-CTRL-01 - Takeback Action
- Public flow: `GamesStore.takeBack` -> `MoveUpdateService.takeBack`.
- Private design: `GamesStore._assertTakeBackAllowed` -> `_rewindVisibleAndLiveNodes` -> `_rebuildClockFromHistory` -> `_refreshVisibleAnalysis`.
- Requirement verification: `Pass`. Takeback policy and clock recomputation remain inside one mutation boundary.

### SCN-CTRL-02 - Resign Game
- Public flow: `UiStateStore.showModal("resign")` -> `GamesStore.resignGame` -> `GamesStore.saveGame`.
- Private design: `GamesStore._assertResultMutable` -> `_finaliseResult("resigned")` -> `_persistWorkspace`.
- Requirement verification: `Pass`. Confirmation and final result persistence are both covered.

### SCN-CTRL-03 - Draw Offer Flow
- Public flow: `GamesStore.offerDraw`.
- Private design: `GamesStore._assertResultMutable` -> `_resolveDrawDecision` -> optional `_finaliseResult("drawn")` -> `_persistWorkspace`.
- Requirement verification: `Pass`. Decline and throttle branches stay internal to the store flow.

### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode
- Public flow: `GamesStore.enterInGameAnalysis` -> analysis moves continue through `GamesStore.makeMove` -> `GamesStore.exitInGameAnalysis`.
- Private design: entry uses `_pauseForAnalysisEntry` -> `_cloneAnalysisContext`; exit uses `_promptForDirtyAnalysisExitIfNeeded` -> `_restoreLiveNode` -> `_resumeAfterAnalysisIfOwned`.
- Requirement verification: `Pass`. Analysis mode gives both-colour move control without mutating the live line.

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode
- Public flow: blocked board-edit intent -> `UiStateStore.showModal("boardEditBlocked")`; allowed cases continue to `GamesStore.enterBoardEdit`.
- Private design: `GamesStore._assertBoardEditAllowed` returns a reason token; `UiStateStore` owns the explanatory prompt.
- Requirement verification: `Pass`. Board editing stays isolated to `freeAnalysisSetup` without leaking the rule into components.
