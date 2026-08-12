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
  checkState: CheckState
  $?: IBoardPositionRuntime
}

interface IBoardPositionRuntime {
  isStandardInitialPosition?: boolean
}
```

## Ownership
- `GameRuleService` creates and validates `IBoardPosition`; move application returns a new position rather than mutating the supplied position.
- `SerializationService` persists `IBoardPosition` inside `IGame`.
- `GamesStore` keys persisted analysis snapshots by derived structural position identity, not stored FEN.
- `$.isStandardInitialPosition` is a runtime-only cache. `undefined` means unverified, while `true` and `false` cache the completed verification used by engine position builders. `GameRuleService.createInitialBoardPosition(...)` marks the known standard root immediately.
- Normal move application returns a new position and does not inherit this cache. Until a dedicated board-position mutation API exists, full replacement positions retain their supplied runtime state and unknown roots are verified lazily by the UCI command builder.
- `board` is always a `64`-entry array indexed directly by `BoardId`.
- An omitted `enPassantTarget` means no en-passant capture is currently available.
