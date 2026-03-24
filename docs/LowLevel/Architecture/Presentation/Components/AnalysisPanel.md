# AnalysisPanel

## Purpose
Render the latest visible analysis snapshot for the active position.

## Consumes
- visible analysis snapshot from `AnalysisStore`
- per-engine availability and failure state
- active workspace kind, interaction context, and per-game live-analysis options from `GamesStore`
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
- `moveSelected` when the current workspace context renders move targets

## Notes
- Each engine row updates independently.
- Each engine group always shows score and engine status for the active position.
- Each engine group may additionally show up to `3` visible lines for the active position when the current workspace context allows rendered move targets.
- `freeAnalysisSetup` exposes individual move targets so the user can inspect any move along a suggested line.
- `liveGame` defaults to score-only rows because `liveAnalysisOptions.showLiveAnalysisMoves` defaults to `false`.
- When `liveAnalysisOptions.showLiveAnalysisMoves = true`, `liveGame + currentPosition` may expose individual engine move targets, and selecting one commits an ordinary live move through `GamesStore.makeMove`.
- When `liveAnalysisOptions.showLiveAnalysisMoves = true`, `liveGame + historyReview` may expose individual engine move targets, and selecting one reuses the ordinary history-move policy through `GamesStore.makeMove`.
- When `liveAnalysisOptions.showLiveAnalysisMoves = true`, `liveGame + inGameAnalysis` may expose individual engine move targets, and selecting one applies analysis moves without advancing the live node.
- Each engine group may be folded independently without affecting the other engine groups.
- The panel title row exposes a right-aligned `+` button for adding an analysis engine to the current game.
- Each assigned engine group exposes a right-aligned `-` button on that engine title row for removing it from the current game, separate from retry or stop runtime actions.
- The last visible in-memory analysis snapshot may remain visible when live engines are unavailable, but it is not persisted as saved game data.
- The panel rerenders when `AnalysisStore` publishes a newer visible snapshot for the same engine and position, so stronger scores replace weaker ones during an active search.
- Selecting a move inside a suggested line always follows the same move-dispatch rules as ordinary move entry for the current workspace context. That means `freeAnalysisSetup` and enabled `liveGame + inGameAnalysis` apply analysis moves, enabled `liveGame + currentPosition` commits a real move, and enabled `liveGame + historyReview` reuses the normal history rewrite-or-branch policy.
- `AnalysisPanel` contains no HTML or template markup and binds engine view models into common panel, status, list, and message components.
