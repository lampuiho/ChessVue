# StateManagement/EnginesStore.md
# EnginesStore Module (State Management)

## Purpose
Manage engine configurations and process lifecycle for analysis.

## Data Interfaces
- IEngine, IEngineConfig (from DataInterface/Engine.md)

## Module Functions
- listEngines(): IEngine[]
- addEngine(config: IEngineConfig): void
- 
emoveEngine(engineId: string): void
- updateEngine(engineId: string, config: Partial<IEngineConfig>): void
- startEngine(engineId: string): Promise<EngineProcessHandle>
- stopEngine(engineId: string): Promise<void>
- getEngineById(engineId: string): IEngine | null

## Calls
- ProcessManager.spawnEngine
- ProcessManager.sendUCICommand
- ProcessManager.stopEngine
