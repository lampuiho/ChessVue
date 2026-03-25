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
  piecesByBoardId: Partial<Record<BoardId, IChessPiece>>
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  enPassantTargetId: BoardId | null
  halfMoveClock: number
  fullMoveNumber: number
}
```

## Ownership
- `GameRuleService` validates and mutates `IBoardPosition`.
- `SerializationService` persists `IBoardPosition` inside `IGameWorkspace`.
- `AnalysisStore` keys engine output by derived structural position identity, not stored FEN.
