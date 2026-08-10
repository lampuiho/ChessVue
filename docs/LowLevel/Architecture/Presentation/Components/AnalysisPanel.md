# AnalysisPanel

## Purpose
Render the latest visible analysis snapshot for the active position.

## Consumes
- visible analysis snapshot from `GamesStore.getVisibleAnalysis(...)`
- per-engine availability and failure state
- active `gameState` and per-game live-analysis options from `GamesStore`
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
- Non-live analysis states expose individual move targets so the user can inspect any move along a suggested line.
- Live and live-analysis states default to score-only rows because `gameplayOptions.showLiveAnalysisMoves` defaults to `false`.
- When `gameplayOptions.showLiveAnalysisMoves = true`, live states may expose individual engine move targets, and selecting one commits an ordinary live move through `GamesStore.makeMove`.
- When `gameplayOptions.showLiveAnalysisMoves = true`, live-analysis states may expose individual engine move targets, and selecting one applies analysis moves without advancing the live node.
- Paused live play keeps visible analysis rows read-only for move selection, but background analysis updates, refresh, retry, stop, and analysis-engine management remain available because they are not treated as gameplay actions.
- Each engine group may be folded independently without affecting the other engine groups.
- The panel title row exposes a right-aligned `+` button for adding an analysis engine to the current game.
- Each assigned engine group exposes a right-aligned `-` button on that engine title row for removing it from the current game, separate from retry or stop runtime actions.
- Persisted analysis snapshots may remain visible when live engines are unavailable.
- The panel rerenders when `GamesStore` exposes a newer visible snapshot for the same engine and highlighted position, so stronger scores replace weaker ones during an active search.
- Selecting a move inside a suggested line always follows the same move-dispatch rules as ordinary move entry for the current game state. Non-live analysis and live-analysis states apply analysis moves, while live states commit a real move.
- In paused live play, `moveSelected` is not emitted even if a read-only line is visible.
- `AnalysisPanel` contains no HTML or template markup and binds engine view models into common panel, status, list, and message components.
