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
ensureAnalysisSessions(gameId: string, engineIds: string[], position: IBoardPosition): Promise<IEngineRuntimeSession[]>
createPlayerSession(gameId: string, colour: PlayerColour, engineId: string, position: IBoardPosition): Promise<IEngineRuntimeSession>
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

## Dependencies
- `SettingsStore`
- `EngineClient`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-04`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
