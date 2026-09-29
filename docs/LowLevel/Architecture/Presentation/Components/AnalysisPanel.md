# AnalysisPanel

## Purpose and inputs

Render the game's ordered analysis seats supplied by `GamesStore.getVisibleAnalysis`. The accessor returns every assigned seat, including empty, failed, stopped, and restored seats. The panel never reads runtime line maps or filters by position.

Props are `seats: readonly ReadonlyAnalysisSeat[]`, `collapsed`, `expandedByIndex`, `showMoves`, `disabled` (move selection), `startDisabled` (Refresh/Retry), and `canAdd`.

## Events

- `collapseToggled` and `engineExpandedToggled(index)` control folds.
- `refreshRequested`, `retryRequested(index)`, and `stopRequested(index)` use existing store actions.
- `engineAddRequested` and `engineRemoveRequested(index)` change assignments.
- `moveSelected(moves)` currently emits a whole PV; individual targets/prefix dispatch remain FRONTEND-DRIFT-04.

## Rendering and permissions

- Render `seat.lines` directly. The subscription has already selected at most three entries in engine rank order; there is no template slice or frontend ranking.
- Show assignment metadata, score, and runtime availability even when no line exists. Only an empty seat list means no engine is assigned.
- Missing runtime is unavailable, not Starting. Ready with an incomplete result is stopped; `isComplete` describes natural completion rather than runtime availability.
- Keep accepted lines visible alongside failure feedback. Explicit Stop preserves the current result. Restored lines can display without a process.
- Paused states disable move selection while Refresh/Retry/Stop, assignment controls, and folding remain available. BoardEdit disables startup. `showLiveAnalysisMoves` continues to select score-only versus move rendering.
- Games are raw: `GameView` depends on `workspaceRevision` and receives a fresh outer seat array so status/line mutations reach the child without clock ticks.
- Fold indexes follow assignment order, including empty seats. Removal reconciles the existing UI fold array.

## Remaining presentation work

The component still contains its current template. Common-render-layer extraction remains FRONTEND-DRIFT-12. Individual move targets and applying only the selected move/prefix remain FRONTEND-DRIFT-04; this lifecycle repair does not claim those interactions implemented.
