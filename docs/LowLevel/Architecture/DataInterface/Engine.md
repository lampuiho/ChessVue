# Engine Types

## Purpose
Define configured engine records, copied in-game engine snapshots, and engine analysis request or update types.

## Types
- `enum EngineClientType`
- `enum EngineProtocol`
- `enum EngineAvailability`
- `enum EngineAnalysisSearchMode`
- `enum EngineOptionType`

## Interfaces
- `interface IEngineRecord`
- `interface IEngineOptionMap`
- `interface IEngineOptionMeta`
- `interface IAssignedEngineRuntime`
- `interface IAssignedEngine`
- `interface IEngineAnalysisRequest`
- `interface IEngineAnalysisUpdate`

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

enum EngineOptionType {
  Action = "action",
  Boolean = "boolean",
  Choice = "choice",
  Integer = "integer",
  Text = "text"
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

interface IEngineOptionMeta {
  name: string
  type: EngineOptionType
  defaultValue?: string | number | boolean
  minimum?: number
  maximum?: number
  choices?: string[]
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

interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: EngineAnalysisSearchMode
}

interface IEngineAnalysisUpdate {
  readonly position: DeepReadonly<IBoardPosition>
  readonly positionKey: string
  readonly bestMove?: DeepReadonly<IMove>
  readonly lines: readonly DeepReadonly<IAnalysisLine>[]
  readonly isFinal: boolean
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
- `IEngineOptionMeta` is protocol-neutral metadata discovered by an engine client. It is not currently stored on `IEngineRecord` or `IAssignedEngine`.
- `IEngineOptionMap` remains the configured name/value map. The later owner and timing for populating that map from discovered metadata are intentionally unresolved.
- Licensed-engine credentials are out of scope. A UCI engine that reports `registration error` receives the fixed `register later` response from the concrete UCI client.
- Assigned-engine snapshots live in saved game data and are copied by value from the selected reusable engine profile. **Why:** a profile is editable inventory for future assignment, while an assigned engine is reproducible game state; retaining only the profile id would let a later edit or deletion retroactively change or break an existing game. A shared-process design may change runtime allocation later, but a saved game must still own the launch configuration it was assigned.
- `id` is an opaque stable internal key for the saved profile record; uniqueness is not a user-facing editing rule.
- `displayName` is the user-facing engine profile name and must be unique within the saved profile list.
- `clientType` identifies which platform engine client is responsible for the profile or assigned-engine snapshot.
- When a selected reusable engine profile is assigned to a game, `GamesStore` copies the display name, executable path, client type, protocol, and option values into the saved game payload. The option map is shallow-copied because it remains mutable on the source profile and every allowed value is a primitive; a deep clone provides no additional isolation. Runtime `$` data is excluded because process handles, callbacks, and protocol sessions belong to one active assignment and cannot be reused safely.
- `IAssignedEngine` is the canonical in-game engine object used by engine-backed players and persisted analysis snapshots.
- The baseline permits at most four concurrent analysis engines per game.
- `IAssignedEngineRuntime` defines the minimum shared runtime contract for an assigned engine instance.
- `IAssignedEngine.$` is the runtime-only engine namespace. It is rebuilt in memory, is never persisted, and must at minimum carry the current process handle, availability, last error, active analysis callback, and cached analysis lines for that engine instance.
- Omitted `processHandle`, `lastError`, and `bestMove` fields mean those values are currently unavailable or intentionally not supplied.
- Concrete `EngineClient` implementations may refine `IAssignedEngine.$` through inherited runtime interfaces when they need client-private protocol-session state.
- Those refinements remain private to the owning concrete client implementation. Higher layers depend only on the shared minimum runtime fields plus the documented service and client APIs.
- Client-private runtime fields such as a concrete UCI session object, session state, current search position, expected ponder move, attached listener references, or pending player-move state are valid concrete `EngineClient` refinements and are not part of the shared contract.
- `EngineRuntimeService` relies on the shared minimum runtime fields only. It does not need to refine `IAssignedEngine.$` for its documented ownership.
- The baseline runtime design uses explicit object-attached fields for shared runtime state and explicit object-attached fields for client-private runtime state. It does not rely on hidden side tables.
- Higher layers use ChessVue board and move structures; protocol-specific payloads and strings are an internal detail of the concrete engine client implementation.
- Purpose-level analysis, player-turn, and ponder calls receive the canonical `IGame`. The concrete engine client derives the required rendered or live path, current position, and protocol-specific new-game boundary internally without an intermediate projection contract.
- `IEngineAnalysisUpdate` is an app-facing readonly streamed update shape. It includes both the current `position` and the derived `positionKey` so higher layers can reject stale results deterministically when the target changes. The client allocates a new ordered lines array for each emission and does not mutate an emitted payload afterwards, allowing `GamesStore` to retain its result references.
- `executablePath` and `options` are user-managed profile values and are not strictly validated at settings-edit time beyond being storable in the profile record.
