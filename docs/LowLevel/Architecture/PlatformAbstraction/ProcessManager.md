# ProcessManager

## Purpose
Own native or Worker process lifecycle for the selected engine implementation.

## Public Interface
```ts
import type { IProcess } from '@/contracts/platform/IProcess';

spawnProcess(entryPath: string, args?: string[]): Promise<IProcess>
assertProcessOpen(process: IProcess): void
stopProcess(process: IProcess): Promise<void>
restartProcess(process: IProcess, entryPath: string, args?: string[]): Promise<IProcess>
```

## Responsibilities
- start and stop engine processes on demand
- surface stale or closed process references through an explicit validity check used by the owning runtime paths
- isolate failures to the affected session
- stop related processes when games close or engine assignments change
- stay at the process-lifecycle boundary only; protocol-specific I/O and UCI commands belong outside this service

## Dependencies
- Node child-process APIs available through the active `NW.js` runtime
- shared platform failure contract from `DataInterface/PlatformError`

## Notes
- `ProcessManager` owns process mechanics only; it does not interpret chess, protocol semantics, engine output, or UI state.
- `EngineRuntimeService` is the owning caller for `ProcessManager` in the baseline architecture.
- `IProcess` is a shared, Node-free stream/event/kill subset. Layer 2 retains the actual returned object under engine.$.process and never persists it. The native manager returns the original ChildProcess marked raw, without a handle registry, generated id or process-session map. A private ownership Set exists only to dispose this manager's own native children. The native client uses that same object independently.
- `spawnProcess` and `restartProcess` reject with `IPlatformError` of kind `processStartFailed` when the host cannot create the process.
- `assertProcessOpen(...)` throws `IPlatformError` of kind `invalidProcessHandle` when the stored process reference is no longer valid.
- Post-start termination is observed by later process-reference checks or engine I/O failures rather than through a callback subscription contract.

## Browser Adaptation
`BrowserProcessManager` returns the exact BrowserWorkerProcess marked raw, implementing IProcess over a private Worker. The runtime and independent client retain that object directly. There is no process/transport registry or handle lookup. The manager keeps a private Set solely for platform disposal, registering its own one-shot exit listener to remove each closed process. Client listener detachment does not remove this registration. Profiles supply the actual entry script path, including the bundled Stockfish filename. The private WorkerScriptLoader creates each Worker and completely owns stored-file reads, asset mapping and bootstrap construction. Ordinary app URLs load directly; stored packages and desktop file entries use its Blob bootstrap. Native executable paths and desktop arguments reject with processStartFailed. Custom journey engine-service injection is preserved.

Worker string messages become stdout data with message-ending newlines; complete stdin lines become postMessage commands without terminators. Error/messageerror and command-delivery failures close the affected process and retain its diagnostic for the client. Closure detaches Worker handlers, terminates the Worker and emits one managed exit with null code/signal. This notification describes channel closure, not an observed OS-style Worker exit. Script readiness still comes from the UCI handshake; silent Worker self-close is not detectable through this subset.

assertProcessOpen reads the supplied object's concrete type and closed state, without a membership lookup. stopProcess checks first, registers a one-shot exit listener and calls kill. An already-closed or absent concrete resource returns successfully; stop never calls assertProcessOpen or waits for another exit from a closed process. Restart awaits stop before spawning a new object; platform disposal kills its remaining live objects. BrowserWorkerProcess takes only its Worker in the constructor.

## Lifecycle Example
`ProcessManager` only sees process creation and termination boundaries.

Example lower-level usage:

```text
spawn process -> stockfish.exe
assert process reference open -> continue or throw invalid process reference
stop process -> session closed
```

Protocol-specific examples such as UCI do not belong in `ProcessManager`.

## Native process setup and termination

The manager waits for successful spawn, sets stdout and stderr to UTF-8 with setEncoding('utf8'), removes its temporary startup listeners and returns the exact spawned object. Output listeners therefore receive strings, including UTF-8 characters split across underlying byte chunks. Existing executable/argument and piped-stdio settings stay unchanged.

assertProcessOpen reads the native exitCode and signalCode through NwjsUtility; both must be null. PID is diagnostic only and killed is not an exit flag. There is no membership lookup. An exited process retains the existing invalidProcessHandle error kind.

stopProcess returns successfully if the resource is already stopped. For a live resource it checks liveness, registers a one-shot exit listener, calls process.kill() and awaits exit. Each stop call owns its temporary exit listener; EngineRuntimeService serialises shutdown for an assigned engine. Refused or thrown termination settles silently and removes the temporary exit listener, allowing an explicit retry. Restart awaits stop before spawning the replacement. Manager disposal rejects later starts, settles an in-flight start and awaits every owned stop attempt without propagating termination errors; unrelated native processes remain untouched.

## Stored files and desktop Worker targets

BrowserProcessManager and NwjsProcessManager independently derive private WorkerProcessManagerBase implementation support. No concrete manager imports another. The base owns its process set, lifetime signal and WorkerScriptLoader. The protected host URL hook remains the only host override. NwjsProcessManager's existing enum selects native or inherited Worker methods; native shutdown retains direct process references and drains the manager's private ownership Set.

spawnProcess resolves the URL, awaits the self-contained loader's createWorker, checks manager lifetime, wraps the returned Worker and retains that exact process for disposal. The loader accepts plain storage configuration and uses only native browser APIs. A returned Blob Worker owns its asset URLs and releases them through terminate; no caller cleanup callback or resource preparation object is required. Concurrent processes own independent assets.

Concrete dispose aborts pending file reads and synchronously kills its live Worker processes. A result delivered after disposal is terminated by spawnProcess before being returned. Failure before Worker construction releases allocated Blob URLs. Disposal remains promise-shaped, with error handling owned by its caller; there is no registration, server, control wait, readiness cache, timeout or new runtime/platform API.

NwjsProcessManager retains existing NodeUtility path/URL conversion. File entries load through a Blob bootstrap with original file import/fetch/XHR resolution, avoiding direct external-file Worker construction. Bundled app URLs load normally. There are no added flags, copied packages or local servers. The selected bootstrap supports tested classic single-Worker builds, including Stockfish/WASM and Lozza; nested/module Workers remain unsupported.
