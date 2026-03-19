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
### Views
- [GameView](Presentation/Views/Game.md)
- [HomeView](Presentation/Views/Home.md)
- [SettingsView](Presentation/Views/Settings.md)
### Components
- [ChessPiece](Presentation/Components/ChessPiece.md)
- [Chessboard](Presentation/Components/Chessboard.md)
- [PlayerPanel](Presentation/Components/PlayerPanel.md)
- [AnalysisPanel](Presentation/Components/AnalysisPanel.md)
- [HistoryPanel](Presentation/Components/HistoryPanel.md)
- [GameControlPanel](Presentation/Components/GameControlPanel.md)
- [MenuBar](Presentation/Components/MenuBar.md)
- [NewGameModal](Presentation/Components/NewGameModal.md)
- [GameTabs](Presentation/Components/GameTabs.md)

## Full Call Graph (Low Level)

### Domain -> Platform
- `FileIOAdapter` uses `SerializationService`.
- `EnginesStore` uses `ProcessManager`.

### Domain -> Domain
- Independent domain modules; no same-layer calls.

### State -> Domain
- `GamesStore` uses `GameRuleService`, `MoveUpdateService`, `TimeControlService`, `SerializationService`.
- `AnalysisStore` uses `EnginesStore` and `ProcessManager`.
- `SettingsStore` and `UiStateStore` use `StorageAdapter`.

### Presentation -> State/Domain
- `GameView` uses `GamesStore`, `UiStateStore`, `AnalysisStore`, and `GameRuleService`.
- `ChessboardComponent` uses `GameRuleService`.
- `HistoryPanelComponent` uses `MoveUpdateService`.
- `SettingsView` uses `SettingsStore`, `EnginesStore`, and `UiStateStore`.
- `MenuBarComponent` uses `GamesStore`, `FileIOAdapter`, and `UiStateStore`.
- `HomeView` uses `GamesStore` and `UiStateStore`.
- `NewGameModal` uses `GamesStore` and `UiStateStore`.

## Notes
- Each module file contains function names and the cross-module calls in the given low-level design.
- This map is the single source for architecture dependencies and module responsibilities.