# Move Tree Types

## Purpose
Define move payloads and tree structures for live play, history review, and analysis branches.

## Types
- `type MoveKind = "normal" | "castle" | "enPassant" | "promotion"`
- `type MoveBranchKind = "mainline" | "variation" | "analysis"`

## Interfaces
- `interface IMove`
- `interface IMoveNode`
- `interface IMoveTree`

## Data Structures
```ts
interface IMove {
  from: SquareId
  to: SquareId
  kind: MoveKind
  movingColour: PlayerColour
  promotionPiece: PieceKind | null
  san: string
  uci: string
}

interface IMoveNode {
  id: string
  parentId: string | null
  childIds: string[]
  branchKind: MoveBranchKind
  move: IMove | null
  position: IBoardPosition
  plyIndex: number
  mainlineChildId: string | null
}

interface IMoveTree {
  rootId: string
  nodeById: Record<string, IMoveNode>
}
```

## Notes
- `rootId` represents the starting board root for the workspace.
- `mainlineChildId` lets `MoveUpdateService` rewrite the main continuation without deleting sibling variations.
- Analysis-only branches remain in the tree even when the visible screen returns to the live node.
