# Presentation/Components/AnalysisPanel.md
# AnalysisPanel Component (Presentation)

## Purpose
Render engine analysis experiences and line selection.

## Data Interfaces
- IAnalysisResult (from DataInterface/Analysis.md)

## Component Methods
- renderAnalysisLines(analysis: IAnalysisResult[]): VNode
- onLineClick(move: IMove): void

## Calls
- AnalysisStore.listEvaluations
- GamesStore.getGameById
