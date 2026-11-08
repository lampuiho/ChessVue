# MoveHistoryService

## Purpose
Own in-place move-tree mutation and read-only move-sequence traversal shared by live play, history review, and analysis branches.

## Public Interface
```ts
// src/domain/MoveHistoryService.ts
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
- `addMainlineMove` and `addAnalysisMove` attach a new child directly to the supplied parent, set its runtime `$.parent`, and return that attached node handle. `addMainlineMove` creates a `Live` node and makes it the parent's mainline child; `addAnalysisMove` creates an `Analysis` node that reuses the parent's clock snapshot and leaves the mainline unchanged. They do not replace or wrap the tree. **Why:** selection caches, history UI, and parent traversal retain node and tree identities; cloning the tree for a local edit would invalidate those handles and require unrelated selectors to change authority.
- `takeBack` finds the retained ancestor (stopping at the root), prunes its descendants in place, and returns that retained node handle so the store can update its paths. A non-positive count returns the supplied node unchanged. The existing `IMoveTree` object remains authoritative for the same identity reason; a future immutable tree is valid only if every node consumer receives stable replacement semantics and selectors/caches update atomically.
- `rewriteMainline` changes mainline selection and marks the selected continuation's mainline `Live` in place. It throws when the child does not belong to the parent.
- `pruneFutureMoves` clears the supplied node's descendants in place, preserving the tree and `children` array identities and clearing the removed children's runtime metadata.
- No mutation operation clones nodes or returns a replacement `{ root }` wrapper. Navigation paths and derived position/node caches remain store-owned concerns. **Why:** only the store knows whether a tree edit affects live selection, rendered selection, or both; moving those decisions into the tree service would couple structural mutation to workspace state.
- `getMoveSequence` is read-only and returns the existing move references along the requested route. Its optional `fromPath` must be a prefix of `toPath` and establishes the incremental-replay seam; an invalid path throws. **Why:** tree traversal should support full reconstruction and later step-by-step animation without storing positions on nodes or teaching this service board-mutation rules.
- Move and clock-snapshot arguments are already stable history records supplied by their owning workflows. Adding a node transfers those references into the tree rather than cloning them; later clock transitions create new snapshots instead of mutating snapshots retained by history.

## Responsibilities
- maintain mainline and sibling variation structure
- support history review and analysis-only branching
- mutate hydrated nodes whose runtime-only `$` metadata provides parent traversal. Hydration rebuilds `$.parent` before node actions are enabled because persisting back-references would make JSON cyclic, while omitting them breaks membership checks, path derivation, takeback, and rewrite on loaded games
- preserve old continuations as variations when rewriting the mainline
- prune superseded descendant continuations when store policy requests it
- carry root and live-node clock snapshots in the tree
- remain limited to tree mutation while the store owns rendered and live selection

## Callers
- `GamesStore` composables: `GameMoveComposable` (commits, analysis branches, rewinds and root replacement), `GamePositionComposable` (path-to-position projection) and `GameWorkspaceComposable` (initial trees).
- Presentation reads `getMoveSequence` for detached preview boards and captured-piece projection in `GameView`, `GameControlPanel` and `SavedGamesView`. These are narrow reads under the [dependency rules](../index.md#dependency-rules).

## Dependencies
- shared move-tree contracts only

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-HIST-01`
- `SCN-HIST-02`
- `SCN-HIST-03`
- `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-02`
- `SCN-ANALYSIS-04`
- `SCN-CTRL-01`
