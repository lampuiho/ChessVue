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
- `analysisEngineAddRequested`
- `analysisEngineRemoveRequested`
- `lineSelected`

## Notes
- Each engine row updates independently.
- Each engine group may show up to `3` visible lines for the active position.
- Each engine group may be folded independently without affecting the other engine groups.
- The panel title row exposes a right-aligned `+` button for adding an analysis engine to the current game.
- Each assigned engine group exposes a right-aligned `-` button on that engine title row for removing it from the current game, separate from retry or stop runtime actions.
- The last visible in-memory analysis snapshot may remain visible when live engines are unavailable, but it is not persisted as saved game data.
- The panel rerenders when `AnalysisStore` publishes a newer visible snapshot for the same engine and position, so stronger scores replace weaker ones during an active search.
- `AnalysisPanel` contains no HTML or template markup and binds engine view models into common panel, status, list, and message components.
