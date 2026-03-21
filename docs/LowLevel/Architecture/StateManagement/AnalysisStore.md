# AnalysisStore

## Purpose
Store per-game, per-engine, per-position analysis snapshots and coordinate live analysis refreshes.

## Public Interface
```ts
getVisibleAnalysis(gameId: string, position: IBoardPosition): IVisibleAnalysisSnapshot | null
storeEngineUpdate(gameId: string, engineId: string, update: IEngineAnalysisUpdate): void
loadSavedVisibleAnalysis(gameId: string, snapshot: IVisibleAnalysisSnapshot | null): void
refreshAnalysis(gameId: string, position: IBoardPosition, engineIds?: string[]): Promise<void>
retryEngine(gameId: string, engineId: string, position: IBoardPosition): Promise<void>
stopAnalysis(gameId: string, engineId?: string): Promise<void>
clearGameAnalysis(gameId: string): void
```

## Responsibilities
- merge typed engine analysis updates into stable `IAnalysisSnapshot` values
- keep each engine row independent
- expose the latest visible analysis snapshot for persistence and restore
- preserve saved analysis on restore before live analysis resumes
- support retry and stop actions at either per-engine or whole-game scope
- drive concrete engine-analysis operations for the requested board position without composing protocol strings directly

## Dependencies
- `EnginesStore`
- `EngineClient`

## Scenario Coverage
- `SCN-ANALYSIS-01`
- `SCN-ANALYSIS-02`
- `SCN-ANALYSIS-03`
- `SCN-ANALYSIS-04`
- `SCN-FREE-ANALYSIS-01`
- `SCN-FREE-ANALYSIS-02`
- `SCN-FREE-ANALYSIS-03`
- `SCN-LOAD-01`

## Refresh Analysis Flow
`refreshAnalysis` is an active runtime flow rather than a cache lookup.

For each selected engine session, the intended sequence is:

1. Ensure a live runtime session exists through `EnginesStore`.
2. Ensure the concrete engine session is started through `EngineClient`.
3. Stop any superseded search for the same session.
4. Set the target position through a concrete engine operation using `IBoardPosition`.
5. Start or restart analysis with a typed search request.
6. Merge each typed update into `IAnalysisLine` entries.
7. Replace the visible snapshot for that `gameId + engineId + position.fen`.
8. Mark the snapshot complete only when the search is explicitly stopped or the update is final.

Example implementation shape:

```ts
async function refreshAnalysis(gameId: string, position: IBoardPosition, engineIds?: string[]): Promise<void> {
  const sessions = await _ensureSessionsForPosition(gameId, position, engineIds)

  for (const session of sessions) {
    await _ensureAnalysisSubscription(session)
    await engineClient.stopAnalysis(session.sessionId)
    await engineClient.setPosition(session.sessionId, position)
    await engineClient.startAnalysis(session.sessionId, {
      multiPv: _resolveMultiPv(session),
      searchMode: "infinite",
    })
  }
}

function storeEngineUpdate(gameId: string, engineId: string, update: IEngineAnalysisUpdate): void {
  _mergeEngineSnapshot(gameId, engineId, update.position.fen, update)
}
```
