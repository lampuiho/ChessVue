# MoveUpdateService

## Purpose
Own the move-tree operations shared by live play, history review, setup, and analysis branches.

## Public Interface
```ts
createMoveTree(boardRoot: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree
addMainlineMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree
addAnalysisMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition): IMoveTree
getPosition(node: IMoveNode): IBoardPosition
takeBack(fromNode: IMoveNode, moveCount: number): IMoveTree
rewriteMainline(parentNode: IMoveNode, childNode: IMoveNode): IMoveTree
pruneFutureMoves(node: IMoveNode): IMoveTree
replaceBoardRoot(boardRoot: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree
```

## Responsibilities
- maintain mainline and sibling variation structure
- support history review and analysis-only branching
- expose deterministic position lookup and tree mutation against hydrated runtime node references
- support takeback-style rewinds without leaking tree internals to stores
- preserve old continuations as variations when rewriting the mainline
- support the store-owned automatic pruning action by removing superseded descendant continuations when live-play rules decide they should be discarded
- carry root and live/mainline node clock snapshots alongside the stored positions
- operate on hydrated nodes whose runtime-only `$` metadata provides parent traversal
- clear prior move history after confirmed board edit
- stay ownership-limited to tree mutation only; workspace navigation and live or visible selection remain store-owned concerns

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-HIST-01`
- `SCN-HIST-02`
- `SCN-HIST-03`
- `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-02`
- `SCN-ANALYSIS-04`
- `SCN-CTRL-01`
