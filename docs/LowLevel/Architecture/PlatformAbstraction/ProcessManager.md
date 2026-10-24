# ProcessManager

## Purpose
Own local child-process lifecycle for engine sessions.

## Public Interface
```ts
import type { IProcess } from '@/contracts/platform/IProcess';

spawnProcess(executablePath: string, args?: string[]): Promise<IProcess>
assertProcessOpen(process: IProcess): void
stopProcess(process: IProcess): Promise<void>
restartProcess(process: IProcess, executablePath: string, args?: string[]): Promise<IProcess>
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
- `IProcess` is a shared, Node-free stream/event/kill subset. Layer 2 retains the actual returned object under engine.$.process and never persists it. The native manager returns the original ChildProcess marked raw, with no registry, generated id or process-session map. The native client uses that same object independently.
- `spawnProcess` and `restartProcess` reject with `IPlatformError` of kind `processStartFailed` when the host cannot create the process.
- `assertProcessOpen(...)` throws `IPlatformError` of kind `invalidProcessHandle` when the stored process reference is no longer valid.
- Post-start termination is observed by later process-reference checks or engine I/O failures rather than through a callback subscription contract.

## Browser Adaptation
`BrowserProcessManager` returns the exact BrowserWorkerProcess marked raw, implementing IProcess over a private Worker. The runtime and independent client retain that object directly. There is no process/transport registry or handle lookup. The manager keeps a private Set solely for platform disposal, registering its own one-shot exit listener to remove each closed process. Client listener detachment does not remove this registration. `stockfish.js` still resolves to the bundled script; other entries remain same-origin worker URLs. Native executable paths and desktop arguments reject with processStartFailed. Custom journey engine-service injection is preserved.

Worker string messages become stdout data with message-ending newlines; complete stdin lines become postMessage commands without terminators. Error/messageerror and command-delivery failures close the affected process and retain its diagnostic for the client. Closure detaches Worker handlers, terminates the Worker and emits one managed exit with null code/signal. This notification describes channel closure, not an observed OS-style Worker exit. Script readiness still comes from the UCI handshake; silent Worker self-close is not detectable through this subset.

assertProcessOpen reads the supplied object's concrete type and closed state, without a membership lookup. stopProcess checks first, registers a one-shot exit listener and calls kill. An already-closed reference rejects with invalidProcessHandle, allowing the existing runtime cleanup path to continue without waiting for an event that already fired. Restart awaits stop before spawning a new object; platform disposal kills its remaining live objects. BrowserWorkerProcess takes only its Worker in the constructor.

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

stopProcess checks liveness, registers a one-shot exit listener, calls process.kill() and awaits exit, preserving the original shutdown behaviour. Restart awaits stop before spawning the replacement.
