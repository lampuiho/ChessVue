# GameView Component (Presentation)

## Purpose
Game screen orchestration: board, player panels, history panel, and controls.

## Interfaces
- `GameViewProps`

## Component Methods
- `setup()`: initialize stores and local state
- `onMove(sanMove: string): void`
- `onTakeBack(): void`
- `onStartAnalysis(): void`
- `onGameOver(): void`
- `onTimerTick(deltaMs: number): void`

## Called By
- Vue Router route mount

## Calls
- `GamesStore.makeMove`
- `GamesStore.takeBack`
- `UiStateStore.setCurrentGameId`
- `AnalysisStore.listEvaluations`
- `GameRules.isMoveLegal`
- `ChessboardComponent.emitMove`
