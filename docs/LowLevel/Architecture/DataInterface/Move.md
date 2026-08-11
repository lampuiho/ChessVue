# Move Tree Types

## Purpose
Define move payloads and tree structures for live play, history review, and analysis branches.

## Types
- `enum MoveKind`
- `enum MoveNodeKind`
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

enum MoveNodeKind {
  Live = "live",
  Analysis = "analysis"
}

interface IMove {
  from: BoardId
  to: BoardId
  kind: MoveKind
  movingColour: PlayerColour
  promotionPiece?: PieceKind
  $?: {
    ponderMove?: IMove
    san?: string
    uci?: string
  }
}

type MovePath = number[]

interface IMoveNodeRuntime {
  parent?: IMoveNode
  isHighlighted?: boolean
}

interface IPromoMove : IMove {
  kind: MoveKind.Promotion
  promotionPiece: PieceKind
}

interface IMoveNode {
  kind: MoveNodeKind
  move?: IMove
  position: IBoardPosition
  clockSnapshot?: IClockSnapshot
  plyIndex: number
  mainlineChildIndex?: number
  children: IMoveNode[]
  $?: IMoveNodeRuntime
}

interface IMoveTree {
  root: IMoveNode
}
```

## Notes
- Persisted move trees are single-direction nested structures rooted at `root`.
- `mainlineChildIndex` selects the current live continuation from the node's local `children` array and lets `MoveHistoryService` rewrite that continuation without global node identity.
- Analysis-only branches remain in the tree even when the visible screen returns to the live node.
- Omitted `move`, `clockSnapshot`, `mainlineChildIndex`, or `promotionPiece` fields mean that value is not applicable for the current node or move.
- `clockSnapshot` is stored on the root node and on live nodes so time-aware takeback and restore flows can reconstruct the authoritative clock state. Analysis-only nodes may omit it.
- `BoardId` uses `0..63`, `BoardId % 8` is the file and `Math.floor(BoardId / 8)` is the rank.
- `IMove` stays structural. SAN, UCI, and an engine-suggested ponder reply are runtime-only metadata and are not part of the canonical persisted shape.
- `IMoveNode.kind` only distinguishes committed live nodes from analysis-only nodes. Alternative live continuations remain `live` nodes; `mainlineChildIndex` decides which continuation is currently authoritative.
- `IMoveNode.$` is runtime-only. Hydration rebuilds `$.parent`, `$.isHighlighted`, and any later runtime helpers, and persistence strips all `$` data.
- `MovePath` is the persisted selector used by workspace state to point to one node by traversal from the root.
- Each `MovePath[index]` value is the zero-based index into the current node's `children` array at that traversal step.
- Example: `[1, 0, 2]` means `root.children[1].children[0].children[2]`.
