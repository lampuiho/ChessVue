# Board Position Types

## Purpose
Define the serialisable board state used by rules, move application, persistence, and restore.

## Interfaces
- `interface ICastlingAvailability`
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
  enPassantTarget: BoardId | null
  halfMoveClock: number
  fullMoveNumber: number
}
```

## Ownership
- `GameRuleService` validates and mutates `IBoardPosition`.
- `SerializationService` persists `IBoardPosition` inside `IGameWorkspace`.
- `AnalysisStore` keys engine output by derived structural position identity, not stored FEN.
- `board` is always a `64`-entry array indexed directly by `BoardId`.
