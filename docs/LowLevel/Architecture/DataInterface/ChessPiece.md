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
  readonly kind: PieceKind
  readonly colour: PlayerColour
}
```

## Notes
- `BoardId` is the serialisable board coordinate used across board, move, and analysis payloads.
- `BoardId = file + rank * 8` with `0 <= file, rank < 8`, producing `0..63`.
- `IChessPiece` is an immutable identity value whose square belongs only to the board container. Board-position copies duplicate the mutable board array but retain piece references. **Why:** moving the same reference lets presentation recognise one piece changing square; cloning pieces would turn every move into unrelated removal/addition identities, while storing a mutable square on the piece would create a second location authority that can disagree with the board. Any replacement must preserve one authoritative location and stable identity across ordinary moves and detached reconstruction.
- Promotion creates a new `IChessPiece` identity. **Why:** promotion replaces the pawn's chess identity rather than merely relocating it; reusing and mutating the pawn would break the immutability relied on by other positions sharing that piece reference.
- Only standard chess pieces are baseline.
