# EngineAdapter Module (Platform Abstraction)

## Purpose
Abstract engine protocol communication (UCI/XBoard) from concrete process transport.

## Data Interfaces
- `IEngineConfig` (from DataInterface/Engine.md)
- `EngineProcessHandle` (from DataInterface/Engine.md)

## Module Functions
- `initializeEngine(config: IEngineConfig): Promise<EngineProcessHandle>`
- `shutdownEngine(handle: EngineProcessHandle): Promise<void>`
- `sendCommand(handle: EngineProcessHandle, command: string): Promise<void>`
- `readLine(handle: EngineProcessHandle): Promise<string>`
- `setUciOptions(handle: EngineProcessHandle, options: Record<string, string | number | boolean>): Promise<void>`
- `getBestMove(handle: EngineProcessHandle, fen: string, depth: number): Promise<string>`

## Private Helper Functions
- `buildUciOptionCommand(optionName: string, value: unknown): string`
- `ensureEngineReady(handle: EngineProcessHandle): Promise<void>`

## Calls
- `ProcessManager.spawnEngine`
- `ProcessManager.sendUCICommand`
- `ProcessManager.readEngineOutput`
- `ProcessManager.stopEngine`
