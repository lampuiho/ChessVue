# Engine Types

## Purpose
Define configured engine records, copied in-game engine snapshots, and engine analysis request or update types.

## Types
- `enum EngineClientType`
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
enum EngineClientType {
  Uci = "uci"
}

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

interface IEngineRecord {
  id: string
  displayName: string
  executablePath: string
  clientType: EngineClientType
  protocol: EngineProtocol
  options: IEngineOptionMap
}

interface IEngineOptionMap {
  [optionName: string]: string | number | boolean
}

interface IAssignedEngineRuntime {
  processHandle?: ProcessHandle
  availability: EngineAvailability
  lastError?: string
  analysisCallback?: (update: IEngineAnalysisUpdate) => void
  analysisLines: Map<number, IAnalysisLine>
}

interface IAssignedEngine {
  displayName: string
  executablePath: string
  clientType: EngineClientType
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
  bestMove?: IMove
  lines: IAnalysisLine[]
  isFinal: boolean
}

interface IEngineRegistrationRequest {
  name?: string
  code?: string
  registerLater: boolean
}
```

## Concrete Runtime Refinement Example
The shared data contract stops at `IAssignedEngineRuntime`.

A concrete protocol client may refine that runtime shape privately. For the baseline UCI client, the design expectation is:

```ts
interface IAssignedUciEngineRuntime extends IAssignedEngineRuntime {
  session?: IUciSession
}
```

`session` is optional before the client runs its explicit session-initialisation step and required afterwards for later protocol operations.

## Rules
- Engine inventory lives in settings data.
- Assigned-engine snapshots live in saved game data and are copied by value from the selected reusable engine profile.
- `id` is an opaque stable internal key for the saved profile record; uniqueness is not a user-facing editing rule.
- `displayName` is the user-facing engine profile name and must be unique within the saved profile list.
- `clientType` identifies which platform engine client is responsible for the profile or assigned-engine snapshot.
- Creating an assigned engine from a profile copies the display name, executable path, client type, protocol, and option values into the saved game payload so existing games do not change when the reusable profile is edited later or when the reusable profile is deleted.
- `IAssignedEngine` is the canonical in-game engine object used by engine-backed players and persisted analysis snapshots.
- The baseline permits at most four concurrent analysis engines per game.
- `IAssignedEngineRuntime` defines the minimum shared runtime contract for an assigned engine instance.
- `IAssignedEngine.$` is the runtime-only engine namespace. It is rebuilt in memory, is never persisted, and must at minimum carry the current process handle, availability, last error, active analysis callback, and cached analysis lines for that engine instance.
- Omitted `processHandle`, `lastError`, `bestMove`, `name`, and `code` fields mean those values are currently unavailable or intentionally not supplied.
- Concrete `EngineClient` implementations may refine `IAssignedEngine.$` through inherited runtime interfaces when they need client-private protocol-session state.
- Those refinements remain private to the owning concrete client implementation. Higher layers depend only on the shared minimum runtime fields plus the documented service and client APIs.
- Client-private runtime fields such as a concrete UCI session object, current synced position, attached listener references, or pending player-move state are valid concrete `EngineClient` refinements and are not part of the shared contract.
- `EngineRuntimeService` relies on the shared minimum runtime fields only. It does not need to refine `IAssignedEngine.$` for its documented ownership.
- The baseline runtime design uses explicit object-attached fields for shared runtime state and explicit object-attached fields for client-private runtime state. It does not rely on hidden side tables.
- Higher layers use ChessVue board and move structures; protocol-specific payloads and strings are an internal detail of the concrete engine client implementation.
- `IEnginePositionState` is the engine-facing projection of ChessVue move-tree state and lets the engine client decide whether it can continue the current line or must establish a new game boundary.
- `IEngineAnalysisUpdate` is an app-facing streamed update shape. It includes both the current `position` and the derived `positionKey` so higher layers can reject stale results deterministically when the target changes.
- `executablePath` and `options` are user-managed profile values and are not strictly validated at settings-edit time beyond being storable in the profile record.
