# Chess Piece Types

## Purpose
Define the smallest chess-specific value objects shared by board, move, and game-document types.

## Types
- `type PlayerColour = "white" | "black"`
- `type PieceKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn"`
- `type SquareId = string`

## Interfaces
- `interface IChessPiece`

## Data Structures
```ts
interface IChessPiece {
  kind: PieceKind
  colour: PlayerColour
}
```

## Notes
- `SquareId` is the serialisable board coordinate token used across board, move, and analysis payloads.
- Only standard chess pieces are baseline.
