# Presentation Interaction Map

## Purpose
Map committed user interactions from the baseline scenarios to concrete view, component, and store boundaries.

This document verifies that presentation coverage is complete and that templates can stay shallow by delegating behaviour to named subcomponents.

Under the template-ownership rule:

- views contain no HTML or template markup
- feature components contain no HTML or template markup
- only common components own render markup

Read-side rule:

- views and feature adapters consume store state directly
- small pure local selectors or mapping functions may shape store state for render components
- no separate presentation query-helper subsystem is part of the baseline

## Interaction Coverage
### Startup And Home Actions
- Fresh launch and no-active-game fallback render in `HomeView`.
- `HomeView` uses `WorkspaceShell`, `HomeMenuButton`, `ItemList`, and `EmptyState` for its render surface.
- Custom new game opens `NewGameModal`, which owns form composition but not game-creation decisions.
- The same landing surface also owns direct actions for quick new, load, and settings.
- When recent entries exist, the same landing surface also owns recent-game reopening from a list positioned below the primary action row.
- `RecentGameStore` owns recent-entry loading, latest-save deduping, and reopen resolution; `HomeView` only triggers the load and selection interactions.

### Shell Navigation
- `MenuBar` owns shell-level actions for quick new, custom new, load, save, settings, and delete.
- `ToolbarStrip`, `MenuToolbarButton`, `TabbedView`, and `TabButton` own the actual shell markup.
- `GameTabs` owns open-game switching and close actions, with `TabbedView` and `TabButton` handling generic tab interaction while `GameTabs` maps selection to `/game/:id`.
- `Router` and `UiStateStore` validate and persist route-level navigation state.

### Board And Move Input
- `Chessboard` owns board interaction entry points such as click-click move input, drag-drop, selection clearing, and board-edit confirmation.
- `BoardGrid`, `SquareSurface`, `ChessPiece`, `AnalysisChessPieceButton`, and `ButtonGroup` own the board and piece render surfaces.
- `GameView` forwards board events to `GamesStore`, which remains the mutation boundary.

### History Navigation
- `HistoryPanel` owns node selection, prune entry, and return-to-live-node actions.
- `PanelSurface`, `TreeView`, `SidePanelButton`, and `EmptyState` own the history render surface.
- `HistoryTree` is a template-free adapter that prepares move-tree view models for `TreeView`.

### Analysis Interaction
- `AnalysisPanel` owns refresh, retry, stop, per-game analysis-engine add and remove, and analysis-line selection actions.
- `PanelSurface`, `StatusCard`, `ItemList`, `InlineMessage`, and `EmptyState` own the analysis render surface.
- `AnalysisEngineSection` is a template-free adapter that prepares per-engine view models for those common components.
- Each engine group may expose up to `3` visible lines and may be folded independently through transient per-game UI state without changing the other engine groups.

### Game Control Interaction
- `GameControlPanel` is the single source for live-game and setup controls:
  - takeback
  - pause and resume
  - resign and draw
  - enter and exit in-game analysis
  - enter, confirm, and cancel board edit
  - start game from setup
- `PanelSurface`, `ButtonGroup`, and `SidePanelButton` own control markup.
- `PlayerPanel` remains display-focused for players, clocks, and engine status, with the explicit exception that clicking an engine-controlled seat's displayed engine name opens the player-engine selection flow for that seat.
- `GameView` derives captured-material groups from the visible position and passes them to `PlayerPanel`, which stays display-focused for the player strips.
- `StatusCard` and `ClockDisplay` own player readout markup.

### Settings And Engine Management
- `SettingsView` owns settings and engine-inventory workflows.
- `FormSection`, `FieldRow`, `TextField`, `SelectField`, `ToggleField`, `NumberField`, `SettingsActionButton`, `ItemList`, `InlineMessage`, and `EmptyState` provide the required settings and inventory render building blocks.
- `SettingsSection` and `EngineInventoryEditor` are template-free adapters over those common form and list components.
- `TabbedView` and `TabButton` also support top-level settings category switching, with `SettingsView` mapping selection to `/settings/:category`.
- Engine inventory edits stay in the same pending settings draft as the other categories until `Apply` or `Save` is chosen.
- `SettingsView` keeps `Cancel`, `Save`, and `Apply` in the primary bottom-right action row, while `Reset` stays in a separate secondary settings action area.

### Modal And Confirmation Flows
- `ModalDialog`, `DialogButton`, `FormSection`, `FieldRow`, and form-field controls own shared confirmation and modal form markup.
- Concrete flows such as new game, promotion selection when hosted as a dialog, prune confirmation, invalid-load errors, reset-settings prompts, blocked board-edit explanations, player-engine seat selection, and analysis-engine selection stay in their owning feature components or views.

## Building Block Verification
The common layer is complete for the current baseline when it can render:

- shell layout and navigation: `WorkspaceShell`, `ToolbarStrip`, `TabbedView`, `TabButton`
- button families: menu, dialog, home, side-panel, tab, settings, and piece-choice buttons
- board UI: `BoardGrid`, `SquareSurface`, `ChessPiece`, `AnalysisChessPieceButton`, `ButtonGroup`
- panel and list UI: `PanelSurface`, `ButtonGroup`, `ItemList`, `TreeView`, `StatusCard`, `ClockDisplay`, `EmptyState`, `InlineMessage`
- forms: `FormSection`, `FieldRow`, `TextField`, `SelectField`, `ToggleField`, `NumberField`
- modal flows: `ModalDialog`, `DialogButton`
- piece-choice flows: `AnalysisChessPieceButton`, `PiecePalette`

## Abstraction Rules
- Views compose screen regions and connect them to stores; they contain no template markup.
- Feature components own one interaction surface each and contain no template markup.
- Common components handle all render markup, layout, form, tab, dialog, and button behaviour.
- Repeated structures should be extracted into common render building blocks before large nested templates form.
