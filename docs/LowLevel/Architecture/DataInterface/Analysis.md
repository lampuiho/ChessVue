# Analysis Types

## Purpose
Define the ordered analysis snapshots stored on a game.

## Interfaces
- `interface IAnalysisLine`
- `interface IAnalysisSnapshot`
- `interface IGameAnalysis`
- `interface IVisibleAnalysisSnapshot`

## Data Structures
```ts
interface IAnalysisLine {
  depth: number
  scoreCp?: number
  scoreMate?: number
  pv: readonly IMove[]
}

interface IAnalysisSnapshot {
  assignedEngine: IAssignedEngine
  positionKey: string
  updatedAt: AnalysisTimestamp
  bestMove?: IMove
  lines: readonly IAnalysisLine[]
  isComplete: boolean
}

interface IGameAnalysis {
  snapshots: IAnalysisSnapshot[]
}

type ReadonlyAnalysisSnapshot = DeepReadonly<IAnalysisSnapshot>

interface IVisibleAnalysisSnapshot {
  readonly engineSnapshots: readonly ReadonlyAnalysisSnapshot[]
}
```

## Rules
- `IGame.analysis.snapshots` is the ordered per-game analysis list and is the source of truth for rendered analysis row order.
- Each `IAnalysisSnapshot` carries the copied in-game engine payload plus the latest known analysis result for that engine.
- Parse failures discard only the bad message.
- Analysis snapshots are persisted inside the saved game payload and restored with the rest of the game.
- Analysis-engine fold behaviour is UI-owned state persisted through `IUiLayoutState` by rendered row index for the active game rather than through the saved game payload.
- Duplicate analysis engines are not allowed within one game, so row-index-targeted actions stay unambiguous.
- Engine-facing updates are normalised into ChessVue move structures before they are stored.
- Engine analysis-update payloads are readonly after dispatch. `GamesStore` retains the supplied `bestMove` and `lines` references when replacing a snapshot result instead of cloning them; the producer creates a new ordered lines array for each update and does not subsequently mutate emitted line or move objects.
- `positionKey` is a derived structural position identity, not a stored FEN contract.
- Omitted `scoreCp`, `scoreMate`, or `bestMove` fields mean that value is currently unavailable for that snapshot.
- `IVisibleAnalysisSnapshot` is a deep-readonly view over the matching stored snapshots for the currently rendered position. It does not clone the snapshot graph.
