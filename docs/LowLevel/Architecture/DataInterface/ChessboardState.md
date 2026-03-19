# IChessboardState / Square / Color Interfaces

## Purpose
Define core chessboard data structures for board state and spatial references.

## Interfaces
- `Square` (e.g. from "e2" to "e4")
- `BoardColor` (`"white" | "black"`)
- `IChessboardState`
- `BoardLayout`

## Data Structures
- `type Square = string` (algebraic position)
- `type BoardColor = "white" | "black"`
- `interface BoardLayout { [square: string]: string | null }` (FEN-style mapping)
- `interface IChessboardState {
  board: BoardLayout
  activeColor: BoardColor
  castlingRights: {
    whiteKingSide: boolean
    whiteQueenSide: boolean
    blackKingSide: boolean
    blackQueenSide: boolean
  }
  enPassantTarget: Square | null
  halfMoveClock: number
  fullMoveNumber: number
}

## Notes
This interface is shared across Domain Logic, State Management, and Presentation.
