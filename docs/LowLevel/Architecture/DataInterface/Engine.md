# Engine Types

## Purpose
Define configured engine records, copied in-game engine snapshots, and engine analysis request or update types.

## Types
- `enum EngineClientType`
- `enum EngineInstallationSource`
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
  Uci = "uci",
  UciWorker = "uciWorker",
}

enum EngineInstallationSource {
  Bundled = "bundled",
  User = "user",
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
  entryPath: string
  clientType: EngineClientType
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
  process?: IProcess
  availability: EngineAvailability
  lastError?: string
  analysisCallback?: (update: IEngineAnalysisUpdate) => void
  analysisLines: Map<number, IAnalysisLine>
  analysisOperation?: IEngineAnalysisOperation;
  analysisWork?: Promise<void>;
  analysisNeedsStop?: boolean;
}

interface IEngineAnalysisOperation {
  abortController: AbortController;
  completion: Deferred<void>;
  isFinal: boolean;
}

interface IAssignedEngine {
  displayName: string
  entryPath: string
  clientType: EngineClientType
  options: IEngineOptionMap
  $?: IAssignedEngineRuntime
}

interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: EngineAnalysisSearchMode
}

interface IEngineAnalysisUpdate {
  readonly position: DeepReadonly<IBoardPosition>
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
- `IEngineOptionMap` remains the authoritative saved configured name/value map. Discovered metadata does not populate, validate, or reconcile it.
- `EnginesStore` caches discovered metadata separately by reusable profile id for profile-editor rendering. `EngineRuntimeService.getOptions(...)` obtains that metadata through a temporary runtime which is closed before the metadata is returned.
- Licensed-engine credentials are out of scope. A UCI engine that reports `registration error` receives the fixed `register later` response from the concrete UCI client.
- Assigned-engine snapshots live in saved game data and are copied by value from the selected reusable engine profile. **Why:** a profile is editable inventory for future assignment, while an assigned engine is reproducible game state; retaining only the profile id would let a later edit or deletion retroactively change or break an existing game. A shared-process design may change runtime allocation later, but a saved game must still own the launch configuration it was assigned.
- `id` is an opaque stable internal key for the saved profile record; uniqueness is not a user-facing editing rule.
- `displayName` is the user-facing engine profile name and must be unique within the saved profile list.
- `clientType` identifies which platform engine client is responsible for the profile or assigned-engine snapshot.
- When a selected reusable engine profile is assigned to a game, `GamesStore` copies the display name, entry path, client type and option values into the saved game payload. The option map is shallow-copied because it remains mutable on the source profile and every allowed value is a primitive; a deep clone provides no additional isolation. Runtime `$` data is excluded because process references, callbacks, and protocol sessions belong to one active assignment and cannot be reused safely.
- `IAssignedEngine` is the canonical in-game engine object used by engine-backed players and persisted analysis seats.
- The baseline permits at most four concurrent analysis engines per game.
- `IAssignedEngineRuntime` defines the minimum shared runtime contract for an assigned engine instance.
- `IAssignedEngine.$` is the runtime-only engine namespace. It is rebuilt in memory, is never persisted, and must at minimum carry the current process reference, availability, last error, active analysis callback, and cached analysis lines for that engine instance.
- Omitted `process`, `lastError`, and `bestMove` fields mean those values are currently unavailable or intentionally not supplied.
- Concrete `EngineClient` implementations may refine `IAssignedEngine.$` through inherited runtime interfaces when they need client-private protocol-session state.
- Those refinements remain private to the owning concrete client implementation. Higher layers depend only on the shared minimum runtime fields plus the documented service and client APIs.
- Client-private runtime fields such as a concrete UCI session object, session state, current search position, expected ponder move, attached listener references, or pending player-move state are valid concrete `EngineClient` refinements and are not part of the shared contract.
- `EngineRuntimeService` relies on the shared minimum runtime fields only. It does not need to refine `IAssignedEngine.$` for its documented ownership.
- The baseline runtime design uses explicit object-attached fields for shared runtime state and explicit object-attached fields for client-private runtime state. It does not rely on hidden side tables.
- Higher layers use ChessVue board and move structures; protocol-specific payloads and strings are an internal detail of the concrete engine client implementation.
- Purpose-level analysis, player-turn, and ponder calls receive the canonical `IGame`. The concrete engine client derives the required rendered or live path, current position, and protocol-specific new-game boundary internally without an intermediate projection contract.
- `IEngineAnalysisUpdate` contains the fixed searched `position` and every retained line in engine rank order. It has no position key or three-line cap. The client allocates a new ordered array per emission and keeps line/PV objects immutable; the game subscription selects up to three rendered lines while retaining those objects.
- `analysisOperation`, `analysisWork`, and `analysisNeedsStop` are service-owned runtime fields. The operation holds cancellation/completion and final-update state; the work handle serialises issued operations while superseded requests skip startup; the stop flag records whether a client search needs draining. `analysisCallback` is the only stored subscriber field. The service captures its reference locally when starting analysis or disposing an engine, so old work cannot invoke or clear a replacement subscription. These fields do not expose protocol states and are never persisted.
- `entryPath` and `options` are user-managed profile values and are not strictly validated at settings-edit time beyond being storable in the profile record.

## Shared process reference

IProcess, IProcessInput and IProcessOutput are defined in src/contracts/platform/IProcess.ts. The input writes string commands; optional stdout/stderr outputs deliver string chunks through data listeners. Exit listeners receive the native nullable code/signal pair; kill requests termination. Node-specific stream types and lifecycle properties remain in the native model.

The native process manager establishes the UTF-8 output guarantee before handing the actual ChildProcess to EngineRuntimeService. The browser manager returns a BrowserWorkerProcess implementing the same IProcess subset over its private Worker. Both returned objects are marked raw and retained directly by the runtime and independent client; no registry lookup or raw-Worker assertion is required. Browser exit notifications describe managed channel closure and use null code/signal, with private diagnostic detail retained on the process. No process object or stream is serialised.

## Package projections

IEngineLaunch contains clientType and entryPath and is shared by profiles, assigned configurations and named package-usage projections. IEnginePackage contains packagePath, displayName, EngineInstallationSource, files and an optional per-folder warning. IEnginePackageFile contains path and original Uint8Array bytes; IEngineArchive contains its readonly file list. IEnginePackageUsage adds a displayName to IEngineLaunch.

These are transient projections or launch snapshots. No installation id, manifest, version, protocol field or catalogue is introduced. The browser reconstructs folders/files from storage keys; bundled files are an ordinary app folder. Frontend validation owns unique folder names.
