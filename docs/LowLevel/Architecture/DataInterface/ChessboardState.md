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
  isCheckStateCached?: boolean
  isStandardInitialPosition?: boolean
  fen?: string
}
```

## Ownership
- `GameRuleUtility` creates and validates `IBoardPosition`; `MoveApplicationService.applyMove` and its board-edit operations mutate a caller-owned position, while `genPosition` copies the mutable board array and castling availability before replaying moves when a detached position is required. Immutable `IChessPiece` values are shared so piece identity survives reconstruction and animation.
- `SerializationService` persists `IBoardPosition` inside `IGame`.
- `GamesStore` keys persisted analysis snapshots by derived structural position identity, not stored FEN.
- `$.checkState`, `$.isCheckStateCached`, `$.isStandardInitialPosition`, and `$.fen` are runtime-only derived caches. `GameRuleUtility.createInitialBoardPosition(...)` marks the known standard root immediately.
- `CheckState.Checkmate` describes the chess state of a materialised position; it is never a terminal `GameState`. The persisted winning outcome belongs to `IGame.resultState` and `resultReason`, while the detailed move also retains its resulting check state.
- `GameRuleUtility.getCheckState(...)` caches both check and no-check results; `isCheckStateCached` distinguishes an uncached lookup from a cached `undefined` result. `GameRuleUtility.isStandardInitialPosition(...)` caches its boolean result.
- `MoveNotationUtility.buildFen(...)` caches FEN on the position because engine and identity consumers can request the same deterministic projection repeatedly.
- These query functions are semantically reads but may initialise `$`. They stay in the chess utilities because the layer model does not permit a utility-to-service fetch for derived chess data, and keeping the cache beside the derivation avoids repeated calculation or duplicated lookup logic in every caller.
- Normal move application mutates the supplied position and drops invalidated runtime cache values. `GamesStore.toggleChessPiece(...)`, `deleteChessPiece(...)`, and `clearBoard(...)` also invalidate runtime metadata at their effective mutation points. Full replacement positions retain their supplied runtime state, and unknown roots are verified lazily by the UCI command builder.
- `board` is always a `64`-entry array indexed directly by `BoardId`.
- An omitted `enPassantTarget` means no en-passant capture is currently available.
