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
  piecesBySquare: Record<SquareId, IChessPiece>
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  enPassantTarget?: SquareId
  halfMoveClock: number
  fullMoveNumber: number
}
```

## Ownership
- `GameRuleService` validates and mutates `IBoardPosition`.
- `SerializationService` persists `IBoardPosition` inside `IGameWorkspace`.
- `AnalysisStore` keys engine output by position identity as `fen`.
