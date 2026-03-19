# DomainLogic/MoveUpdateService.md
# MoveUpdateService Module (Domain Logic)

## Purpose
Manage the branchable move tree and navigate game history. This module is pure data transformation and does not depend on other domain modules.

## Data Interfaces
- IMove and IMoveNode, IMoveTree (from DataInterface/Move.md)
- IGame (from DataInterface/Game.md)

## Module Functions
- createMoveTree(initialPosition: IChessboardState): IMoveTree
- addMainlineMove(hist: IMoveTree, move: IMove): IMoveTree
- addBranchMove(hist: IMoveTree, move: IMove, parentNodeId: string): IMoveTree
- navigateToNode(hist: IMoveTree, nodeId: string): IMoveTree
- getCurrentPosition(hist: IMoveTree): IChessboardState
- getMainline(hist: IMoveTree): IMove[]
- takeBack(hist: IMoveTree, count: number): IMoveTree
- pruneFutureNodes(hist: IMoveTree, nodeId: string): IMoveTree
- replaceCurrentLine(hist: IMoveTree, moveSequence: IMove[]): IMoveTree

## Calls
- none
