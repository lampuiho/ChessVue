# Analysis Types

## Purpose
Define the streamed analysis payloads stored for a game, engine, and position.

## Interfaces
- `interface IAnalysisLine`
- `interface IAnalysisSnapshot`
- `interface IVisibleAnalysisSnapshot`
- `interface IAnalysisEngineViewState`

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
  positionFen: string
  updatedAt: string
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isComplete: boolean
}

interface IVisibleAnalysisSnapshot {
  positionFen: string
  engineSnapshots: IAnalysisSnapshot[]
}

interface IAnalysisEngineViewState {
  engineId: string
  isCollapsed: boolean
}
```

## Rules
- `AnalysisStore` keeps the latest valid snapshot independently for each engine.
- Parse failures discard only the bad message.
- Visible analysis is runtime state only and is not persisted inside the saved game payload.
- `IAnalysisEngineViewState` is transient UI state for per-engine fold behaviour and is not part of persisted layout state.
- Engine-facing updates are normalised into ChessVue move structures before they are stored here.
