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
- `IMoveNode` stores a transition and history structure, not a board position. Selected positions are reconstructed from `IGame.rootPosition` and a move sequence. **Why:** a full mutable position per node would become a second persisted authority, replace piece identities during navigation, and prevent the step-by-step replay needed for movement animation. Reintroducing snapshots is safe only if they remain derived, preserve identity between adjacent positions, and cannot override the root-plus-moves authority.
- `mainlineChildIndex` selects the current live continuation from the node's local `children` array and lets `MoveHistoryService` rewrite that continuation without global node identity. `MoveNodeKind` records only committed-live versus analysis-only history. **Why:** mainline and variation are parent-child relationships that a rewrite can change without changing the child; encoding them as the child's kind would immediately make the kind stale. Any richer kind must describe an intrinsic persisted distinction.
- Analysis-only branches remain in the tree even when the visible screen returns to the live node.
- Omitted `move`, `clockSnapshot`, `mainlineChildIndex`, or `promotionPiece` fields mean that value is not applicable for the current node or move.
- `clockSnapshot` is stored on the root node and on live nodes so time-aware takeback and restore flows can reconstruct the authoritative clock state. Analysis-only nodes may omit it.
- `BoardId` uses `0..63`, `BoardId % 8` is the file and `Math.floor(BoardId / 8)` is the rank.
- `IMoveRaw` is the UCI-internal coordinate shape. `GameRuleUtility.genDetailedMove(...)` enriches it into `IMove` before it crosses the engine-client boundary.
- `IMove` persists the chess facts needed to derive SAN without a board position. Check/checkmate, capture, ambiguity, moving-piece, and promotion facts are captured while the source position is available. **Why:** history and restored games must describe the transition without retaining a destination board on every node. `MoveNotationUtility.getSan(...)` and `getUci(...)` remain runtime-only caches because they are deterministic formatting of those persisted facts; an engine-suggested ponder reply is runtime-only for the opposite reason—it is speculative intent, not committed history.
- `IMove.checkState` persists whether the destination gives check or checkmate. Game completion remains represented by `resultState` and `resultReason`. **Why:** check is a fact about this transition and may occur in history or analysis, while terminal outcome may instead come from timeout, resignation, agreement, or abandonment; storing both on the game would conflate position state with lifecycle result.
- Alternative live continuations remain `live` nodes; `mainlineChildIndex` decides which continuation is currently authoritative.
- `IMoveNode.$` is runtime-only. Hydration rebuilds `$.parent`; `$.isHighlighted` is reserved for the deferred event-driven UI highlight state. Persistence omits all `$` data. **Why:** parent links would make the persisted tree cyclic, while highlighting follows the rendered selector and must not change chess history. Hydration must restore every parent before node-based traversal is enabled.
- `MovePath` is the mutable persisted selector used by workspace state to point to one node by traversal from the root. State workflows own its mutation; deep-readonly store projections prevent presentation consumers from changing it directly.
- Each `MovePath[index]` value is the zero-based index into the current node's `children` array at that traversal step.
- Appending a child index advances an owned selector in place so readers deliberately sharing that selector observe the same transition. Redirecting a selector through navigation or analysis detachment installs a different array instead.
- Example: `[1, 0, 2]` means `root.children[1].children[0].children[2]`.
