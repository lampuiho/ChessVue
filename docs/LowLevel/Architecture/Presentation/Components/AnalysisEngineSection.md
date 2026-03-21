# AnalysisEngineSection

## Purpose
Render one engine's availability state, summary row, and analysis lines.

## Consumes
- engine metadata
- engine availability
- current analysis snapshot
- selected line identity

## Emits
- `retryRequested`
- `stopRequested`
- `lineSelected`

## Notes
- `AnalysisPanel` composes one `AnalysisEngineSection` per engine.
- This keeps per-engine line rendering and controls self-contained.
- `AnalysisEngineSection` contains no HTML or template markup and adapts engine analysis state into common status and list components.
