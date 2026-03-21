# Engine Types

## Purpose
Define configured engine records, per-game engine assignment, and runtime-session state.

## Types
- `type EngineProtocol = "uci"`
- `type EngineRole = "player" | "analysis"`
- `type EngineAvailability = "ready" | "starting" | "running" | "unavailable" | "failed"`

## Interfaces
- `interface IEngineRecord`
- `interface IEngineOptionMap`
- `interface IAnalysisAssignment`
- `interface IEngineRuntimeSession`

## Data Structures
```ts
interface IEngineOptionMap {
  [optionName: string]: string | number | boolean
}

interface IEngineRecord {
  id: string
  displayName: string
  executablePath: string
  protocol: EngineProtocol
  options: IEngineOptionMap
}

interface IAnalysisAssignment {
  analysisEngineIds: string[]
}

interface IEngineRuntimeSession {
  sessionId: string
  gameId: string
  engineId: string
  role: EngineRole
  availability: EngineAvailability
  targetPositionFen: string | null
  lastError: string | null
}
```

## Rules
- Engine inventory lives in settings data.
- Analysis assignment is per game.
- A running session is isolated by game, engine, and role.
- The baseline permits at most four concurrent analysis engines per game.
