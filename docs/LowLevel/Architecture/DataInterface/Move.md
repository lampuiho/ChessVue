# Move Tree Types

## Purpose
Define move payloads and tree structures for live play, history review, and analysis branches.

## Types
- `enum MoveKind`
- `enum MoveNodeKind`
- `type MovePath`

## Interfaces
- `interface IMove`
- `interface IMoveRaw`
- `interface IMoveRuntime`
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

interface IMoveRaw {
  from: BoardId
  to: BoardId
  promotionPiece?: PieceKind
  $?: IMoveRuntime
}

interface IMove extends IMoveRaw {
  kind: MoveKind
  movingColour: PlayerColour
  movingPiece: PieceKind
  capturePiece?: PieceKind
  checkState?: CheckState
  ambiguityKind?: AmbiguityKind
}

interface IMoveRuntime {
  ponderMove?: IMove
  san?: string
  uci?: string
}

type MovePath = readonly number[]

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
- `IMoveRaw` is the UCI-internal coordinate shape. `GameRuleUtility.genDetailedMove(...)` enriches it into `IMove` before it crosses the engine-client boundary.
- `IMove` persists the chess facts needed to derive SAN without a board position. `MoveNotationUtility.getSan(...)` and `getUci(...)` populate runtime-only read-through caches so repeated presentation and protocol consumers reuse the same notation. An engine-suggested ponder reply is also runtime-only but is runtime intent rather than a derived cache.
- `IMove.checkState` persists whether the destination gives check or checkmate. `CheckState.Checkmate` is move and position information rather than a `GameState`; game completion remains represented by `resultState` and `resultReason`.
- `IMoveNode.kind` only distinguishes committed live nodes from analysis-only nodes. Alternative live continuations remain `live` nodes; `mainlineChildIndex` decides which continuation is currently authoritative.
- `IMoveNode.$` is runtime-only. Hydration rebuilds `$.parent`; `$.isHighlighted` is reserved for the deferred event-driven UI highlight state. Persistence omits all `$` data.
- `MovePath` is the persisted selector used by workspace state to point to one node by traversal from the root.
- Each `MovePath[index]` value is the zero-based index into the current node's `children` array at that traversal step.
- Example: `[1, 0, 2]` means `root.children[1].children[0].children[2]`.
