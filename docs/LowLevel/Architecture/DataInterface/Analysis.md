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
  scoreCp: number | null
  scoreMate: number | null
  pv: IMove[]
}

interface IAnalysisSnapshot {
  assignedEngine: IAssignedEngine
  positionKey: string
  updatedAt: string
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isComplete: boolean
}

interface IGameAnalysis {
  snapshots: IAnalysisSnapshot[]
}

interface IVisibleAnalysisSnapshot {
  engineSnapshots: IAnalysisSnapshot[]
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
- `positionKey` is a derived structural position identity, not a stored FEN contract.
- `IVisibleAnalysisSnapshot` is a read model derived by `GamesStore` for the current game state and highlighted position.
