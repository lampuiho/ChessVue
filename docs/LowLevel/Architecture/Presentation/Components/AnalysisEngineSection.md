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
- Non-live analysis states expose individual move targets so the user can inspect any move along the line.
- Live and live-analysis states expose individual move targets only when that game's `gameplayOptions.showLiveAnalysisMoves = true`.
- Paused live play may still show score and status updates, but it does not expose clickable move targets.
- In live states, a selected move target commits a normal live move.
- In live-analysis or non-live analysis states, a selected move target applies as an analysis move without advancing the live node.
- `AnalysisEngineSection` contains no HTML or template markup and adapts engine analysis state into common status and list components.
