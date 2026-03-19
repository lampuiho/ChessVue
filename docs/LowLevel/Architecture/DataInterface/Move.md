# Move / MoveNode / MoveTree

## Purpose
Define move payloads and history node structures for branchable move trees.

## Interfaces
- `MoveType` (`"normal" | "castle" | "en_passant" | "promotion"`)
- `IMove`
- `IMoveNode`
- `IMoveTree`

## Data Structures
- `interface IMove {
  from: string
  to: string
  promotion?: PieceType
  san?: string
  uci?: string
  capturedPiece?: PieceType
  moveNumber: number
  player: PlayerColour
  flags?: string
}

- `interface IMoveNode {
  id: string
  move: IMove | null
  parentId: string | null
  children: string[]
  fen: string
  evaluation?: number
}

- `interface IMoveTree {
  nodes: Record<string, IMoveNode>
  rootId: string
  currentNodeId: string
  mainlineIds: string[]
}
