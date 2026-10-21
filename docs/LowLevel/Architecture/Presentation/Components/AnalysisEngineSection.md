# AnalysisEngineSection

## Purpose
Render one engine's availability state, summary row, and analysis lines.

This remains a planned component boundary under FRONTEND-DRIFT-12. The current `AnalysisPanel.vue` owns the engine sections and individual move targets directly. Prefix dispatch is implemented and covered by JRN-ANALYSIS-03–06/10; FRONTEND-DRIFT-04 no longer describes an outstanding interaction gap.

## Consumes
- engine metadata
- engine availability
- current analysis seat
- whether the current workspace context renders engine move targets
- selected move identity

## Emits
- `retryRequested`
- `stopRequested`
- `moveSelected` when engine move targets are rendered

## Notes
- The proposed extraction would let `AnalysisPanel` compose one `AnalysisEngineSection` per engine; today these rows are inline.
- This keeps per-engine line rendering and controls self-contained.
- Without move targets, the panel is titled Evaluations and shows compact engine-name/score rows without folds or status/depth summaries. Row management is available on hover or keyboard focus. With move targets, Analysis retains folds and three ranked lines with individual scores/depths.
- Non-live analysis states expose individual move targets so the user can inspect any move along the line.
- Live and live-analysis states expose individual move targets only when that game's `gameplayOptions.showLiveAnalysisMoves = true`.
- Paused live play may still show score and status updates, but it does not expose clickable move targets.
- In live states, a later selected move target submits only the first move of that prefix as the current live turn.
- In explicit in-game or non-live analysis, a selected move target plays the prefix one move at a time without advancing the live node. Manual/menu pauses disable it; an analysis-only pause allows exploration.
- The proposed `AnalysisEngineSection` would adapt engine analysis state into common status and list components; no extracted component exists yet.
