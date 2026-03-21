# EnginesStore

## Purpose
Coordinate configured engines, per-game assignment, runtime availability, and process-session lifecycle.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | null
addEngine(engine: IEngineRecord): Promise<void>
updateEngine(engine: IEngineRecord): Promise<void>
removeEngine(engineId: string): Promise<void>
validateAnalysisSelection(engineIds: string[]): void
ensureAnalysisSessions(gameId: string, engineIds: string[], positionState: IEnginePositionState): Promise<IEngineRuntimeSession[]>
startAnalysis(gameId: string, engineIds: string[], positionState: IEnginePositionState): Promise<void>
retryAnalysis(gameId: string, engineId: string, positionState: IEnginePositionState): Promise<void>
stopAnalysis(gameId: string, engineId?: string): Promise<void>
createPlayerSession(gameId: string, colour: PlayerColour, engineId: string, positionState: IEnginePositionState): Promise<IEngineRuntimeSession>
startPlayerTurn(gameId: string, colour: PlayerColour, engineId: string, positionState: IEnginePositionState): Promise<void>
restartSession(sessionId: string): Promise<void>
stopEngine(gameId: string, engineId: string, role?: EngineRole): Promise<void>
stopGameSessions(gameId: string): Promise<void>
removeSessionsForEngine(engineId: string): Promise<void>
```

## Responsibilities
- read engine inventory from `SettingsStore`
- mutate the engine inventory through `SettingsStore` while keeping runtime sessions coherent
- enforce the four-engine analysis cap
- keep sessions isolated by game and role
- mark unavailable or failed engines without stopping unrelated sessions
- restart running sessions when engine configuration changes
- expose concrete runtime sessions without leaking protocol-specific command composition
- own all analysis start, retry, and stop orchestration through `EngineClient`
- forward analysis callbacks into `AnalysisStore`, which remains callback-only state
- retain enough position-state context for the engine client to reuse the same game line instead of forcing a new-game reset on every search
- distinguish continuous analysis searches from turn-scoped player-engine move generation

## Runtime Gating Notes
- `startAnalysis` supports `liveGame`, `historyReview`, `inGameAnalysis`, `freeAnalysisSetup`, paused live review, and finished-game review because analysis is read-only with respect to live progression.
- `startAnalysis` is blocked when the workspace is actively in `boardEdit`.
- `startPlayerTurn` is a strict preconditioned call for `liveGame + currentPosition + ongoing + not paused` only. It must reject or no-op for `freeAnalysisSetup`, `historyReview`, `inGameAnalysis`, `boardEdit`, paused games, expired clocks, and final result states.
- Analysis-runtime restart after restore follows the caller's `analysis.resumeLiveAnalysisAfterRestore` decision; `EnginesStore` does not override that policy.

## Dependencies
- `SettingsStore`
- `AnalysisStore`
- `EngineClient`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-04`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
