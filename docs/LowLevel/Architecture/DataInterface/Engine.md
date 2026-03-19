# Engine Configuration and Process Interfaces

## Purpose
Define engine metadata, options, and process handles used by engine and analysis components.

## Interfaces
- `EngineProtocol` (`"uci" | "xboard"`)
- `IEngineConfig`
- `IEngine`
- `EngineProcessHandle`

## Data Structures
- `interface IEngineConfig {
  id: string
  name: string
  executablePath: string
  protocol: EngineProtocol
  options: Record<string, string | number | boolean>
  defaultThreads?: number
  defaultHash?: number
  autoStart?: boolean
}

- `interface IEngine {
  id: string
  config: IEngineConfig
  isRunning: boolean
  handle?: EngineProcessHandle
}

- `interface EngineProcessHandle {
  pid: number
  stdin: any
  stdout: any
  stderr?: any
  isAlive: boolean
}
