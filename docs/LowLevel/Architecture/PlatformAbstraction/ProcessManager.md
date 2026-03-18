# ProcessManager Module (Platform Abstraction)

## Purpose
Manage external engine processes (spawn, command send, output read, terminate).

## Interfaces
- `IProcessManager`
- `EngineProcessHandle`

## Module Functions
- `spawnEngine(enginePath: string, options: EngineOptions): Promise<EngineProcessHandle>`
- `sendUCICommand(handle: EngineProcessHandle, command: string): Promise<void>`
- `readEngineOutput(handle: EngineProcessHandle): Promise<string>`
- `stopEngine(handle: EngineProcessHandle): Promise<void>`
- `isEngineRunning(handle: EngineProcessHandle): boolean`

## Called By
- `EnginesStore.startEngine`
- `EnginesStore.stopEngine`
- `AnalysisStore.requestEvaluation`

## Calls
- Native process APIs (`spawn`, `child_process`, platform process APIs)
