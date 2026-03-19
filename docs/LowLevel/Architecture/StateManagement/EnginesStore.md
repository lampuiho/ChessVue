# StateManagement/EnginesStore.md
# EnginesStore Module (State Management)

## Purpose
Manage engine configs, process state, and protocol lifecycle.

## Data Interfaces
- IEngine, IEngineConfig (from DataInterface/Engine.md)

## Module Functions
- listEngines(): IEngine[]
- addEngine(config: IEngineConfig): void
- removeEngine(engineId: string): void
- updateEngine(engineId: string, config: Partial<IEngineConfig>): void
- startEngine(engineId: string): Promise<EngineProcessHandle>
- stopEngine(engineId: string): Promise<void>
- getEngineById(engineId: string): IEngine | null

## Private Helpers
- buildEngineCommand(config: IEngineConfig): string[]
- normalizeEngineConfig(config: IEngineConfig): IEngineConfig

## Calls
- EngineAdapter.initializeEngine
- EngineAdapter.shutdownEngine
- EngineAdapter.sendCommand
