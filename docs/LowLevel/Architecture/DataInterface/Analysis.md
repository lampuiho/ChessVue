# Analysis Result and Storage Key

## Purpose
Define how engine analysis reports are keyed and stored.

## Interfaces
- `IAnalysisResult`
- `AnalysisKey`

## Data Structures
- `interface IAnalysisLine {
  move: string
  score: number
  depth: number
  nodes: number
  pv: string[]
}

- `interface IAnalysisResult {
  engineId: string
  fen: string
  timestamp: number
  bestMove: string
  scoreCp: number | null
  scoreMate: number | null
  lines: IAnalysisLine[]
}

- `type AnalysisKey = `${string}:${string}:${string}`` // gameId:engineId:fen
