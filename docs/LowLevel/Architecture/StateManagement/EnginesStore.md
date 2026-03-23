# EnginesStore

## Purpose
Coordinate configured engines, per-game assignment, runtime availability, and process-session lifecycle.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | null
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
- read configured engine profiles when creating or validating assigned engine participants
- enforce the four-engine analysis cap
- keep sessions isolated by game and role
- mark unavailable or failed engines without stopping unrelated sessions
- preserve assigned player-engine and analysis-engine identity for the lifetime of that assignment unless the user explicitly unseats and reseats the engine
- expose concrete runtime sessions without leaking protocol-specific command composition
- own all analysis start, retry, and stop orchestration through `EngineClient`
- forward analysis callbacks into `AnalysisStore`, which remains callback-only state
- retain enough position-state context for the engine client to reuse the same game line instead of forcing a new-game reset on every search
- distinguish continuous analysis searches from turn-scoped player-engine move generation

## Runtime Gating Notes
- `startAnalysis` supports `liveGame`, `historyReview`, `inGameAnalysis`, `freeAnalysisSetup`, paused live review, and finished-game review because analysis is read-only with respect to live progression.
- `startAnalysis` is blocked when the workspace is actively in `boardEdit`.
- `startPlayerTurn` is a strict preconditioned call for `liveGame + currentPosition + ongoing + not paused` only. It must reject or no-op for `freeAnalysisSetup`, `historyReview`, `inGameAnalysis`, `boardEdit`, paused games, expired clocks, and final result states.
- `startPlayerTurn` does not distinguish `human/engine` from `engine/engine`; it only checks the live-state gate and the side-to-move assignment.
- Analysis-runtime restart after restore follows the caller's `analysis.resumeLiveAnalysisAfterRestore` decision; `EnginesStore` does not override that policy.
- Engine-profile editing is owned by `SettingsStore`; `EnginesStore` does not react automatically to profile edits because same-layer stores do not subscribe to each other in the baseline design.
- If the user wants a different in-game engine identity or launch configuration, the engine must be explicitly unseated and reseated so a new participant/session can be created from the updated profile.
- When `GamesStore` changes a game's analysis-engine roster, `EnginesStore` starts or stops only the affected game-role sessions. Other games and roles are untouched.

## Dependencies
- `SettingsStore`
- `AnalysisStore`
- `PlatformServices`
- `EngineClient`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-04`
- `SCN-ANALYSIS-05`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `EnginesStore` resolves the active `ProcessManager` through `usePlatformServicesStore()` and supplies it to the concrete `EngineClient` wiring for the selected platform.
