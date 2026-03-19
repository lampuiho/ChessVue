# Presentation/Views/Game.md
# GameView Component (Presentation)

## Purpose
Orchestrate the game screen: board, panels, move history, and game controls.

## Data Interfaces
- IGame (from DataInterface/Game.md)
- IChessboardState (from DataInterface/ChessboardState.md)

## Component Methods
- setup()
- onMoveAttempt(move: IMove): void
- onTakeBack(): void
- onResign(): void
- onEnterAnalysis(): void
- onExitAnalysis(): void
- onTimerTick(deltaMs: number): void
- onGameOver(): void

## Calls
- GamesStore.makeMove
- GamesStore.requestMoveFromCurrentPlayer
- GamesStore.enterAnalysisMode
- GamesStore.exitAnalysisMode
- GamesStore.takeBack
- GamesStore.resignGame
- GamesStore.enterFreeBoardSetupMode
- GamesStore.applyFreeBoardSetup
- GamesStore.clearHistory
- GamesStore.startGameFromSetupPosition
- GamesStore.switchPlayer
- UiStateStore.setCurrentGameId
- AnalysisStore.listEvaluations
- GameRuleService.generateLegalMoves
- ChessboardComponent.emitMove
