# GameView

## Purpose
Render the integrated gameplay workspace for one active game.

## Inputs
- active game workspace from `GamesStore`
- visible analysis from `AnalysisStore`
- per-game runtime availability from `EnginesStore`
- shell layout state from `UiStateStore`
- `GameWorkspaceShell` for shallow screen-region composition

## Child Components
- `MenuBar`
- `GameTabs`
- `GameWorkspaceShell`
- `Chessboard`
- `PlayerPanel`
- `HistoryPanel`
- `AnalysisPanel`
- `GameControlPanel`

## Outputs
- forwards user intents to stores
- does not call domain services directly

## Notes
- `GameView` hosts baseline analysis inside the game screen rather than through a dedicated analysis route.
- Game-tab selection is resolved through route updates, with `GameTabs` delegating shared child-route tab logic to `TabbedView`.
- `GameView` should wire region components together rather than holding large inline board/sidebar/control markup.
