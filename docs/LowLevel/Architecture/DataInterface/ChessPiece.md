# IChessPiece / PieceType / PlayerColour

## Purpose
Define a standardized chess piece model used by rules, board rendering, and serialization.

## Interfaces
- `PieceType` (`"king" | "queen" | "rook" | "bishop" | "knight" | "pawn"`)
- `PlayerColour` (`"white" | "black"`)
- `IChessPiece`

## Data Structures
- `interface IChessPiece {
  id: string
  type: PieceType
  color: PlayerColour
  square: string
  hasMoved: boolean
  captured: boolean
}

- `type PieceSymbol = "K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p"`
