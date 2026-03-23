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
- per-engine folded or expanded state

## Emits
- `refreshRequested`
- `engineRetryRequested`
- `engineStopRequested`
- `engineSelectionRequested`
- `lineSelected`

## Notes
- Each engine row updates independently.
- Each engine group may show up to `3` visible lines for the active position.
- Each engine group may be folded independently without affecting the other engine groups.
- The last visible in-memory analysis snapshot may remain visible when live engines are unavailable, but it is not persisted as saved game data.
- The panel rerenders when `AnalysisStore` publishes a newer visible snapshot for the same engine and position, so stronger scores replace weaker ones during an active search.
- `AnalysisPanel` contains no HTML or template markup and binds engine view models into common panel, status, list, and message components.
