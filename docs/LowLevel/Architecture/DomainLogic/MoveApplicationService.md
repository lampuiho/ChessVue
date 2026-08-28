# MoveApplicationService

## Purpose
Provide explicit in-place board-position mutations and a separate copied-position replay boundary.

## Public Interface
```ts
applyMove(position: IBoardPosition, move: IMove): IBoardPosition
genPosition(rootPosition: IBoardPosition, moves: readonly IMove[]): IBoardPosition
clearBoard(position: IBoardPosition): boolean
deletePiece(position: IBoardPosition, boardId: BoardId): boolean
movePiece(position: IBoardPosition, from: BoardId, to: BoardId): boolean
togglePiece(position: IBoardPosition, boardId: BoardId, piece: IChessPiece): boolean
```

## Mutation Contract
- `applyMove` mutates the supplied position and returns that position for chaining. It does not create a snapshot. **Why:** authoritative live and rendered state may intentionally share that position; returning a replacement would silently break the alias unless every consumer changed authority atomically. The `apply*` name makes caller ownership visible.
- `clearBoard`, `deletePiece`, `movePiece`, and `togglePiece` mutate the supplied position. They return whether an effective edit occurred and invalidate position runtime metadata after an effective edit. **Why:** only the owning workflow knows whether an effective edit should clear history or restart analysis, while only the mutator knows exactly which derived caches became stale. Delayed global invalidation would permit stale reads between those steps.
- `genPosition` is the copying boundary. It clones `rootPosition` once, replays the supplied moves into that clone, and leaves `rootPosition` untouched. **Why:** analysis, replay, and validation need independent mutation; sharing the board container would corrupt authority. A single operation that sometimes mutates and sometimes returns a copy was rejected because the call site could not prove ownership. Any replacement must keep mutation versus detachment explicit.
- Callers own legality checks, complete move construction, workflow ordering, history updates, and rollback policy. This service only applies an already accepted transition. **Why:** those side effects require live, analysis, or validation context that a board transition does not have; putting them here would force simulations and replays to perform live-game work.

## Responsibilities
- provide the layer-2 transition boundary for app workflows while delegating reusable chess mechanics to `GameRuleUtility`; stores must not call utility mutation directly because that would bypass the documented ownership contract, while duplicating the mechanics here would create two chess implementations
- apply complete moves to caller-owned positions in place
- replay a move sequence into a newly generated position when a detached snapshot is required
- provide direct board-edit mutations with explicit changed-state results
- invalidate cached position metadata after direct board edits

## Dependencies
- `GameRuleUtility`
