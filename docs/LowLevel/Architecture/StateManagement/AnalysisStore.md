# StateManagement/AnalysisStore.md
# AnalysisStore Module (State Management)

## Purpose
Store engine analysis and coordinate evaluation requests.

## Data Interfaces
- IAnalysisResult (from DataInterface/Analysis.md)

## Module Functions
- storeEvaluation(gameId: string, engineId: string, fen: string, eval: IAnalysisResult): void
- getEvaluation(gameId: string, engineId: string, fen: string): IAnalysisResult | null
- clearEvaluations(gameId: string): void
- listEvaluations(gameId: string, engineId?: string): IAnalysisResult[]
- requestEvaluation(gameId: string, engineId: string, fen: string, depth: number): Promise<IAnalysisResult>

## Private Helpers
- buildAnalysisKey(gameId: string, engineId: string, fen: string): string
- parseEngineOutput(raw: string): IAnalysisResult

## Calls
- EnginesStore.getEngineById
- EngineAdapter.sendCommand
- EngineAdapter.readLine
