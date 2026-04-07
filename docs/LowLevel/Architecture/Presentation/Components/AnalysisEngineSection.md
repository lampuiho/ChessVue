# AnalysisEngineSection

## Purpose
Render one engine's availability state, summary row, and analysis lines.

## Consumes
- engine metadata
- engine availability
- current analysis snapshot
- whether the current workspace context renders engine move targets
- selected move identity

## Emits
- `retryRequested`
- `stopRequested`
- `moveSelected` when engine move targets are rendered

## Notes
- `AnalysisPanel` composes one `AnalysisEngineSection` per engine.
- This keeps per-engine line rendering and controls self-contained.
- Score and engine-state summary content remain visible even when move targets are hidden.
- `WorkspaceKind.FreeAnalysisSetup` exposes individual move targets so the user can inspect any move along the line.
- `WorkspaceKind.LiveGame` exposes individual move targets in `InteractionContext.CurrentPosition`, `InteractionContext.HistoryReview`, or `InteractionContext.InGameAnalysis` only when that game's `liveAnalysisOptions.showLiveAnalysisMoves = true`.
- In `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition`, a selected move target commits a normal live move.
- In `WorkspaceKind.LiveGame + InteractionContext.HistoryReview`, a selected move target follows the ordinary history-move policy.
- In `WorkspaceKind.LiveGame + InteractionContext.InGameAnalysis`, a selected move target applies as an analysis move without advancing the live node.
- `AnalysisEngineSection` contains no HTML or template markup and adapts engine analysis state into common status and list components.
