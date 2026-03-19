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
- [EngineAdapter](PlatformAbstraction/EngineAdapter.md)

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

## Flow Validation

The following flow checks the plan scenarios and the module function chain.

1) New game creation flow:
- `NewGameModal.submit` calls `GamesStore.createGame`
- `GamesStore.createGame` calls domain helpers:
  - `GameRuleService.loadPositionFromFEN` (starting position)
  - `MoveUpdateService.createMoveTree`
  - `TimeControlService.initializeClockState`
  - Persist via `StorageAdapter.setItem`
- `GamesStore.createGame` returns new `IGame` and `UiStateStore.openTab`

2) Make move flow:
- `Chessboard.emitMove` → `GameView.onMoveAttempt`
- `GameView` calls `GamesStore.makeMove`
- `GamesStore.makeMove` calls:
  - `GameRuleService.isMoveLegal` (legal validation on `game.currentPosition`)
  - `MoveUpdateService.addMoveToMainline(game.moveTree, move)` (history update)
  - `MoveUpdateService.getCurrentPosition(updatedMoveTree)` (compute current position from history)
  - `GameRuleService.applyMove(game.currentPosition, move)` (apply move to board)
  - `TimeControlService.updateClockAfterMove(game.clockState, move)`
  - persist via `GamesStore.saveGame` and `StorageAdapter.setItem`
- `GamesStore.makeMove` returns success boolean; game position and move tree history are now both updated in `IGame`
- `GameView.onTakeBack` calls `GamesStore.takeBack`; `GamesStore.takeBack` calls `MoveUpdateService.takeBack(game.moveTree, count)` and updates `game.currentPosition`
- `GameView.onEnterAnalysis` calls `GamesStore.enterAnalysisMode`
- In analysis mode, `GameView.onMoveAttempt` calls `GamesStore.makeMove`; `GamesStore.addMoveBranchInternal` uses `MoveUpdateService.addMoveBranch`
- `GameView` can enter free board setup mode: `GamesStore.enterFreeBoardSetupMode`
- After setup, `GamesStore.applyFreeBoardSetup` calls `MoveUpdateService.createMoveTree`, `GamesStore.clearHistory` resets move tree and history variables
- Start player game from setup with `GamesStore.startGameFromSetupPosition`
- `GamesStore.switchPlayer` supports mid-game human/engine switching
- UI updates `PlayerPanel`, `HistoryPanel`, `AnalysisPanel`

3) End game flows:
- `GameControlPanel.onResign` → `GamesStore.resignGame` → `GamesStore.setGameStatus(playerResigned ? "resigned" : "abandoned")`
- `TimeControlService.isFlagFall` triggers `GamesStore.setGameStatus` with winner and flag info
- `GameRuleService.evaluateGameStatus` detects checkmate/stalemate and `GamesStore.setGameStatus`

4) Player/engine mode and unified move loop:
- Every game has two player profiles: `IGame.white` and `IGame.black`, each `IPlayer.type` is `"human" | "remote" | "engine"`.
- Starting a game selects two player profiles for the slots rather than a separate game mode switch.
- On turn, `GamesStore.requestMoveFromCurrentPlayer(gameId)` handles:
  - `human`: wait for UI move input from `GameView.onMoveAttempt`
  - `remote`: wait for network move event
  - `engine`: call `EngineAdapter.sendCommand` and parse engine move responses
- `GamesStore.makeMove` is used for both human and engine moves. The same move application flow updates `MoveUpdateService` history and current position.
- `GameView` or `GameControlPanel` can start/resume the unified move loop; it does not require separate engine-vs-engine methods.

5) Analysis flow:
- `AnalysisPanel` requests evaluation via `AnalysisStore.requestEvaluation`
- `AnalysisStore.requestEvaluation` calls:
  - `EnginesStore.getEngineById`
  - `EngineAdapter.initializeEngine` if needed
  - `EngineAdapter.sendCommand` + `EngineAdapter.readLine`
  - `AnalysisStore.storeEvaluation`

4) Save/load flow:
- `MenuBar.onSaveGame` → `GamesStore.exportGameToFile` → `FileIOAdapter.saveGameToFile` → `SerializationService.serializeGameToJSON`
- `MenuBar.onLoadGame` → `FileIOAdapter.loadGameFromFile` → `SerializationService.deserializeGameFromJSON` → `GamesStore.replaceGame`

5) Settings flow:
- `SettingsView.onSave` → `SettingsStore.saveSettings` → `StorageAdapter.setItem`
- `App`/`GameView` uses settings for theme and board options.

### Validation Outcome
- Each flow step is represented by at least one exposed function in a module.
- Private helper functions exist for implementation-critical actions (FEN parse/build, move node creation, engine output parsing, state persistence).
- Same-layer independence is preserved.

## Notes
- Each module file contains function names and cross-module calls in the low-level design.
- This map is the single source for architecture dependencies and module responsibilities.