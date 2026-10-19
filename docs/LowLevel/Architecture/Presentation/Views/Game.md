# GameView

## Purpose
Render the integrated gameplay workspace for one active game.

## Inputs
- active game from `GamesStore`
- visible analysis from `GamesStore.getVisibleAnalysis(...)`
- configured engine inventory from `EnginesStore` when selection flows need it
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
- `GameView` may coordinate multiple stores for a single user or route action, for example calling `GamesStore` for mutation, analysis refresh, or visible analysis reads, `EnginesStore` for player selection, or `UiStateStore` for modal work.
- `GameView` consumes the effective app theme from the shared root app-shell appearance host rather than owning the root theme attachment itself.
- `GameView` owns the local pure derivation of captured-piece groups from the visible position before passing them into `PlayerPanel`.
- `GameView` wires player-strip player-label clicks into the player-selection dialog flow and forwards confirmed assignment changes to `GamesStore`.
- `GameView` wires the analysis-panel title `+` action and each engine-title-row `-` action into the per-game analysis-engine assignment flow.
- Mount and route-update activation validate the destination and complete its Menu pause. Route leave/update and unmount cancel owned PV playback, including its real delay; replacement waits for old cleanup. Autosave failures arrive through an explicit action notification whose consumer is removed on unmount.
- Custom-game activation supplies an exactly-once dialog completion callback. It resumes the interrupted game while that game remains displayed; returning from a newly created game resumes the old Menu pause through route activation. No watcher orchestrates these flows.
- Manual and menu pauses permit menu navigation, player reassignment and analysis-engine management while disabling gameplay and history. An analysis-only pause exposes `Exit analysis` and permits both colours to explore and select history without advancing the live node or clock. Board edit disables player reassignment and history.
- `GameView` contains no HTML or template markup and wires feature adapters into common render surfaces only.
