# Move / MoveNotation / IMoveNode

## Purpose
Define move payloads and history node structures for branchable move trees.

## Interfaces
- `Move`
- `MoveType` (`"normal" | "castle" | "en_passant" | "promotion"`)
- `IMoveNode`
- `IMoveTree`

## Data Structures
- `interface Move {
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
  move: Move | null
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
