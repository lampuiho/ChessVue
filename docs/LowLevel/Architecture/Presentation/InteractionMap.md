# Presentation Interaction Map

## Purpose
Map committed user interactions from the baseline scenarios to concrete view, component, and store boundaries.

This document verifies that presentation coverage is complete and that templates can stay shallow by delegating behaviour to named subcomponents.

## Interaction Coverage
### Startup And Home Actions
- Fresh launch and no-active-game fallback render in `HomeView`.
- `HomeView` uses `HomeMenuButton` for quick new game, custom new game, load game, and settings actions.
- Custom new game opens `NewGameModal`, which owns form composition but not game-creation decisions.

### Shell Navigation
- `MenuBar` owns shell-level actions for quick new, custom new, load, save, settings, and delete.
- `GameTabs` owns open-game switching and close actions, with `TabbedView` and `TabButton` handling route-driven tab interaction.
- `Router` and `UiStateStore` validate and persist route-level navigation state.

### Board And Move Input
- `Chessboard` owns board interaction entry points such as click-click move input, drag-drop, selection clearing, and board-edit confirmation.
- `BoardSquare`, `ChessPiece`, and `PiecePalette` keep board templates flat and isolate square, piece, and piece-choice rendering.
- `GameView` forwards board events to `GamesStore`, which remains the mutation boundary.

### History Navigation
- `HistoryPanel` owns node selection, prune entry, and return-to-live-node actions.
- `HistoryTree` renders nested move structure so `HistoryPanel` stays focused on panel state and emitted actions.

### Analysis Interaction
- `AnalysisPanel` owns refresh, retry, stop, engine-selection, and analysis-line selection actions.
- `AnalysisEngineSection` isolates per-engine status and line rendering so the panel does not become a deeply nested engine-and-lines template.

### Game Control Interaction
- `GameControlPanel` is the single source for live-game and setup controls:
  - takeback
  - pause and resume
  - resign and draw
  - enter and exit in-game analysis
  - enter, confirm, and cancel board edit
  - start game from setup
- `PlayerPanel` remains display-focused for players, clocks, and engine status rather than duplicating the same actions.

### Settings And Engine Management
- `SettingsView` owns settings and engine-inventory workflows.
- `FormSection`, `FieldRow`, `SettingsSection`, and `EngineInventoryEditor` keep settings templates shallow and separate generic form layout from engine-specific editing behaviour.

### Modal And Confirmation Flows
- `ModalDialog` and `DialogButton` own shared confirmation and submit/cancel structure.
- Concrete flows such as new game, prune confirmation, invalid-load errors, and reset-settings prompts stay in their owning feature components or views.

## Abstraction Rules
- Views compose screen regions and connect them to stores; they should not contain large inline control trees.
- Feature components own one interaction surface each and may delegate rendering-heavy subsections to named child components.
- Common components handle generic layout, form, tab, dialog, and button behaviour.
- Repeated domain-specific structures should be extracted into feature subcomponents before large nested templates form.
