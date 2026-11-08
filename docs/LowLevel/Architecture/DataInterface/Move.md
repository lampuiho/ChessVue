# Move Tree Types

## Purpose
Define move payloads and tree structures for live play, history review, analysis branches, and premove input. Source: `contracts/Move.ts`.

## Types
- `enum MoveKind`
- `enum MoveNodeKind`
- `enum AmbiguityKind`
- `type MovePath`

## Interfaces
- `interface IMoveRuntime`
- `interface IMoveRaw`
- `interface IMoveCandidate`
- `interface IMove`
- `interface IPromoMove`
- `interface IMoveNodeRuntime`
- `interface IMoveNode`
- `interface IMoveTree`

## Data Structures
```ts
const enum MoveKind {
  Normal = "normal",
  Castle = "castle",
  EnPassant = "enPassant",
  Promotion = "promotion"
}

const enum MoveNodeKind {
  Live = "live",
  Analysis = "analysis"
}

const enum AmbiguityKind {
  SameRankOnly = "rank",
  SameFileOnly = "file",
  Both = "both"
}

type MovePath = number[]

interface IMoveRuntime {
  ponderMove?: IMove
  san?: string
  uci?: string
}

interface IMoveRaw {
  from: BoardId
  to: BoardId
  promotionPiece?: PieceKind
  $?: IMoveRuntime
}

interface IMoveCandidate extends IMoveRaw {
  kind: MoveKind
  movingColour: PlayerColour
  movingPiece: PieceKind
  capturePiece?: PieceKind
}

interface IMove extends IMoveCandidate {
  checkState?: CheckState
  ambiguityKind?: AmbiguityKind
}

interface IPromoMove extends IMove {
  kind: MoveKind.Promotion
  promotionPiece: PieceKind
}

interface IMoveNodeRuntime {
  parent?: IMoveNode
  isHighlighted?: boolean
}

interface IMoveNode {
  kind: MoveNodeKind
  move?: IMove
  clockSnapshot?: IClockSnapshot
  recordedAnalysis?: IRecordedAnalysis
  plyIndex: number
  mainlineChildIndex?: number
  children: IMoveNode[]
  $?: IMoveNodeRuntime
}

interface IMoveTree {
  root: IMoveNode
}
```

## Schemas
- `moveKindSchema`, `moveNodeKindSchema`, and `ambiguityKind` (the `AmbiguityKind` schema, exported without the usual `Schema` suffix) validate the enums.
- `movePathSchema` is an array of non-negative integers.
- `moveSchema` validates a detailed `IMove`: board IDs through `boardIdSchema`, enums, and optional `capturePiece`, `checkState`, `ambiguityKind`, and `promotionPiece`. It has no `$`, so runtime SAN, UCI, and ponder data are stripped.
- `recordedAnalysisSchema` is `createRecordedAnalysisSchema(moveSchema)` from [Analysis](Analysis.md#schemas).
- `moveNodeSchema` is a lazy recursive schema with `plyIndex >= 0`, an optional non-negative `mainlineChildIndex`, and optional `move`, `clockSnapshot`, and `recordedAnalysis`. `moveTreeSchema` wraps its root.
- `SerializationService` additionally rejects a `mainlineChildIndex` that does not reference an existing child, and saved `livePath` or `renderedPath` selectors that do not resolve to a node.

## Notes
- Actual played nodes may retain `IRecordedAnalysis` with a capture timestamp and copied engine seats for their pre-move position. `GameMoveComposable` captures it while committing a live move, only when the rendered selection is the live node, and only from seats that already have lines; the seats are copied through `analysisSeatSchema`. This is evaluation output, not a position snapshot or current engine runtime. No available output means the field is omitted; exploratory nodes do not capture it. Later rendered analysis refreshes cannot mutate these copies.
- Persisted move trees are single-direction nested structures rooted at `root`.
- `IMoveNode` stores a transition and history structure, not a board position. Selected positions are reconstructed from `IGame.rootPosition` and a move sequence. **Why:** a full mutable position per node would become a second persisted authority, replace piece identities during navigation, and prevent the step-by-step replay needed for movement animation. Reintroducing snapshots is safe only if they remain derived, preserve identity between adjacent positions, and cannot override the root-plus-moves authority.
- `mainlineChildIndex` selects the current live continuation from the node's local `children` array and lets `MoveHistoryService` rewrite that continuation without global node identity. `MoveNodeKind` records only committed-live versus analysis-only history. **Why:** mainline and variation are parent-child relationships that a rewrite can change without changing the child; encoding them as the child's kind would immediately make the kind stale. Any richer kind must describe an intrinsic persisted distinction.
- Analysis-only branches remain in the tree even when the visible screen returns to the live node.
- Omitted `move`, `clockSnapshot`, `recordedAnalysis`, `mainlineChildIndex`, `promotionPiece`, `capturePiece`, `checkState`, or `ambiguityKind` fields mean that value is not applicable for the current node or move.
- `clockSnapshot` is stored on the root node and on live nodes so time-aware takeback and restore flows can reconstruct the authoritative clock state. Analysis-only nodes may omit it.
- `BoardId` uses `0..63`, `BoardId % 8` is the file and `Math.floor(BoardId / 8)` is the rank.
- `IMoveRaw` is the shared coordinate/promotion contract for legal board input, selected PV prefixes, UI continuations, queued premoves, and UCI coordinates. UI transport copies only from/to/optional promotion; caller runtime or detailed fields are not authority. `GamesStore.makeMove(game, rawMove)` either appends an off-turn raw move to the premove queue or resolves it through `GameMoveComposable.resolveMove`, which matches a canonical legal candidate before `toDetailedMove(...)` produces the history/commit transition. Engine clients separately enrich their accepted provider output before delivery. The design is recorded in the archived [raw move submission design](../../../ArchivedPlans/RawMoveSubmissionDesign.md).
- `IMoveCandidate` carries the movement facts needed by board application, replay, and premove projection, without requiring check or SAN ambiguity computation. `IMove` adds those notation facts for history/PV display. The full-type retention reasons are recorded in the [API audit](../../../ArchivedPlans/RawMoveSubmissionDesign.md#type-retention-audit-and-justification).
- `IPromoMove` is the declared narrowing of `IMove` for a promotion with its required `promotionPiece`. It has no current production consumer; promotion moves are otherwise identified by `kind === MoveKind.Promotion`.
- `IMove` persists the chess facts needed to derive SAN without a board position. Check/checkmate, capture, ambiguity, moving-piece, and promotion facts are captured while the source position is available. **Why:** history and restored games must describe the transition without retaining a destination board on every node. `MoveNotationUtility.getSan(...)` and `getUci(...)` remain runtime-only caches because they are deterministic formatting of those persisted facts; an engine-suggested ponder reply is runtime-only for the opposite reason—it is speculative intent, not committed history.
- `ambiguityKind` records which SAN disambiguator another same-kind piece reaching the same square requires: `SameRankOnly` (`"rank"`) means every alternative shares the mover's rank, so the file letter is written; `SameFileOnly` (`"file"`) writes the rank digit; `Both` writes the full source square. Omission means no disambiguation.
- `IMove.checkState` persists whether the destination gives check or checkmate. Game completion remains represented by `resultState` and `resultReason`. **Why:** check is a fact about this transition and may occur in history or analysis, while terminal outcome may instead come from timeout, resignation, agreement, or abandonment; storing both on the game would conflate position state with lifecycle result. `ResultReason.Checkmate` on the game records why the game ended, not the check state of whichever position is rendered.
- Alternative live continuations remain `live` nodes; `mainlineChildIndex` decides which continuation is currently authoritative.
- `IMoveNode.$` is runtime-only. Hydration rebuilds `$.parent`; `$.isHighlighted` is reserved for the deferred event-driven UI highlight state and is not currently written. Persistence omits all `$` data. **Why:** parent links would make the persisted tree cyclic, while highlighting follows the rendered selector and must not change chess history. Hydration must restore every parent before node-based traversal is enabled.
- `MovePath` is the mutable persisted selector used by workspace state to point to one node by traversal from the root. State workflows own its mutation; deep-readonly store projections prevent presentation consumers from changing it directly.
- Each `MovePath[index]` value is the zero-based index into the current node's `children` array at that traversal step.
- Appending a child index advances an owned selector in place so readers deliberately sharing that selector observe the same transition. Redirecting a selector through navigation or analysis detachment installs a different array instead.
- Example: `[1, 0, 2]` means `root.children[1].children[0].children[2]`.
