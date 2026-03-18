# AnalysisPanel Component (Presentation)

## Purpose
Render engine analysis lines, best moves, and evaluation.

## Interfaces
- `AnalysisPanelProps`

## Component Methods
- `renderAnalysisLines(analysis: AnalysisResult[]): VNode`
- `onLineClick(move: Move): void`

## Called By
- `GameView`

## Calls
- `AnalysisStore.listEvaluations`
- `GamesStore.getGameById`
