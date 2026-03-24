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
- `interface IAssignedEngine`
- `interface IAnalysisAssignment`
- `interface IEngineRuntimeSession`
- `interface IEnginePositionState`
- `interface IEngineAnalysisRequest`
- `interface IEngineAnalysisUpdate`
- `interface IEngineRegistrationRequest`
- `interface IEngineSessionEvent`

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

interface IAssignedEngine {
  assignedEngineId: string
  sourceProfileId: string | null
  displayName: string
  executablePath: string
  protocol: EngineProtocol
  options: IEngineOptionMap
}

interface IAnalysisAssignment {
  assignedEngines: IAssignedEngine[]
}

interface IEngineRuntimeSession {
  sessionId: string
  gameId: string
  assignedEngineId: string
  role: EngineRole
  availability: EngineAvailability
  targetPositionState: IEnginePositionState | null
  lastError: string | null
}

interface IEnginePositionState {
  rootPosition: IBoardPosition
  movesFromRoot: IMove[]
  currentPosition: IBoardPosition
  requiresNewGameBoundary: boolean
}

interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: "infinite"
}

interface IEngineAnalysisUpdate {
  position: IBoardPosition
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isFinal: boolean
}

interface IEngineRegistrationRequest {
  name: string | null
  code: string | null
  registerLater: boolean
}

interface IEngineSessionEvent {
  kind:
    | "handshakeStarted"
    | "handshakeCompleted"
    | "ready"
    | "copyProtectionChecking"
    | "copyProtectionOk"
    | "copyProtectionError"
    | "registrationChecking"
    | "registrationOk"
    | "registrationError"
  detail: string | null
}
```

## Rules
- Engine inventory lives in settings data.
- Assigned-engine snapshots live in saved game data.
- `id` is an opaque stable internal key for the saved profile record; uniqueness is not a user-facing editing rule.
- `displayName` is the user-facing engine profile name and must be unique within the saved profile list.
- `IAssignedEngine.assignedEngineId` is the stable per-game engine-participant identity used by runtime sessions and in-game removal flows.
- `IAssignedEngine.sourceProfileId` is an optional provenance link back to the reusable engine profile record and may be `null` when the source profile no longer exists.
- Creating an assigned engine from a profile copies the display name, executable path, protocol, and option values into the saved game payload so existing games do not change when the reusable profile is edited later.
- Analysis assignment is per game and preserves rendered roster order through `assignedEngines`.
- A running session is isolated by game, assigned engine, and role.
- The baseline permits at most four concurrent analysis engines per game.
- Higher layers use ChessVue board and move structures; protocol-specific payloads and strings are an internal detail of the concrete engine client implementation.
- `IEnginePositionState` is the engine-facing projection of ChessVue move-tree state and lets the engine client decide whether it can continue the current line or must establish a new game boundary.
- `executablePath` and `options` are user-managed profile values and are not strictly validated at settings-edit time beyond being storable in the profile record.
