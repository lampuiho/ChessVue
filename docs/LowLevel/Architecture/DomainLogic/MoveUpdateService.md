# MoveUpdateService Module (Domain Logic)

## Purpose
Manage move tree, branching, navigation, and history operations.

## Interfaces
- `MoveNode`
- `MoveTree`
- `IGame`

## Module Functions
- `createMoveTree(initialPosition: IChessboardState): MoveTree`
- `addMainlineMove(game: IGame, move: Move): IGame`
- `addAnalysisMove(game: IGame, move: Move): IGame`
- `navigateToNode(game: IGame, nodeId: string): IGame`
- `getCurrentPosition(game: IGame): IChessboardState`
- `getMainline(game: IGame): Move[]`
- `takeback(game: IGame, moves: number): IGame`
- `pruneFutureMoves(game: IGame, nodeId: string): IGame`

## Called By
- `GamesStore.makeMove`
- `GamesStore.takeBack`
- `GameView.onHistoryClick`
- `HistoryPanel.render`

## Calls
- `GameRules.isMoveLegal`
- `GameRules.applyMove`
- `Serialization.serializeGame`
- `Serialization.deserializeGame`
