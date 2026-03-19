# Presentation/Views/Game.md
# GameView Component (Presentation)

## Purpose
Orchestrate the game screen: board, panels, move history, and game controls.

## Data Interfaces
- IGame (from DataInterface/Game.md)
- IChessboardState (from DataInterface/ChessboardState.md)

## Component Methods
- setup()
- onMoveAttempt(move: Move): void
- onTakeBack(): void
- onEnterAnalysis(): void
- onTimerTick(deltaMs: number): void
- onGameOver(): void

## Calls
- GamesStore.makeMove
- GamesStore.takeBack
- UiStateStore.setCurrentGameId
- AnalysisStore.listEvaluations
- GameRuleService.generateLegalMoves
- ChessboardComponent.emitMove
