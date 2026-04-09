# AnalysisStore

## Purpose
Own visible per-game analysis snapshots for the currently relevant position without taking ownership of engine profiles, runtime sessions, or engine-process orchestration.

## Public Interface
```ts
getVisibleAnalysis(game: IGame, position: IBoardPosition): IVisibleAnalysisSnapshot | null
applyAnalysisUpdate(game: IGame, snapshot: IAnalysisSnapshot, position: IBoardPosition): void
clearGameAnalysis(game: IGame): void
clearEngineAnalysis(game: IGame, engineId: string): void
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
- `AnalysisStore` is a layer-3 snapshot store only. It does not decide when analysis should start, retry, stop, or retarget.
- `GamesStore` owns the per-game analysis workflow and writes resulting snapshots here.
- `AnalysisStore` does not call sibling stores directly.
