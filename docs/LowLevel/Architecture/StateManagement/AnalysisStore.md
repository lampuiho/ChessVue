# AnalysisStore

## Purpose
Own visible per-game analysis snapshots for the currently relevant position without taking ownership of engine profiles, runtime sessions, or engine-process orchestration.

## Public Interface
```ts
getVisibleAnalysis(gameId: string, position: IBoardPosition): IVisibleAnalysisSnapshot | null
applyAnalysisUpdate(gameId: string, snapshot: IAnalysisSnapshot, position: IBoardPosition): void
clearGameAnalysis(gameId: string): void
clearEngineAnalysis(gameId: string, engineId: string): void
```

## Responsibilities
- keep the latest valid visible analysis snapshot independently for each game, engine, and position
- key visible analysis by derived structural position identity rather than stored FEN
- discard superseded or invalid runtime updates without mutating unrelated engine rows
- clear one engine row or one whole game's visible analysis state when the owning flow removes or resets those targets
- expose read-only visible-analysis state for `GameView` and `AnalysisPanel`

## Dependencies
- `PositionIdentityService`

## Scenario Coverage
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`
- `SCN-HIST-01`
- `SCN-LOAD-01`

## Notes
- `AnalysisStore` is a layer-3 snapshot store only. It does not start, retry, stop, or restart engine sessions.
- `AnalysisStore` does not call sibling stores directly. Caller-owned presentation or bootstrap flows coordinate `EnginesStore` runtime actions and `AnalysisStore` snapshot updates from concrete callable handlers.
- Continuous analysis callbacks may arrive long after the originating user action, so the low-level flow owner for snapshot writes is a concrete callback handler such as `GameView._handleAnalysisRuntimeUpdate`, not an abstract workflow step.
