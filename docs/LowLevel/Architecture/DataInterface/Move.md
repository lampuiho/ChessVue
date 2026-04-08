# Move Tree Types

## Purpose
Define move payloads and tree structures for live play, history review, and analysis branches.

## Types
- `enum MoveKind`
- `enum MoveBranchKind`
- `type MovePath`

## Interfaces
- `interface IMove`
- `interface IMoveNodeRuntime`
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

type MovePath = number[]

interface IMoveNodeRuntime {
  parent?: IMoveNode
}

interface IPromoMove : IMove {
  kind: MoveKind.Promotion
  promotionPiece: PieceKind
}

interface IMoveNode {
  branchKind: MoveBranchKind
  move: IMove | null
  position: IBoardPosition
  clockSnapshot: IClockSnapshot | null
  plyIndex: number
  mainlineChildIndex: number | null
  children: IMoveNode[]
  $?: IMoveNodeRuntime
}

interface IMoveTree {
  root: IMoveNode
}
```

## Notes
- Persisted move trees are single-direction nested structures rooted at `root`.
- `mainlineChildIndex` selects the main continuation from the node's local `children` array and lets `MoveUpdateService` rewrite the main continuation without global node identity.
- Analysis-only branches remain in the tree even when the visible screen returns to the live node.
- `clockSnapshot` is stored on the root node and on live/mainline nodes so time-aware takeback and restore flows can reconstruct the authoritative clock state. Analysis-only nodes may store `null`.
- `BoardId` uses `0..63`, `BoardId % 8` is the file and `Math.floor(BoardId / 8)` is the rank.
- `IMove` stays structural. SAN and UCI are runtime-only metadata and are not part of the canonical persisted shape.
- `IMoveNode.$` is runtime-only. Hydration rebuilds `$.parent` and any later runtime helpers, and persistence strips all `$` data.
- `MovePath` is the persisted selector used by workspace state to point to one node by traversal from the root.
- Each `MovePath[index]` value is the zero-based index into the current node's `children` array at that traversal step.
- Example: `[1, 0, 2]` means `root.children[1].children[0].children[2]`.
