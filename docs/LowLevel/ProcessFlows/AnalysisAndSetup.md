# Analysis And Setup Flows

## Scope
This document covers `SCN-FREE-ANALYSIS-01` to `SCN-ANALYSIS-05`.

Persistence note: this document focuses on setup and analysis mutation rules. Any later persistence of the changed `IGame` payload is caller-owned and runs through `SavedGamesStore.saveGame(...)`, so save steps are omitted here unless persistence itself is the subject of the scenario.

The implementation keeps the existing store/composable/service/client boundaries. [GameAnalysisComposable](../../../src/state/game/GameAnalysisComposable.ts) clears all targeted seat results before launching independent starts. [EngineRuntimeService](../../../src/domain/EngineRuntimeService.ts) owns cancellation and sequencing; [NwjsUciEngineClient](../../../src/platform/nwjs/NwjsUciEngineClient.ts) owns protocol states. See [EngineRuntimeOwnership](EngineRuntimeOwnership.md) for the detailed calls and stale-output guards.

```text
GameMoveComposable.publishRenderedPosition(game, changed)
  -> changed: GameAnalysisComposable.refreshAnalysisForGame(game)
     -> disposeAnalysisSubscription and clearAnalysisSeatLines for every seat
     -> startAnalysisSeat -> subscribeToAnalysis -> EngineRuntimeService.startAnalysis
        -> _beginAnalysisOperation -> _queueAnalysisOperation -> ensureReady -> client.startAnalysis
     -> touchGame publishes empty/starting seats before any engine completes
  -> unchanged: touchGame only; existing searches and results survive

client update -> EngineRuntimeService._acceptAnalysisUpdate
  -> validate all runtime lines -> captured subscription callback
     -> seat.lines = update.lines.slice(0, 3); update result metadata; touchGame
  -> GameView workspaceRevision -> GamesStore.getVisibleAnalysis -> AnalysisPanel.seats
```

`getVisibleAnalysis` returns all assignments in order without filtering or selecting lines. Effective board edits clear results through the same refresh preparation, but its BoardEdit gate stops engines instead of starting them. Empty, stopped, failed, and restored seats remain present.

## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context

#### Flow A - Create A Free Analysis Workspace
| `NewGameModal.createRequestedWithUnassignedSide` |
| --- |
| `GamesStore.createGame` |
| `GameWorkspaceComposable.createGame` |
| `GameWorkspaceComposable.createGame` |

| `GamesStore.createGame` |
| --- |
| `GameWorkspaceComposable.createGame` |
| `GameWorkspaceComposable.createGame` |
| `GameWorkspaceComposable.createGame` |

#### Flow B - Convert A Live Game Into Free Analysis / Setup
| `PlayerPanel.playerSelectionConfirmedAsNone` |
| --- |
| `GamesStore.reassignPlayer` |
| `GamePlayerTurnComposable.reassignPlayer` |
| `GameWorkspaceComposable.createGame` |

| `GamesStore.reassignPlayer` |
| --- |
| `GamePlayerTurnComposable.reassignPlayer` |
| `GamePlayerTurnComposable.reassignPlayer` |
| `GameWorkspaceComposable.createGame` |

#### Flow C - Refresh Analysis In The Free Analysis Workspace
| `Chessboard.moveSubmitted` |
| --- |
| `GamesStore.refreshAnalysis` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GameAnalysisComposable.refreshAnalysisForGame` |
| `GameAnalysisComposable.startAnalysisSeat` |
| `GameAnalysisComposable.subscribeToAnalysis` |

| `GameAnalysisComposable.startAnalysisSeat` |
| --- |
| `EngineRuntimeService.startAnalysis` owns readiness and cancellation |

| `GameAnalysisComposable.subscribeToAnalysis callback` |
| --- |
| select the first three ranked lines; update seat metadata; `touchGame` |

- Requirement verification: `Pass`. A creation request with an unassigned side or a live-game reassignment to an omitted player value yields a non-live workspace while preserving engine-driven analysis when configured.

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup

#### Flow A - Enter Board Edit
| `GameControlPanel.boardEditRequested` |
| --- |
| `GamesStore.enterBoardEdit` |
| `GamesStore.stopAnalysis` |

| `GamesStore.enterBoardEdit` |
| --- |
| `GameBoardEditComposable.enterBoardEdit` |
| `GameBoardEditComposable.enterBoardEdit` |

#### Flow B - Apply The First Direct Board Edit
| `Chessboard.chessPieceToggled` / `chessPieceDeleted` / `boardCleared` / `boardResetToStartPosition` |
| --- |
| `GamesStore.toggleChessPiece` / `deleteChessPiece` / `clearBoard` / `resetBoardToStartPosition` |
| `MoveApplicationService.togglePiece` / `deletePiece` / `clearBoard`, or `GameRuleUtility.createInitialBoardPosition` |
| `GameMoveComposable.replaceWithAnalysisRoot` when a new root is required |

| `GamesStore.toggleChessPiece` / `deleteChessPiece` / `clearBoard` / `resetBoardToStartPosition` |
| --- |
| `GameBoardEditComposable.assertBoardEditState` |
| mutate the rendered position board |
| `GameBoardEditComposable.applyEdit` |

| `GameMoveComposable.replaceWithAnalysisRoot` |
| --- |

#### Flow C - Apply Later Direct Board Edits In The Same Session
| `Chessboard.chessPieceToggled` / `chessPieceDeleted` / `boardCleared` / `boardResetToStartPosition` |
| --- |
| `GamesStore.toggleChessPiece` / `deleteChessPiece` / `clearBoard` / `resetBoardToStartPosition` |

| `GamesStore.toggleChessPiece` / `deleteChessPiece` / `clearBoard` / `resetBoardToStartPosition` |
| --- |
| `GameBoardEditComposable.assertBoardEditState` |
| mutate the current root board in place |
| `GameBoardEditComposable.applyEdit` |

#### Flow D - Leave Board Edit And Resume Analysis
| `GameControlPanel.boardEditRequested` |
| --- |
| `GamesStore.enterBoardEdit` |
| `GamesStore.refreshAnalysis` |

| `GamesStore.enterBoardEdit` |
| --- |
| `GameBoardEditComposable.enterBoardEdit` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GameAnalysisComposable.refreshAnalysisForGame` |
| `GameAnalysisComposable.startAnalysisSeat` |
| `GameAnalysisComposable.subscribeToAnalysis` |

| `GameAnalysisComposable.startAnalysisSeat` |
| --- |
| `EngineRuntimeService.startAnalysis` owns readiness and cancellation |

| `GameAnalysisComposable.subscribeToAnalysis callback` |
| --- |
| select the first three ranked lines; update seat metadata; `touchGame` |

- UI surface coverage: free-analysis board editing uses the inline piece palette in `Chessboard.vue`, close to the active board-edit controls. `PiecePalette` remains a proposed component extraction rather than a separate runtime module.
- State coverage: `GameState.BoardEdit` is valid only inside non-live analysis. While active, engine analysis is suspended and `GamesStore.refreshAnalysis` is blocked for that game.
- Process note: because board editing is restricted to non-live analysis, the first effective piece mutation updates the rendered position and `GameMoveComposable.replaceWithAnalysisRoot(...)` promotes it while creating the genuinely new root-only history. This also clears children when the user edits at the existing root. Later effective edits mutate that same root in place. Deleting an empty square, dragging from an empty square or onto the same square, and clearing an already empty board are no-ops and do not clear history.
- Control note: Edit board enters the mode and Finish editing exits through the same store action. Leaving without an effective edit preserves the tree and rendered selection, and derives the analysis state from that visible position's side to move. Exit performs no second confirmation; it allows analysis refresh to resume.
- Requirement verification: `Pass`. The public surface covers edit entry, direct board mutation, first-edit history clearing, analysis suspension during edit, and analysis refresh after board edit ends.

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup

#### Flow
| `StartGameFromSetupModal.confirmed` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.startGameFromSetup` |
| `GameWorkspaceComposable.startGameFromSetup` owns cleanup, replacement, player startup, and analysis refresh |
| `UiStateStore.hideModal` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.startGameFromSetup` |
| --- |
| `GameWorkspaceComposable.startGameFromSetup` |
| `GameAnalysisComposable.disposeAnalysisForGame` cancels captured old assignments before awaiting cleanup |
| `GamePlayerTurnComposable.clearPlayerTurnRuntime` |
| `GamePlayerTurnComposable.createPlayerSnapshot` |
| `GameAnalysisComposable.createAnalysisSeat` installs the new roster |
| `GameWorkspaceComposable.startLiveGame` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| `GameAnalysisComposable.refreshAnalysisForGame` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GameAnalysisComposable.refreshAnalysisForGame` |
| `GameAnalysisComposable.startAnalysisSeat` |
| `GameAnalysisComposable.subscribeToAnalysis` |

| `GameAnalysisComposable.subscribeToAnalysis callback` |
| --- |
| select the first three ranked lines; update seat metadata; `touchGame` |

| `UiStateStore.hideModal` |
| --- |

- State/settings coverage: the game may leave non-live analysis and enter `LiveWhiteTurn` or `LiveBlackTurn` only when both sides are assigned. That transition applies a newly chosen time control, captures the per-game `showLiveAnalysisMoves` choice for the resulting live game, and initialises fresh live clock state.
- Requirement verification: `Pass`. Starting from setup preserves the prepared root and move tree while moving the workspace into live-game rules, and engine-controlled turns continue through the normal live-game gate.

## Analysis And Engine Runtime

### SCN-ANALYSIS-01 - Start Single Engine Analysis

#### Flow
| `GamesStore.refreshAnalysis / rendered-position action` |
| --- |
| GamesStore.refreshAnalysis |

| GamesStore.refreshAnalysis |
| --- |
| GameAnalysisComposable.refreshAnalysisForGame |
| GameAnalysisComposable.startAnalysisSeat |
| GameAnalysisComposable.subscribeToAnalysis |

| GameAnalysisComposable.startAnalysisSeat |
| --- |
| `EngineRuntimeService.startAnalysis` owns readiness and cancellation |

| `GameAnalysisComposable.subscribeToAnalysis callback` |
| --- |
| select the first three ranked lines; update seat metadata; `touchGame` |

| GamesStore.getVisibleAnalysis |
| --- |

- UI surface coverage: score-only contexts show compact Evaluations rows with engine names and scores, without folds or status/depth summaries. Analysis shows foldable groups with up to `3` scored lines in non-live analysis states, and in live or live-analysis states only when that game's `gameplayOptions.showLiveAnalysisMoves = true`. Engine evaluation continues in both views.
- State gate: `GamesStore.refreshAnalysis` accepts live states, paused live states, live-analysis states, and non-live analysis states. It is blocked while `gameState = GameState.BoardEdit`. Paused live play keeps move-target selection blocked, but analysis refresh remains allowed because it is not treated as gameplay input.
- Runtime ownership detail: see [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for the explicit lower-layer state transitions behind analysis subscription registration, purpose-level analysis start, streamed updates, and malformed output handling.
- Requirement verification: `Pass`. Engine startup, streaming updates, ready callbacks, and position supersession are owned by the engine runtime boundary rather than the view.

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis

#### Flow
| `GamesStore.refreshAnalysis / rendered-position action` |
| --- |
| GamesStore.refreshAnalysis |
| EnginesStore.validateAnalysisSelection |

| GamesStore.refreshAnalysis |
| --- |
| GameAnalysisComposable.addAnalysisEngine |
| GameAnalysisComposable.refreshAnalysisForGame |

| EnginesStore.validateAnalysisSelection |
| --- |

- UI surface coverage: the panel renders one independently foldable engine group per selected engine. Each group always shows score and engine state, and may additionally show up to 3 visible lines when the current workspace context allows rendered move targets.
- Requirement verification: `Pass`. The four-engine cap is enforced before processes start, and partial failure does not block healthy engines.

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis

#### Flow A - Stop Analysis Explicitly
| AnalysisPanel.stopRequested |
| --- |
| GamesStore.stopAnalysis |

| GamesStore.stopAnalysis |
| --- |
| GameAnalysisComposable.stopAnalysis |
| EngineRuntimeService.stopAnalysis |
| retain seat lines, bestMove, timestamp, and completion; publish stopped availability |

#### Flow B - Retry A Failed Engine
| AnalysisPanel.retryRequested |
| --- |
| GamesStore.retryAnalysis |

| GamesStore.retryAnalysis |
| --- |
| GameAnalysisComposable.refreshAnalysisForGame |
| GameAnalysisComposable.startAnalysisSeat |
| GameAnalysisComposable.subscribeToAnalysis |

| GameAnalysisComposable.startAnalysisSeat |
| --- |
| `EngineRuntimeService.startAnalysis` owns readiness and cancellation |

| `GameAnalysisComposable.subscribeToAnalysis callback` |
| --- |
| select the first three ranked lines; update seat metadata; `touchGame` |

#### Flow C - Unexpected Analysis Engine Exit
| `NwjsUciEngineClient` process-exit listener |
| --- |
| `NwjsUciEngineClient._failUciSession` |

- Failure handling: malformed analysis output keeps the existing baseline rule and is discarded per message without stopping the session.
- Unexpected-exit handling: the client fails its UCI session and leaves the last valid rendered lines intact. Immediate publication of an otherwise idle process exit remains pending under ANALYSIS-DRIFT-12; no runtime event subscription or store-level polling helper was added. Failures observed by service operations do publish availability and errors.
- Retry rule: retry remains manual through `AnalysisPanel.retryRequested`; the baseline does not invent timeout, auto-reconnect, or backoff behaviour.
- Runtime ownership detail: see [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for the explicit restart, stop, malformed-output, and unexpected-exit runtime mutations.
- Requirement verification: Stop retention, cancellation, malformed-output discard, and manual retry have automated coverage. Immediate unsolicited exit reporting remains pending.

### SCN-ANALYSIS-04 - Click Suggested Move from Analysis Panel

`AnalysisPanel` renders an individual button per PV move and emits the selected prefix. `GameView.playAnalysisLine` chooses prefix playback for exploration or first-move submission for normal live play. `applyMoves` validates the entire requested sequence before committing its first move, applies subsequent moves at 350 ms intervals, and checks the owned abort signal, game and rendered path before each commit. `OperationOwner` cancels the actual pending delay and settles old cleanup before replacement playback starts. Route update/leave and unmount cancel the remaining playback. JRN-ANALYSIS-03–06/10 exercise this interaction; FRONTEND-DRIFT-04's pending label was documentation drift.

#### Flow A - Free Analysis / Setup Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore.refreshAnalysis / rendered-position action` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.advanceRenderedAnalysisBranch` |

#### Flow B - Live Current-Position Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore.refreshAnalysis / rendered-position action` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.commitLiveMove` |

#### Flow C - Live History-Review Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore.refreshAnalysis / rendered-position action` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.makeMove` |

#### Flow D - In-Game Analysis Suggestion
| `AnalysisPanel.moveSelected` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.makeMove` |
| `GamesStore.refreshAnalysis / rendered-position action` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.makeMove` |
| --- |
| `GameMoveComposable.makeMove` |
| `GameMoveComposable.advanceRenderedAnalysisBranch` |

- State/settings coverage: non-live analysis renders per-move engine targets. Live and live-analysis states render them only when `gameplayOptions.showLiveAnalysisMoves = true`. Manual/menu pauses make targets read-only; an analysis-only pause permits prefix exploration while the live node and clock stay fixed.
- Runtime selector coverage: analysis-panel move selection reuses the current visible hydrated node. Any persisted `MovePath` updates remain store-internal bookkeeping derived from that node and are not a public runtime interaction contract.
- Requirement verification: individual move selection, exact prefix playback, first-move live submission, whole-prefix stale rejection and cancellation on game switch have automated Analysis journey/integration coverage. The separate History tranche covers rewrite/no-takeback branch policies. See the [analysis review](../../../journeys/definitions/analysis/ScenarioReview.md) and [execution evidence](../../JourneyImplementation.md#analysis-verification).

### SCN-ANALYSIS-05 - Add or Remove Per-Game Analysis Engine During Game

#### Flow A - Add An Analysis Engine

```text
AnalysisPanel.engineAddRequested
  -> UiStateStore.showModal
  -> ModalHost.confirmAnalysisEngine
     -> GamesStore.addAnalysisEngine
        -> GameAnalysisComposable.addAnalysisEngine
        -> createAnalysisSeat; validate duplicate/count; publish assignment
     -> capture new seat before awaiting add completion
     -> re-find that seat's index
     -> GamesStore.retryAnalysis(game, index), unless BoardEdit or removed
```

Add remains assignment-only. The modal starts only that seat, preserving other engines' searches and results. During editing, the new seat waits for exit.

#### Flow B - Remove An Analysis Engine
| `AnalysisPanel.engineRemoveRequested` |
| --- |
| `GamesStore.removeAnalysisEngine` |

| `GamesStore.removeAnalysisEngine` |
| --- |
| `GameAnalysisComposable.removeAnalysisEngine` |
| `GameAnalysisComposable.disposeAnalysisSubscription` |
| `GameAnalysisComposable.stopAssignedEngine` |
| remove the captured seat synchronously; `touchGame`; then await cleanup |

`GameView.removeAnalysisEngine` removes the corresponding remembered fold entry immediately after the store removes the seat, preserving indexes for the remaining assignments.

- UI surface coverage: the analysis panel title owns the right-aligned `+` affordance for adding an engine to the current game, while each engine title row owns a right-aligned `-` affordance for removing that engine.
- State gate: roster add and remove are valid in live states, paused live states, live-analysis states, and non-live analysis states. Paused live play keeps move-target selection blocked, but analysis-engine management remains allowed because it is treated as configuration rather than gameplay.
- Requirement verification: `Pass`. Analysis-engine assignment stays per game, add and remove are both covered, and runtime start or stop remains delegated to `GamesStore`.



