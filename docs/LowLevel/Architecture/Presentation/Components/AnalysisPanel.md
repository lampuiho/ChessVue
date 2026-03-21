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
- The panel rerenders when `AnalysisStore` publishes a newer visible snapshot for the same engine and position, so stronger scores replace weaker ones during an active search.
- `AnalysisPanel` contains no HTML or template markup and binds engine view models into common panel, status, list, and message components.
