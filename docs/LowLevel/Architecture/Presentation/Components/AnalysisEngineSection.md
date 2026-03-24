# AnalysisEngineSection

## Purpose
Render one engine's availability state, summary row, and analysis lines.

## Consumes
- engine metadata
- engine availability
- current analysis snapshot
- selected move identity

## Emits
- `retryRequested`
- `stopRequested`
- `moveSelected`

## Notes
- `AnalysisPanel` composes one `AnalysisEngineSection` per engine.
- This keeps per-engine line rendering and controls self-contained.
- Each displayed principal variation exposes individual move targets so the user can inspect any move along the line.
- `AnalysisEngineSection` contains no HTML or template markup and adapts engine analysis state into common status and list components.
