# Analysis Types

## Purpose
Define the analysis payloads stored on a game for assigned engines and derived positions.

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
  assignedEngineId: string
  positionKey: string
  updatedAt: string
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isComplete: boolean
}

interface IGameAnalysis {
  assignedEngines: IAssignedEngine[]
  snapshots: IAnalysisSnapshot[]
}

interface IVisibleAnalysisSnapshot {
  engineSnapshots: IAnalysisSnapshot[]
}
```

## Rules
- `IGame.analysis` keeps the persisted analysis roster and the latest valid snapshot independently for each assigned engine and derived position.
- Parse failures discard only the bad message.
- Analysis snapshots are persisted inside the saved game payload and restored with the rest of the game.
- Analysis-engine fold behaviour is UI-owned state persisted through `IUiLayoutState` by rendered row index for the active game rather than through the saved game payload.
- Engine-facing updates are normalised into ChessVue move structures before they are stored.
- `positionKey` is a derived structural position identity, not a stored FEN contract.
- `IVisibleAnalysisSnapshot` is a read model derived by `GamesStore` for the current game state and highlighted position.
