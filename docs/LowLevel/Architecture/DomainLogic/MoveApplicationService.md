# MoveApplicationService

## Purpose
Provide the store-facing board-position transition boundary while preserving a stable service API for the planned mutable-board implementation.

## Public Interface
```ts
applyMove(position: IBoardPosition, move: IMove): IBoardPosition
```

## Responsibilities
- currently return a newly generated position without mutating the supplied position
- own every board-position transition: piece relocation, captures, castling rook movement, promotion, en-passant capture and target generation, castling availability, move clocks, side-to-move, and derived check-state transfer
- accept a canonical detailed `IMove`; legality and move-detail generation remain pure `GameRuleUtility` queries performed before this service boundary
- later own atomic board-position mutation without changing the `GamesStore` dependency boundary
- add `revertMove` with a rollback record when move nodes stop retaining complete positions; it is not needed while immutable per-node positions remain
