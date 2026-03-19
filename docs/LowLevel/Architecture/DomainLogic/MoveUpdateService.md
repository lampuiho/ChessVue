# DomainLogic/MoveUpdateService.md
# MoveUpdateService Module (Domain Logic)

## Purpose
Manage branchable move tree history and current navigation state.

## Data Interfaces
- Move, IMoveNode, IMoveTree (from DataInterface/Move.md)
- IGame (from DataInterface/Game.md)

## Module Functions
- createMoveTree(initialPosition: IChessboardState): IMoveTree
- addMoveToMainline(tree: IMoveTree, move: IMove): IMoveTree
- addMoveBranch(tree: IMoveTree, move: IMove, parentId: string): IMoveTree
- navigateToNode(tree: IMoveTree, nodeId: string): IMoveTree
- getCurrentPosition(tree: IMoveTree): IChessboardState
- getMainlineMoves(tree: IMoveTree): IMove[]
- takeBack(tree: IMoveTree, count: number, allowAnalysisBranch?: boolean): IMoveTree
- pruneFutureNodes(tree: IMoveTree, fromNodeId: string): IMoveTree
- convertMoveTreeToPgn(tree: IMoveTree): string

## Private Helpers
- createMoveNode(move: IMove | null, parentId: string | null, fen: string): IMoveNode
- getNodeById(tree: IMoveTree, nodeId: string): IMoveNode | null
- resolvePathToRoot(tree: IMoveTree, nodeId: string): string[]

## Calls
- none
