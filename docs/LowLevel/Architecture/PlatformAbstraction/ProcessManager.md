# ProcessManager

## Purpose
Own native-process or Worker lifecycle for the engine binding selected by `EngineClientType`.

## Public Interface
```ts
// src/contracts/platform/IProcess.ts
interface IProcessInput {
  write(chunk: string): boolean;
}
interface IProcessOutput {
  on(event: 'data', listener: (chunk: string) => void): unknown;
  removeListener(event: 'data', listener: (chunk: string) => void): unknown;
}
interface IProcess {
  readonly stdin?: IProcessInput;
  readonly stdout?: IProcessOutput;
  readonly stderr?: IProcessOutput;
  once(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  removeListener(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  kill(): boolean;
}

// src/contracts/platform/IProcessManager.ts
interface IProcessManager {
  spawnProcess(entryPath: string, args?: string[]): Promise<IProcess>;
  assertProcessOpen(process: IProcess): void;
  stopProcess(process: IProcess): Promise<void>;
  restartProcess(process: IProcess, entryPath: string, args?: string[]): Promise<IProcess>;
}
```

Concrete managers also implement `dispose(): Promise<void>`. It is called only by the platform store that constructed the manager and is not part of `IProcessManager`.

## Responsibilities
- start, stop and restart engine processes or Workers on demand
- return the actual process object, which the runtime retains and the engine client reads independently
- surface closed process references through an explicit validity check
- isolate failures to the affected process
- release every process this manager created when its platform scope is disposed
- stay at the lifecycle boundary; protocol I/O and UCI commands belong to `EngineClient`

## Dependencies
- NW.js native binding: Node `child_process` and `path`/`url` resolved through `NodeUtility`, and `NwjsUtility.isProcessOpen`
- Worker bindings: `WorkerScriptLoader`, `BrowserWorkerProcess` and `EnginePackageConfig`
- shared platform failure contract from [PlatformError](../DataInterface/PlatformError.md)

## Contract Notes
- `IProcess` is a small Node-free stream, event and kill subset. **Why:** a PID or generated handle cannot recover a process's streams, while the earlier handle registries duplicated identity the runtime already held. A native `ChildProcess` spawned with piped stdio satisfies the subset directly, and a Worker can be adapted to it. See [NwjsProcessOwnershipFixPlan](../../../ArchivedPlans/NwjsProcessOwnershipFixPlan.md).
- `EngineRuntimeService` is the owning caller. It stores the returned object on `engine.$.process`, never persists it, and passes that same object back to the manager selected by the assignment's copied `clientType`. There is no handle registry, generated id or process-session map.
- Output arrives as strings. `kill()` returning `true` means the termination request was accepted, not that a physical exit was observed.
- `spawnProcess` and `restartProcess` reject with `processStartFailed` when the host cannot create the process or the manager has been disposed.
- `assertProcessOpen(...)` throws `invalidProcessHandle` when the reference is no longer open. It inspects the supplied object only; there is no membership lookup.
- `stopProcess(...)` is idempotent: an already-closed or unsupported reference returns successfully, and stop never calls `assertProcessOpen`. **Why:** waiting for an exit event from a process that has already exited would never settle, and shutdown paths must work after an unexpected exit. See [EngineInstallationReworkPlan](../../../ArchivedPlans/EngineInstallationReworkPlan.md#implementation-boundary).
- `restartProcess` awaits `stopProcess` before spawning the replacement.
- Post-start termination is observed by later validity checks, engine I/O failures or the client's own exit listener, not through a manager callback contract.

## Concrete Implementations
| Class | Location | Bindings |
| --- | --- | --- |
| `WorkerProcessManagerBase` (abstract) | `src/platform/base/WorkerProcessManagerBase.ts` | Shared Worker mechanics; private implementation support, not a composed platform interface |
| `BrowserProcessManager` | `src/platform/browser/BrowserProcessManager.ts` | Browser `UciWorker`; inherits the base unchanged |
| `NwjsProcessManager` | `src/platform/nwjs/NwjsProcessManager.ts` | Desktop `Uci` (native) and `UciWorker` (inherited Worker methods), selected by its constructor's `EngineClientType` |

`BrowserProcessManager` and `NwjsProcessManager` each derive the base independently; neither concrete manager imports the other. The protected `_resolveWorkerUrl(entryPath)` hook is the only host override of Worker behaviour.

## Worker Processes
`WorkerProcessManagerBase` privately owns a `Set<BrowserWorkerProcess>` used only for disposal, one lifetime `AbortController`, and its own `WorkerScriptLoader(EnginePackageConfig)`.

- `spawnProcess` rejects desktop-style arguments, then rejects if the lifetime is aborted. It resolves the entry URL, awaits `createWorker(url, appBaseUrl, lifetimeSignal, { name: 'ChessVue UCI' })`, checks the lifetime again, wraps the Worker in `markRaw(new BrowserWorkerProcess(worker))`, adds it to the set and registers its own one-shot exit listener that removes it. Any failure terminates a Worker that was already created and rejects with `processStartFailed`.
- `assertProcessOpen` requires a `BrowserWorkerProcess` whose channel is not closed.
- `stopProcess` returns for a closed or unsupported reference; otherwise it registers a one-shot exit listener and calls `kill()`. The managed exit is emitted synchronously after `Worker.terminate()`.
- `dispose()` aborts the lifetime, which cancels pending stored-file reads and rejects later spawns, then kills every live Worker process. A Worker delivered after disposal is terminated by `spawnProcess` before it could be returned.
- The browser `_resolveWorkerUrl` rejects empty entries, Windows drive or UNC paths and `.exe` targets with a message that local executables require the desktop app. It encodes stored-package paths through `WorkerScriptLoader.resolveUrl(...)` and accepts only same-origin `http:`/`https:` URLs under the app base. **Why:** a Worker entry must be served from the app's own origin or from the browser's local package store; the app never uploads engine files to a host.
- Profiles supply the actual entry script path, including the bundled `StockfishConfig.entryPath`. Ordinary app URLs construct a native Worker directly; stored packages use the loader's Blob bootstrap.
- Client listener detachment does not remove the manager's own exit listener, so disposal tracking stays correct after a session is replaced.

### BrowserWorkerProcess
`src/utility/BrowserWorkerProcess.ts` adapts one dedicated Worker to `IProcess`. Its constructor takes only the Worker; `closed` and `exitDetail` are read-only implementation details used by the Worker managers and `BrowserUciEngineClient`.

- `stdin.write(chunk)` buffers incomplete input and posts each complete line, without its terminator, through `postMessage`. Writing to a closed process throws `invalidProcessHandle`. A `postMessage` failure closes the process and throws `unexpectedExit` with the failure as detail.
- String Worker messages become `stdout` data chunks, each ending with a newline so separate messages remain separate lines. Non-string messages and output after closure are ignored. `stderr` is absent.
- `kill()` closes once and returns `true`; a repeated call returns `false`.
- One private close path serves `kill()`, Worker `error`, `messageerror` and command-delivery failure. It records the detail, detaches Worker handlers, calls `Worker.terminate()`, notifies pending exit listeners once with `(null, null)` and clears remaining listeners and input. Exit listeners are not replayed after closure.
- **Why `(null, null)`:** the Worker interface has no parent-side exit acknowledgement, PID or exit status. `closed` describes the app-managed channel, not an observed thread exit, and a Worker that silently calls `close()` cannot be detected. Script readiness still comes from the UCI handshake. See [BrowserEngineDependencyFixPlan](../../../ArchivedPlans/BrowserEngineDependencyFixPlan.md#worker-backed-process-design).

## Native Processes
`NwjsProcessManager(EngineClientType.Uci)` spawns native executables. Its `UciWorker` instance delegates spawn, validity and stop to the inherited Worker methods.

- `spawnProcess` rejects once the manager is disposed. It calls `child_process.spawn(entryPath, args, { stdio: 'pipe' })`, adds the child to a private native ownership set before startup completes, and resolves on `spawn` after setting `stdout` and `stderr` to UTF-8. **Why:** the manager owns decoding, so listeners receive strings even when a UTF-8 character is split across byte chunks. Temporary startup listeners are removed on settlement. A spawn `error` rejects with `processStartFailed`; a start that completes after disposal rejects, and disposal stops that child.
- The exact `ChildProcess` is returned marked raw. The native ownership set exists only for disposal; the child's own exit listener removes it.
- `assertProcessOpen` checks `exitCode` and `signalCode` through `NwjsUtility.isProcessOpen`; both must be `null`. `killed` is not an exit flag, and the PID is diagnostic only.
- `stopProcess` returns for an exited child. For a live child it registers a one-shot exit listener, calls `kill()` and awaits exit. A refused or throwing `kill()` settles immediately and removes its listener, allowing an explicit retry. `EngineRuntimeService` serialises shutdown for an assigned engine.
- `dispose()` is idempotent. It marks the manager disposed, then settles the inherited Worker disposal and a stop for every owned native child with `Promise.allSettled`. Unrelated native processes are untouched.
- The desktop `_resolveWorkerUrl` converts absolute paths to `file:` URLs through Node `path`/`url`, and otherwise resolves relative entries against the app base. It accepts `file:` URLs, the app's own `chrome-extension:` host and same-origin `http:`/`https:` URLs. `file:` entries load through the loader's Blob bootstrap with original file resource resolution. **Why:** constructing a Worker directly from an external file URL in the NW.js extension frame crashes or fails Chromium's dedicated-Worker origin check; the bootstrap avoids flags, servers or copied packages. See [ExternalWorkerLoadingExperiments](../../../ArchivedPlans/ExternalWorkerLoadingExperiments.md).

## Supported Worker Builds
The Blob bootstrap supports the tested classic single-Worker builds, including Stockfish lite with WASM and Lozza. Module Workers, nested Workers and multithreaded builds are not supported. See [EngineInstallationReworkPlan](../../../ArchivedPlans/EngineInstallationReworkPlan.md#stored-script-loading-options).

## Lifecycle Example
```text
spawn process -> engine executable or Worker entry script
assert process open -> continue or throw invalidProcessHandle
stop process -> await managed or native exit; already closed returns
```

Protocol-specific examples such as UCI do not belong in `ProcessManager`.
