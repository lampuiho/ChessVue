# Engine Types

## Purpose
Define configured engine records, copied in-game engine snapshots, and engine analysis request or update types.

## Types
- `enum EngineProtocol`
- `enum EngineAvailability`
- `enum EngineAnalysisSearchMode`

## Interfaces
- `interface IEngineRecord`
- `interface IEngineOptionMap`
- `interface IAssignedEngineRuntime`
- `interface IAssignedEngine`
- `interface IEnginePositionState`
- `interface IEngineAnalysisRequest`
- `interface IEngineAnalysisUpdate`
- `interface IEngineRegistrationRequest`

## Data Structures
```ts
enum EngineProtocol {
  Uci = "uci"
}

enum EngineAvailability {
  Ready = "ready",
  Starting = "starting",
  Running = "running",
  Unavailable = "unavailable",
  Failed = "failed"
}

enum EngineAnalysisSearchMode {
  Infinite = "infinite"
}

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

interface IAssignedEngineRuntime {
  processHandle: ProcessHandle | null
  availability: EngineAvailability
  lastError: string | null
}

interface IAssignedEngine {
  displayName: string
  executablePath: string
  protocol: EngineProtocol
  options: IEngineOptionMap
  $?: IAssignedEngineRuntime
}

interface IEnginePositionState {
  rootPosition: IBoardPosition
  movesFromRoot: IMove[]
  currentPosition: IBoardPosition
  requiresNewGameBoundary: boolean
}

interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: EngineAnalysisSearchMode
}

interface IEngineAnalysisUpdate {
  position: IBoardPosition
  positionKey: string
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isFinal: boolean
}

interface IEngineRegistrationRequest {
  name: string | null
  code: string | null
  registerLater: boolean
}
```

## Rules
- Engine inventory lives in settings data.
- Assigned-engine snapshots live in saved game data and are copied by value from the selected reusable engine profile.
- `id` is an opaque stable internal key for the saved profile record; uniqueness is not a user-facing editing rule.
- `displayName` is the user-facing engine profile name and must be unique within the saved profile list.
- Creating an assigned engine from a profile copies the display name, executable path, protocol, and option values into the saved game payload so existing games do not change when the reusable profile is edited later or when the reusable profile is deleted.
- `IAssignedEngine` is the canonical in-game engine object used by engine-backed players and persisted analysis snapshots.
- The baseline permits at most four concurrent analysis engines per game.
- `IAssignedEngine.$` is the runtime-only engine namespace. It is rebuilt in memory, is never persisted, and carries the current process handle, availability, and last error for that engine instance.
- Higher layers use ChessVue board and move structures; protocol-specific payloads and strings are an internal detail of the concrete engine client implementation.
- `IEnginePositionState` is the engine-facing projection of ChessVue move-tree state and lets the engine client decide whether it can continue the current line or must establish a new game boundary.
- `IEngineAnalysisUpdate` is an app-facing streamed update shape. It includes both the current `position` and the derived `positionKey` so higher layers can reject stale results deterministically when the target changes.
- `executablePath` and `options` are user-managed profile values and are not strictly validated at settings-edit time beyond being storable in the profile record.
