# GameView

## Purpose
Render the integrated gameplay workspace for one active game.

## Inputs
- active game workspace from `GamesStore`
- visible analysis from `AnalysisStore`
- per-game runtime availability from `EnginesStore`
- remembered global layout state from `UiStateStore`
- effective app theme from the shared root app-shell appearance host
- local pure mapping of store state into board, panel, control, and captured-material props
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
- does not own mutation or persistence logic directly

## Notes
- `GameView` hosts baseline analysis inside the game screen rather than through a dedicated analysis route.
- Game-tab selection is resolved through route updates, with `GameTabs` delegating shared child-route tab logic to `TabbedView`.
- `GameView` reads store state directly; it does not depend on a separate query-helper subsystem.
- When a committed flow needs an authoritative derived read such as remaining clock time, `GameView` may call the relevant domain service locally while still keeping mutation ownership in stores.
- `GameView` consumes the effective app theme from the shared root app-shell appearance host rather than owning the root theme attachment itself.
- `GameView` owns the local pure derivation of captured-piece groups from the visible position before passing them into `PlayerPanel`.
- `GameView` contains no HTML or template markup and wires feature adapters into common render surfaces only.
