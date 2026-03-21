# MoveUpdateService

## Purpose
Own the move-tree operations shared by live play, history review, setup, and analysis branches.

## Public Interface
```ts
createMoveTree(boardRoot: IBoardPosition): IMoveTree
addMainlineMove(tree: IMoveTree, parentNodeId: string, move: IMove, position: IBoardPosition): IMoveTree
addAnalysisMove(tree: IMoveTree, parentNodeId: string, move: IMove, position: IBoardPosition): IMoveTree
navigateToNode(tree: IMoveTree, nodeId: string): IMoveTree
getPosition(tree: IMoveTree, nodeId: string): IBoardPosition
takeBack(tree: IMoveTree, moveCount: number): IMoveTree
rewriteMainline(tree: IMoveTree, parentNodeId: string, childNodeId: string): IMoveTree
pruneFutureMoves(tree: IMoveTree, nodeId: string, allowRootPrune: boolean): IMoveTree
replaceBoardRoot(boardRoot: IBoardPosition): IMoveTree
```

## Responsibilities
- maintain mainline and sibling variation structure
- support history review and analysis-only branching
- expose deterministic node navigation and position lookup for board, history, and analysis views
- support takeback-style rewinds without leaking tree internals to stores
- preserve old continuations as variations when rewriting the mainline
- clear prior move history after confirmed board edit

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-HIST-01`
- `SCN-HIST-02`
- `SCN-HIST-03`
- `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-02`
- `SCN-ANALYSIS-04`
- `SCN-CTRL-01`
