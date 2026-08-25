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
- `applyMove` mutates the supplied position and returns that position for chaining. It does not create a snapshot.
- `clearBoard`, `deletePiece`, `movePiece`, and `togglePiece` mutate the supplied position. They return whether an effective edit occurred and invalidate position runtime metadata after an effective edit.
- `genPosition` is the copying boundary. It clones `rootPosition` once, replays the supplied moves into that clone, and leaves `rootPosition` untouched.
- Callers own legality checks, complete move construction, workflow ordering, history updates, and rollback policy. This service only applies an already accepted transition.

## Responsibilities
- apply complete moves to caller-owned positions in place
- replay a move sequence into a newly generated position when a detached snapshot is required
- provide direct board-edit mutations with explicit changed-state results
- invalidate cached position metadata after direct board edits

## Dependencies
- `GameRuleUtility`
