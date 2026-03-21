# GameView

## Purpose
Render the integrated gameplay workspace for one active game.

## Inputs
- active game workspace from `GamesStore`
- visible analysis from `AnalysisStore`
- per-game runtime availability from `EnginesStore`
- shell layout state from `UiStateStore`

## Child Components
- `MenuBar`
- `GameTabs`
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
