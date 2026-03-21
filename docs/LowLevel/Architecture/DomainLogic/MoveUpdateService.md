# MoveUpdateService

## Purpose
Own the move-tree operations shared by live play, history review, setup, and analysis branches.

## Public Interface
```ts
createRootTree(boardRoot: IBoardPosition): IMoveTree
appendMainlineMove(tree: IMoveTree, parentNodeId: string, move: IMove, position: IBoardPosition): IMoveTree
appendAnalysisMove(tree: IMoveTree, parentNodeId: string, move: IMove, position: IBoardPosition): IMoveTree
setVisibleNode(tree: IMoveTree, nodeId: string): IMoveTree
rewriteMainline(tree: IMoveTree, parentNodeId: string, childNodeId: string): IMoveTree
pruneFuture(tree: IMoveTree, nodeId: string, allowRootPrune: boolean): IMoveTree
replaceBoardRoot(boardRoot: IBoardPosition): IMoveTree
```

## Responsibilities
- maintain mainline and sibling variation structure
- support history review and analysis-only branching
- preserve old continuations as variations when rewriting the mainline
- clear prior move history after confirmed board edit

## Scenario Coverage
- `SCN-HIST-01`
- `SCN-HIST-02`
- `SCN-HIST-03`
- `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-02`
- `SCN-ANALYSIS-04`
