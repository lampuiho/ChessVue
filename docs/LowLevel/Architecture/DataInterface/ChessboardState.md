# Board Position Types

## Purpose
Define the serialisable board state used by rules, move application, persistence, and restore.

## Interfaces
- `interface ICastlingAvailability`
- `interface IBoardPositionRuntime`
- `interface IBoardPosition`

## Data Structures
```ts
interface ICastlingAvailability {
  whiteKingSide: boolean
  whiteQueenSide: boolean
  blackKingSide: boolean
  blackQueenSide: boolean
}

interface IBoardPosition {
  board: (IChessPiece | undefined)[]
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  enPassantTarget?: BoardId
  halfMoveClock: number
  fullMoveNumber: number
  $?: IBoardPositionRuntime
}

interface IBoardPositionRuntime {
  checkState?: CheckState
  isStandardInitialPosition?: boolean
}
```

## Ownership
- `GameRuleUtility` creates and validates `IBoardPosition`; `MoveApplicationService.applyMove` and its board-edit operations mutate a caller-owned position, while `genPosition` clones a root before replaying moves when a detached position is required.
- `SerializationService` persists `IBoardPosition` inside `IGame`.
- `GamesStore` keys persisted analysis snapshots by derived structural position identity, not stored FEN.
- `$.checkState` and `$.isStandardInitialPosition` are runtime-only derived caches. `GameRuleUtility.createInitialBoardPosition(...)` marks the known standard root immediately.
- Normal move application mutates the supplied position and drops invalidated runtime cache values. `GamesStore.toggleChessPiece(...)`, `deleteChessPiece(...)`, and `clearBoard(...)` also invalidate runtime metadata at their effective mutation points. Full replacement positions retain their supplied runtime state, and unknown roots are verified lazily by the UCI command builder.
- `board` is always a `64`-entry array indexed directly by `BoardId`.
- An omitted `enPassantTarget` means no en-passant capture is currently available.
