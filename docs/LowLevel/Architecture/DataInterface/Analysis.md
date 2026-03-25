# Analysis Types

## Purpose
Define the streamed analysis payloads stored for a game, engine, and position.

## Interfaces
- `interface IAnalysisLine`
- `interface IAnalysisSnapshot`
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
  gameId: string
  engineId: string
  updatedAt: string
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isComplete: boolean
}

interface IVisibleAnalysisSnapshot {
  engineSnapshots: IAnalysisSnapshot[]
}

```

## Rules
- `AnalysisStore` keeps the latest valid snapshot independently for each engine.
- Parse failures discard only the bad message.
- Visible analysis is runtime state only and is not persisted inside the saved game payload.
- Analysis-engine fold behaviour is UI-owned state persisted through `IUiLayoutState` by rendered row index for the active game rather than through the saved game payload.
- Engine-facing updates are normalised into ChessVue move structures before they are stored here.
- Internal analysis indexing uses derived structural position identity and does not expose that key on the public snapshot contract.
