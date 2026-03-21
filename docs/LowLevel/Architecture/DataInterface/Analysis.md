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
```

## Rules
- `AnalysisStore` keeps the latest valid snapshot independently for each engine.
- Parse failures discard only the bad message.
- Saved visible analysis is persisted only for the visible node, not as a full historical cache requirement.
- Engine-facing updates are normalised into ChessVue move structures before they are stored here.
