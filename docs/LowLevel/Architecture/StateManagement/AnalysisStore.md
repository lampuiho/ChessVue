# AnalysisStore

## Purpose
Store per-game, per-engine, per-position analysis snapshots and publish visible analysis state from engine callbacks.

## Public Interface
```ts
getVisibleAnalysis(gameId: string, position: IBoardPosition): IVisibleAnalysisSnapshot | null
beginAnalysisStream(gameId: string, engineId: string, position: IBoardPosition): void
applyAnalysisUpdate(gameId: string, engineId: string, update: IEngineAnalysisUpdate): void
completeAnalysisStream(gameId: string, engineId: string, position: IBoardPosition): void
markAnalysisUnavailable(gameId: string, engineId: string, position: IBoardPosition, reason: string): void
clearGameAnalysis(gameId: string): void
clearEngineAnalysis(gameId: string, engineId: string): void
```

## Responsibilities
- merge typed engine callbacks into stable `IAnalysisSnapshot` values
- keep each engine row independent
- expose the latest visible analysis snapshot for rendering while analysis is active
- track whether an engine stream is active, complete, or unavailable for the visible position
- publish updated visible snapshots without owning engine runtime control
- clear one assigned engine's snapshots when that engine is removed from a game's analysis roster

## Dependencies
- none beyond in-memory analysis state

## Scenario Coverage
- `SCN-ANALYSIS-01`
- `SCN-ANALYSIS-02`
- `SCN-ANALYSIS-03`
- `SCN-ANALYSIS-04`
- `SCN-FREE-ANALYSIS-01`
- `SCN-FREE-ANALYSIS-02`
- `SCN-FREE-ANALYSIS-03`

## Callback Sink Flow
`AnalysisStore` does not start, stop, retry, or synchronise engine analysis.

Instead, runtime owners call it like this:

1. `EnginesStore` decides that an engine should start or restart analysis.
2. `EnginesStore` calls `beginAnalysisStream(...)` before the first update for that engine and position.
3. `EngineClient` emits typed callbacks over time.
4. `EnginesStore` forwards each callback to `applyAnalysisUpdate(...)`.
5. `EnginesStore` calls `completeAnalysisStream(...)` when the continuous search is intentionally ended or a final state is reached.
6. `EnginesStore` calls `markAnalysisUnavailable(...)` when the session fails or becomes unavailable.

Example implementation shape:

```ts
function beginAnalysisStream(gameId: string, engineId: string, position: IBoardPosition): void {
  _markStreamActive(gameId, engineId, position)
}

function applyAnalysisUpdate(gameId: string, engineId: string, update: IEngineAnalysisUpdate): void {
  _mergeEngineSnapshot(gameId, engineId, update.position, update)
}

function completeAnalysisStream(gameId: string, engineId: string, position: IBoardPosition): void {
  _markStreamComplete(gameId, engineId, position)
}
```

## Continuous Update Loop
After a runtime owner starts analysis, live updates continue like this:

1. `EngineClient.subscribeToAnalysis` emits a new `IEngineAnalysisUpdate` whenever the engine reports a deeper or otherwise newer principal variation.
2. `EnginesStore` forwards that callback to `AnalysisStore.applyAnalysisUpdate`.
3. `_mergeEngineSnapshot` replaces the stored line set for that `gameId + engineId + position.fen` when the new update is more recent, final, or deeper than the current one.
4. `getVisibleAnalysis` returns a new visible snapshot reference for the active position.
5. `AnalysisPanel` rerenders the affected engine row, so the user sees the stronger score or line without manually refreshing.

This means runtime control belongs outside `AnalysisStore`, while `applyAnalysisUpdate` is the function that keeps improving the panel contents over time.
