# AnalysisStore

## Purpose
Store per-game, per-engine, per-position analysis snapshots and coordinate live analysis refreshes.

## Public Interface
```ts
getVisibleAnalysis(gameId: string, positionFen: string): IVisibleAnalysisSnapshot | null
storeEngineOutput(gameId: string, engineId: string, positionFen: string, line: string): void
loadSavedVisibleAnalysis(gameId: string, snapshot: IVisibleAnalysisSnapshot | null): void
refreshAnalysis(gameId: string, positionFen: string): Promise<void>
stopAnalysis(gameId: string): Promise<void>
clearGameAnalysis(gameId: string): void
```

## Responsibilities
- parse streamed UCI output into stable `IAnalysisSnapshot` values
- keep each engine row independent
- expose the latest visible analysis snapshot for persistence and restore
- preserve saved analysis on restore before live analysis resumes

## Dependencies
- `EnginesStore`
- `ProcessManager`

## Scenario Coverage
- `SCN-ANALYSIS-01`
- `SCN-ANALYSIS-02`
- `SCN-ANALYSIS-03`
- `SCN-ANALYSIS-04`
- `SCN-FREE-ANALYSIS-01`
- `SCN-LOAD-01`
