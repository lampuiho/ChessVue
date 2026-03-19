# PlatformAbstraction/ProcessManager.md
# ProcessManager Module (Platform Abstraction)

## Purpose
Manage external engine processes, I/O stream connectivity, and process lifecycle.

## Data Interfaces
- EngineProcessHandle (from DataInterface/Engine.md)

## Module Functions
- spawnEngine(enginePath: string, options: IEngineConfig): Promise<EngineProcessHandle>
- sendUCICommand(handle: EngineProcessHandle, command: string): Promise<void>
- eadEngineOutput(handle: EngineProcessHandle): Promise<string>
- stopEngine(handle: EngineProcessHandle): Promise<void>
- isEngineRunning(handle: EngineProcessHandle): boolean

## Calls
- OS process APIs (child_process, NW.js process APIs, Capacitor process APIs)
