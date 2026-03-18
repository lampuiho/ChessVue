# EnginesStore Module (State Management)

## Purpose
Manage engine configurations, process lifecycle, and engine availability.

## Interfaces
- `IEngineConfig`
- `IEngine`

## Module Functions
- `listEngines(): IEngine[]`
- `addEngine(config: IEngineConfig): void`
- `removeEngine(engineId: string): void`
- `updateEngine(engineId: string, config: Partial<IEngineConfig>): void`
- `startEngine(engineId: string): Promise<EngineProcessHandle>`
- `stopEngine(engineId: string): Promise<void>`
- `getEngineById(engineId: string): IEngine | null`

## Called By
- `AnalysisStore.requestEvaluation`
- `SettingsView.onEngineConfigChanged`

## Calls
- `ProcessManager.spawnEngine`
- `ProcessManager.sendUCICommand`
- `ProcessManager.stopEngine`
