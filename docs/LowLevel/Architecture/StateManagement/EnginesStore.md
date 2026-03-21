# EnginesStore

## Purpose
Coordinate configured engines, per-game assignment, runtime availability, and process-session lifecycle.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | null
validateAnalysisSelection(engineIds: string[]): void
createAnalysisSessions(gameId: string, engineIds: string[], positionFen: string): Promise<IEngineRuntimeSession[]>
createPlayerSession(gameId: string, colour: PlayerColour, engineId: string, positionFen: string): Promise<IEngineRuntimeSession>
restartSession(sessionId: string): Promise<void>
stopGameSessions(gameId: string): Promise<void>
removeSessionsForEngine(engineId: string): Promise<void>
```

## Responsibilities
- read engine inventory from `SettingsStore`
- enforce the four-engine analysis cap
- keep sessions isolated by game and role
- mark unavailable or failed engines without stopping unrelated sessions
- restart running sessions when engine configuration changes

## Dependencies
- `SettingsStore`
- `ProcessManager`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-04`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
