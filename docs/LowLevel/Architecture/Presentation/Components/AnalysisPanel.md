# AnalysisPanel

## Purpose and inputs

Render the game's ordered analysis seats supplied by `GamesStore.getVisibleAnalysis`. The accessor returns every assigned seat, including empty, failed, stopped, and restored seats. The panel never reads runtime line maps or filters by position.

Props are `seats: readonly ReadonlyAnalysisSeat[]`, `collapsed`, `expandedByIndex`, `showMoves`, `disabled` (move selection), `startDisabled` (Refresh/Retry), and `canAdd`.

## Events

- `collapseToggled` and `engineExpandedToggled(index)` control folds.
- `refreshRequested`, `retryRequested(index)`, and `stopRequested(index)` use existing store actions.
- `engineAddRequested` and `engineRemoveRequested(index)` change assignments.
- `moveSelected(moves)` emits the PV prefix through the clicked move, using individual `Play through <SAN>` buttons. `GameView` validates the entire selected prefix before applying it; normal live play submits only its first move.

## Rendering and permissions

- With move suggestions enabled, render `seat.lines` directly with a score and depth on each line. The subscription has already selected at most three entries in engine rank order; there is no template slice or frontend ranking.
- Show assignment metadata, score, and runtime availability even when no line exists. Only an empty seat list means no engine is assigned.
- Missing runtime is unavailable, not Starting. Ready with an incomplete result is stopped; `isComplete` describes natural completion rather than runtime availability.
- Keep accepted lines visible alongside failure feedback. Explicit Stop preserves the current result. Restored lines can display without a process.
- Paused states disable move selection while Refresh/Retry/Stop, assignment controls, and folding remain available. BoardEdit disables startup. `showLiveAnalysisMoves` continues to select score-only versus move rendering. Score-only mode is titled Evaluations: engine names sit left, scores sit right, and there are no panel/engine folds or status/depth summaries. Saved analysis collapse flags do not hide evaluations; management actions appear on row hover or keyboard focus. Analysis retains its panel/engine folds and three move lines.
- Games are raw: `GameView` depends on `workspaceRevision` and receives a fresh outer seat array so status/line mutations reach the child without clock ticks.
- The separate Recorded analysis sidebar panel is removed. Actual-move records remain in saved game data.
- Fold indexes follow assignment order, including empty seats. Removal reconciles the existing UI fold array.

## Remaining presentation work

Selected-prefix emission slices the requested range once and retains the original stable move references as `readonly IMoveRaw[]`; detailed entries already satisfy this contract. GameView chooses actual, exploratory or eligible off-turn delivery without cloning transport fields. Score-only display continues to disable suggestion input.

The component still contains its current template. Common-render-layer extraction remains FRONTEND-DRIFT-12. Individual targets and prefix playback are implemented and exercised by JRN-ANALYSIS-03–06/10; the old FRONTEND-DRIFT-04 interaction note is superseded by that [scenario review](../../../../../journeys/definitions/analysis/ScenarioReview.md).
