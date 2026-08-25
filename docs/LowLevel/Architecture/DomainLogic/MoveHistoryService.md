# MoveHistoryService

## Purpose
Own in-place move-tree mutation and read-only move-sequence traversal shared by live play, history review, and analysis branches.

## Public Interface
```ts
createMoveTree(clockSnapshot?: IClockSnapshot): IMoveTree
addMainlineMove(parentNode: IMoveNode, move: IMove, clockSnapshot?: IClockSnapshot): IMoveNode
addAnalysisMove(parentNode: IMoveNode, move: IMove): IMoveNode
getMoveSequence(tree: IMoveTree, toPath: MovePath, fromPath?: MovePath): readonly IMove[]
takeBack(fromNode: IMoveNode, moveCount: number): IMoveNode
rewriteMainline(parentNode: IMoveNode, childNode: IMoveNode): void
pruneFutureMoves(node: IMoveNode): void
```

## Mutation Contract
- `createMoveTree` is the only factory. It creates a root-only tree when a caller needs a genuinely new history.
- `addMainlineMove` and `addAnalysisMove` attach a new child directly to the supplied parent and return that attached node handle. They do not replace or wrap the tree.
- `takeBack` finds the retained ancestor, prunes its descendants in place, and returns that retained node handle so the store can update its paths. The existing `IMoveTree` object remains authoritative.
- `rewriteMainline` changes mainline selection and node kinds in place.
- `pruneFutureMoves` clears the supplied node's descendants in place.
- No mutation operation clones nodes or returns a replacement `{ root }` wrapper. Navigation paths and derived position/node caches remain store-owned concerns.
- `getMoveSequence` is read-only and returns the existing move references along the requested route.

## Responsibilities
- maintain mainline and sibling variation structure
- support history review and analysis-only branching
- mutate hydrated nodes whose runtime-only `$` metadata provides parent traversal
- preserve old continuations as variations when rewriting the mainline
- prune superseded descendant continuations when store policy requests it
- carry root and live-node clock snapshots in the tree
- remain limited to tree mutation while the store owns rendered and live selection

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-HIST-01`
- `SCN-HIST-02`
- `SCN-HIST-03`
- `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-02`
- `SCN-ANALYSIS-04`
- `SCN-CTRL-01`
