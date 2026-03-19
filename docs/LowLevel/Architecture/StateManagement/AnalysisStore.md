# StateManagement/AnalysisStore.md
# AnalysisStore Module (State Management)

## Purpose
Cache and query engine analysis results by game and position.

## Data Interfaces
- IAnalysisResult, AnalysisKey (from DataInterface/Analysis.md)

## Module Functions
- storeEvaluation(gameId: string, engineId: string, fen: string, eval: IAnalysisResult): void
- getEvaluation(gameId: string, engineId: string, fen: string): IAnalysisResult | null
- clearEvaluations(gameId: string): void
- listEvaluations(gameId: string, engineId?: string): IAnalysisResult[]

## Calls
- EnginesStore.getEngineById
- ProcessManager.sendUCICommand
- ProcessManager.readEngineOutput
