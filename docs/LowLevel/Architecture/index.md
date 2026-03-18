# ChessVue Low-Level Architecture Map

This folder contains low-level module design documents with function signatures, interfaces, and cross-module call dependencies.

## 1) Domain Logic
- [GameRule](DomainLogic/GameRuleService.md)
- [MoveUpdate](DomainLogic/MoveUpdateService.md)
- [TimeControl](DomainLogic/TimeControlService.md)
- [Serialization](DomainLogic/SerializationService.md)

## 2) Platform Abstraction
- [StorageAdapter](PlatformAbstraction/StorageAdapter.md)
- [FileIoAdapter](PlatformAbstraction/FileIoAdapter.md)
- [ProcessManager](PlatformAbstraction/ProcessManager.md)

## 3) State Management
- [GamesStore](StateManagement/GamesStore.md)
- [SettingsStore](StateManagement/SettingsStore.md)
- [AnalysisStore](StateManagement/AnalysisStore.md)
- [EnginesStore](StateManagement/EnginesStore.md)
- [UiStateStore](StateManagement/UiStateStore.md)

## 4) Presentation
- [Router](Presentation/Router.md)
- [GameView](Presentation/Views/GameView.md)
- [ChessboardComponent](Presentation/Components/Chessboard.md)
- [PlayerPanelComponent](Presentation/Components/PlayerPanel.md)
- [AnalysisPanelComponent](Presentation/Components/AnalysisPanel.md)
- [HistoryPanelComponent](Presentation/Components/HistoryPanel.md)
- [GameControlPanel](Presentation/Components/GameControlPanel.md)
- [MenuBarComponent](Presentation/Components/MenuBar.md)
- [SettingsView](Presentation/Views/SettingsView.md)

## Full Call Graph (Low Level)

### Domain -> Platform
- `GamesStore` uses `Serialization` and `StorageAdapter`.
- `FileIoAdapter` uses `Serialization`.
- `EnginesStore` uses `ProcessManager`.

### Domain -> Domain
- `MoveUpdateService` calls `GameRules`.
- `GameRules` calls `TimeControl`.
- `Serialization` references `MoveUpdateService` for move history.

### State -> Domain
- `GamesStore.makeMove` calls `MoveUpdateService.addMainlineMove`, `GameRules.isMoveLegal`, `TimeControl.updateClockAfterMove`.
- `AnalysisStore` uses `EnginesStore` and `ProcessManager`.

### Presentation -> State/Domain
- `GameView` calls `GamesStore`, `AnalysisStore`, `GameRules`, and dispatches UI events.
- `ChessboardComponent` calls `GameRules.generateLegalMoves` and emits move events to `GameView`.
- `HistoryPanelComponent` calls `MoveUpdateService.navigateToNode`.
- `SettingsView` calls `SettingsStore`, `EnginesStore`, and `UiStateStore`.
- `MenuBarComponent` calls `GamesStore`, `FileIoAdapter`, and `UiStateStore`.

## Notes
- Each module file contains function names and the cross-module calls in the given low-level design.
- This map is the single source for architecture dependencies and module responsibilities.