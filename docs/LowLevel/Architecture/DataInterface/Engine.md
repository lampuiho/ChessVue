# Engine Types

## Purpose
Define configured engine records, launch and package projections, copied in-game engine snapshots, and engine analysis request or update types. Source: `contracts/Engine.ts`.

## Types
- `enum EngineClientType`
- `enum EngineInstallationSource`
- `enum EngineAvailability`
- `enum EngineAnalysisSearchMode`
- `enum EngineOptionType`
- `type IEngineSelection`
- `type EngineAnalysisUpdateHandler`

## Interfaces
- `interface IEngineOptionMap`
- `interface IEngineOptionMeta`
- `interface IEngineLaunch`
- `interface IEngineRecord`
- `interface IEnginePackage`
- `interface IEnginePackageFile`
- `interface IEngineArchive`
- `interface IEnginePackageUsage`
- `interface IEngineAnalysisOperation`
- `interface IAssignedEngineRuntime`
- `interface IAssignedEngine`
- `interface IEngineAnalysisRequest`
- `interface IEngineAnalysisUpdate`

## Data Structures
```ts
const enum EngineClientType {
  Uci = "uci",
  UciWorker = "uciWorker"
}

const enum EngineInstallationSource {
  Bundled = "bundled",
  User = "user"
}

const enum EngineAvailability {
  Ready = "ready",
  Starting = "starting",
  Running = "running",
  Unavailable = "unavailable",
  Failed = "failed"
}

const enum EngineAnalysisSearchMode {
  Infinite = "infinite"
}

const enum EngineOptionType {
  Action = "action",
  Boolean = "boolean",
  Choice = "choice",
  Integer = "integer",
  Text = "text"
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

interface IEngineLaunch {
  clientType: EngineClientType
  entryPath: string
}

interface IEngineRecord extends IEngineLaunch {
  id: string
  displayName: string
  options: IEngineOptionMap
}

type IEngineSelection = Omit<IEngineRecord, "id">

interface IEnginePackage {
  packagePath: string
  displayName: string
  source: EngineInstallationSource
  files: string[]
  warning?: string
}

interface IEnginePackageFile {
  path: string
  data: Uint8Array<ArrayBuffer>
}

interface IEngineArchive {
  files: readonly IEnginePackageFile[]
}

interface IEnginePackageUsage extends IEngineLaunch {
  displayName: string
}

interface IEngineAnalysisOperation {
  abortController: AbortController
  completion: Deferred<void>
  isFinal: boolean
}

interface IAssignedEngineRuntime {
  process?: IProcess
  availability: EngineAvailability
  lastError?: string
  analysisCallback?: (update: IEngineAnalysisUpdate) => void
  analysisLines: Map<number, IAnalysisLine>
  analysisOperation?: IEngineAnalysisOperation
  analysisWork?: Promise<void>
  analysisClientWork?: Promise<void>
  analysisShutdownWork?: Promise<void>
  analysisNeedsStop?: boolean
}

interface IAssignedEngine extends IEngineSelection {
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

type EngineAnalysisUpdateHandler = (update: IEngineAnalysisUpdate) => boolean | void
```

## Schemas
- `engineClientTypes`, `engineAvailabilities`, and `engineAnalysisSearchModes` feed `engineClientTypeSchema`, `engineAvailabilitySchema`, and `engineAnalysisSearchModeSchema`. `EngineInstallationSource` and `EngineOptionType` describe transient projections and have no schema.
- `engineOptionValueSchema` accepts a string, number, or boolean; `engineOptionMapSchema` is a string-keyed record of those values.
- `engineRecordSchema` requires a non-empty `id` and `displayName`, a string `entryPath` (which may be empty), `clientType`, and `options`. `assignedEngineSchema` is the same shape without `id` and without `$`.
- Both schemas default an omitted `clientType` to `EngineClientType.Uci`. **Why:** `clientType` was added when `uci` was the only client, so records written before it existed must still parse as the client that originally ran them.
- `engineAnalysisRequestSchema` requires an integer `multiPv >= 1`.
- `ISettingsAnalysis.engineInventory` adds a unique-`displayName` refinement (see [Settings](Settings.md)); creation requests cap analysis profiles at four (see [Game](Game.md#schemas)).

## Client Types
- `EngineClientType` is the single implementation selector for a profile or assigned engine. It names the app-facing protocol interface, not an engine brand, file name, or JS-versus-WASM build; another supported interface gets another member.
- `Uci` launches a native executable as a child process. Only the NW.js desktop host binds it; the browser host binds it only when an isolated test bootstrap injects engine services.
- `UciWorker` runs a supplied UCI entry script in a Web Worker that exchanges UCI strings through `postMessage`. Both hosts bind it. The bundled Stockfish profile (`id: "stockfish"`, `displayName: "Stockfish"`) uses it with the WASM build at `StockfishConfig.entryPath` (`engines/stockfish/stockfish-19-lite-single.js`).
- `entryPath` is the actual launch target interpreted by that client: a native executable path for `Uci`, or an app-served or browser-package entry script for `UciWorker`. There is no separate protocol or execution-kind field. The rationale is recorded in the archived [engine installation rework plan](../../../ArchivedPlans/EngineInstallationReworkPlan.md).

## Concrete Runtime Refinement Example
The shared data contract stops at `IAssignedEngineRuntime`.

A concrete protocol client may refine that runtime shape privately. The shared UCI client base (`platform/base/UciEngineClientBase.ts`, used by both the native and worker UCI clients) declares:

```ts
interface IAssignedUciEngineRuntime extends IAssignedEngineRuntime {
  session?: IUciSession
}
```

`session` is optional before the client runs its explicit session-initialisation step and required afterwards for later protocol operations.

## Rules
- Engine inventory lives in settings data (`ISettingsAnalysis.engineInventory`).
- `IEngineOptionMeta` is protocol-neutral metadata discovered by an engine client. It is not currently stored on `IEngineRecord` or `IAssignedEngine`.
- `IEngineOptionMap` remains the authoritative saved configured name/value map. Discovered metadata does not populate, validate, or reconcile it.
- `EnginesStore` caches discovered metadata separately by reusable profile id for profile-editor rendering. `EngineRuntimeService.getOptions(...)` obtains that metadata through a temporary runtime which is closed before the metadata is returned.
- Licensed-engine credentials are out of scope. A UCI engine that reports `registration error` receives the fixed `register later` response from the concrete UCI client.
- Assigned-engine snapshots live in saved game data and are copied by value from the selected reusable engine profile. **Why:** a profile is editable inventory for future assignment, while an assigned engine is reproducible game state; retaining only the profile id would let a later edit or deletion retroactively change or break an existing game. A shared-process design may change runtime allocation later, but a saved game must still own the launch configuration it was assigned.
- `IEngineLaunch` holds the launch fields (`clientType`, `entryPath`) shared by profiles, assigned engines, and package-usage projections. `IEngineSelection` is a profile without its inventory `id`; `IAssignedEngine` adds only the runtime namespace to it.
- `id` is an opaque stable internal key for the saved profile record; uniqueness is not a user-facing editing rule. Copies of a profile inside `gameDefaults.analysisEngineProfiles` or creation requests keep the copied `id` as inert data; creation never resolves it against the inventory.
- `displayName` is the user-facing engine profile name and must be unique within the saved profile list.
- `clientType` identifies which platform engine client is responsible for the profile or assigned-engine snapshot.
- When a selected reusable engine profile is assigned to a game, `GamesStore` copies the display name, entry path, client type and option values into the saved game payload (`GameAnalysisComposable` for analysis seats, `createEnginePlayer(...)` for engine players). The option map is shallow-copied because it remains mutable on the source profile and every allowed value is a primitive; a deep clone provides no additional isolation. Runtime `$` data is excluded because process references, callbacks, and protocol sessions belong to one active assignment and cannot be reused safely.
- `IAssignedEngine` is the canonical in-game engine object used by engine-backed players and persisted analysis seats.
- The baseline permits at most four concurrent analysis engines per game.
- `IAssignedEngineRuntime` defines the minimum shared runtime contract for an assigned engine instance.
- `IAssignedEngine.$` is the runtime-only engine namespace. It is rebuilt in memory, is never persisted, and must at minimum carry the current process reference, availability, last error, active analysis callback, and cached analysis lines for that engine instance. `EngineRuntimeService.ensureRuntime(...)` creates it without starting a process and keeps an existing runtime; analysis seats wrap it in `shallowReactive` so its top-level runtime fields, such as availability, are observable.
- Omitted `process`, `lastError`, and `bestMove` fields mean those values are currently unavailable or intentionally not supplied.
- Concrete `EngineClient` implementations may refine `IAssignedEngine.$` through inherited runtime interfaces when they need client-private protocol-session state.
- Those refinements remain private to the owning concrete client implementation. Higher layers depend only on the shared minimum runtime fields plus the documented service and client APIs.
- Client-private runtime fields such as a concrete UCI session object, session state, current search position, expected ponder move, attached listener references, or pending player-move state are valid concrete `EngineClient` refinements and are not part of the shared contract.
- `EngineRuntimeService` relies on the shared minimum runtime fields only. It does not need to refine `IAssignedEngine.$` for its documented ownership.
- The baseline runtime design uses explicit object-attached fields for shared runtime state and explicit object-attached fields for client-private runtime state. It does not rely on hidden side tables.
- Higher layers use ChessVue board and move structures; protocol-specific payloads and strings are an internal detail of the concrete engine client implementation.
- Purpose-level analysis, player-turn, and ponder calls receive the canonical `IGame`. The concrete engine client derives the required rendered or live path, current position, and protocol-specific new-game boundary internally without an intermediate projection contract.
- `IEngineAnalysisUpdate` contains the fixed searched `position` and every retained line in engine rank order. It has no position key or three-line cap. The client allocates a new ordered array per emission and keeps line/PV objects immutable; the game subscription selects up to three rendered lines while retaining those objects.
- `EngineAnalysisUpdateHandler` is the callback the service passes to `IEngineClient.startAnalysis(...)`. It returns `false` when the service rejects an update (a superseded or already-final operation, a replaced subscriber, or an illegal best move or PV), and the client then restores its previous line for that rank; any other return accepts the update.
- `analysisOperation`, `analysisWork`, `analysisClientWork`, `analysisShutdownWork`, and `analysisNeedsStop` are service-owned runtime fields; each is the explicit owner of one piece of in-flight work rather than an invalidation counter:
  - `analysisOperation` holds the current operation's cancellation, completion, and final-update state. Beginning a new operation aborts and rejects the previous one with `Aborted`.
  - `analysisWork` serialises issued operations; a superseded queued request skips startup.
  - `analysisClientWork` settles when the current client call drains, even if its caller has been cancelled, so teardown knows whether a physical stop is needed to release a blocked client wait.
  - `analysisShutdownWork` is the one issued physical shutdown that successive stop or restart requests share.
  - `analysisNeedsStop` records whether a started client search still needs draining.
- `analysisCallback` is the only stored subscriber field. The service captures its reference locally when starting analysis or disposing an engine, so old work cannot invoke or clear a replacement subscription. These fields do not expose protocol states and are never persisted.
- `entryPath` and `options` are user-managed profile values and are not strictly validated at settings-edit time beyond being storable in the profile record. Creation validation (`getGameCreationError(...)`) does require a non-blank `entryPath` for every engine seat and analysis profile.

## Shared Process Reference
`IProcess`, `IProcessInput`, and `IProcessOutput` are defined in `contracts/platform/IProcess.ts` and owned by [ProcessManager](../PlatformAbstraction/ProcessManager.md). The input writes string commands; optional stdout/stderr outputs deliver string chunks through data listeners. Exit listeners receive the native nullable code/signal pair; `kill` requests termination. Node-specific stream types and lifecycle properties remain in the native model.

For `Uci`, the NW.js process manager sets UTF-8 output encoding before handing the actual `ChildProcess` to `EngineRuntimeService`. For `UciWorker`, both hosts return a `BrowserWorkerProcess` implementing the same `IProcess` subset over its private `Worker`. Both returned objects are marked raw and retained directly by the runtime and the client; no registry lookup or raw-Worker assertion is required. Worker exit notifications describe managed channel closure and use `null` code/signal, with private diagnostic detail retained on the process. No process object or stream is serialised.

## Package Projections
- `IEnginePackage` is a transient folder-discovery result, not a persisted record: `packagePath` is the folder, `displayName` the folder name, `source` whether it is the app-shipped (`Bundled`) or user-imported (`User`) folder, `files` its relative file paths, and `warning` a per-folder read failure that leaves the folder listed with no files. `source` never selects the runtime.
- The bundled package is the ordinary `engines/stockfish` app folder. User packages exist only on the browser host, under `EnginePackageConfig.rootPath`, and are reconstructed from stored file keys.
- `IEnginePackageFile` carries a `path` and the original bytes in `data`. For an archive input, `path` is the selected filename; after decoding, each file keeps its relative path inside the archive. `IEngineArchive` holds only the decoded, validated file list.
- `IEnginePackageUsage` adds a reference label (`displayName`) to copied launch fields. Presentation collects usages from saved and draft settings, profiles, and open games so package removal can refuse a folder that a `UciWorker` entry still references.
- These are transient projections or launch snapshots. No installation id, manifest, version, protocol field or catalogue is introduced. Frontend validation owns unique folder names. Package operations are owned by [EnginePackageService](../DomainLogic/EnginePackageService.md).
