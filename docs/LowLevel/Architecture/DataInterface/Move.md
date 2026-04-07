# Move Tree Types

## Purpose
Define move payloads and tree structures for live play, history review, and analysis branches.

## Types
- `enum MoveKind`
- `enum MoveBranchKind`

## Interfaces
- `interface IMove`
- `interface IMoveNode`
- `interface IMoveTree`

## Data Structures
```ts
enum MoveKind {
  Normal = "normal",
  Castle = "castle",
  EnPassant = "enPassant",
  Promotion = "promotion"
}

enum MoveBranchKind {
  Mainline = "mainline",
  Variation = "variation",
  Analysis = "analysis"
}

interface IMove {
  from: BoardId
  to: BoardId
  kind: MoveKind
  movingColour: PlayerColour
  promotionPiece?: PieceKind | null
  $?: {
    san?: string
    uci?: string
  }
}
interface IPromoMove : IMove {
  kind: MoveKind.Promotion
  promotionPiece: PieceKind
}

interface IMoveNode {
  id: string
  parentId: string | null
  childIds: string[]
  branchKind: MoveBranchKind
  move: IMove | null
  position: IBoardPosition
  clockSnapshot: IClockSnapshot | null
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
- `clockSnapshot` is stored on the root node and on live/mainline nodes so time-aware takeback and restore flows can reconstruct the authoritative clock state. Analysis-only nodes may store `null`.
- `BoardId` uses `0..63`, `BoardId % 8` is the file and `Math.floor(BoardId / 8)` is the rank.
- `IMove` stays structural. SAN and UCI are runtime-only metadata and are not part of the canonical persisted shape.
