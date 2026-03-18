# AnalysisStore Module (State Management)

## Purpose
Store and query engine analysis results keyed by game position and engine.

## Interfaces
- `IAnalysisResult`
- `AnalysisKey`

## Module Functions
- `storeEvaluation(gameId: string, engineId: string, fen: string, eval: AnalysisResult): void`
- `getEvaluation(gameId: string, engineId: string, fen: string): AnalysisResult | null`
- `clearEvaluations(gameId: string): void`
- `listEvaluations(gameId: string, engineId?: string): AnalysisResult[]`

## Called By
- `GameView.showAnalysis`
- `AnalysisPanelComponent.render`

## Calls
- `EnginesStore.getEngineById`
- `ProcessManager.sendUCICommand`
- `ProcessManager.readEngineOutput`
