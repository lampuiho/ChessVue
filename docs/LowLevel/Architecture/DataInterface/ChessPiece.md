# Chess Piece Types

## Purpose
Define the smallest chess-specific value objects shared by board, move, and game-document types.

## Types
- `enum PlayerColour`
- `enum PieceKind`
- `type BoardId = number`

## Interfaces
- `interface IChessPiece`

## Data Structures
```ts
enum PlayerColour {
  White = "white",
  Black = "black"
}

enum PieceKind {
  King = "king",
  Queen = "queen",
  Rook = "rook",
  Bishop = "bishop",
  Knight = "knight",
  Pawn = "pawn"
}

interface IChessPiece {
  kind: PieceKind
  colour: PlayerColour
}
```

## Notes
- `BoardId` is the serialisable board coordinate used across board, move, and analysis payloads.
- `BoardId = file + rank * 8` with `0 <= file, rank < 8`, producing `0..63`.
- Only standard chess pieces are baseline.
