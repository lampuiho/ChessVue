# AnalysisPanel

## Purpose
Render the latest visible analysis snapshot for the active position.

## Consumes
- visible analysis snapshot from `AnalysisStore`
- per-engine availability and failure state
- `PanelSurface` and `ItemList` for shared panel and row behaviour
- `SidePanelButton` for panel actions
- `AnalysisChessPieceButton` where piece-choice interactions are exposed for analysis or setup helpers
- `AnalysisEngineSection` for per-engine line rendering and actions

## Emits
- `refreshRequested`
- `engineRetryRequested`
- `engineStopRequested`
- `engineSelectionRequested`
- `lineSelected`

## Notes
- Each engine row updates independently.
- Saved analysis may remain visible when live engines are unavailable.
