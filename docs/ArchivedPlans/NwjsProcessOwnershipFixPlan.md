# NW.js spawned-process ownership correction

Prepared on 24 October 2026. Status: implemented and verified. Complete the NW.js correction first, with only the browser reference substitution described below. The full [browser dependency correction](BrowserEngineDependencyFixPlan.md) and [engine package rework](EngineInstallationReworkPlan.md) remain subsequent work. Shared-process feasibility research is retained below for the later browser plan.

## Agreed direction and scope

The user confirmed that IAssignedEngineRuntime should retain the actual spawned process, rather than a handle. Remove the NW.js process registry and let the native process manager and engine client independently use that same object. Move the native line-I/O helpers into the existing NwjsUtility; do not replace NwjsProcessLineUtility with another module or subsystem.

The user's latest decision is one shared process contract, with the browser temporarily returning a raw object reference in place of its string handle. IAssignedEngineRuntime holds one process reference. A native ChildProcess satisfies the shared subset directly. For the browser, mark the existing Worker raw and assert its reference as IProcess at the return boundary; continue using the existing registry and transport for every operation. Implement the actual Worker-to-process adaptation only under the separate browser plan.

**Only the changes explicitly described here are in scope for the proposed implementation. All unmentioned APIs, behaviour, persistence and architecture stay unchanged.** Planning and feasibility probes do not authorise application implementation. No migration, compatibility helper, extra registry, native-process wrapper, full Node stream emulation, IPC subsystem, UI change or package-loading change belongs to this correction. The browser change is solely string identity to raw object identity, plus required type/field/method references. No Worker adapter, browser registry removal, protocol refactor, inheritance refactor or lifecycle change is included here.

Preserve the recently restored standalone NwjsUciEngineClient. Do not route it through the browser UCI factory, introduce service/resolver injection, or refactor its protocol state machine. EngineRuntimeService keeps every existing public method, signature and result; its internal process-value substitutions are listed below.

## Current defect

NwjsProcessManager generates process-N handles and maintains sessionByHandle. NwjsPlatformService additionally creates NwjsProcessRegistry and passes it into both native implementations. The client translates runtime.processHandle back into the same spawned object before attaching listeners or writing commands. These two maps and generated handles duplicate information already available on the runtime.

[NW.js exposes Node modules](https://docs.nwjs.io/). Node's [spawn API](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) returns a ChildProcess with its communication streams. A PID does not recover those streams. The runtime should retain that returned object directly; the PID may appear in diagnostics but is not a lookup key.

NwjsProcessLineUtility currently owns native stream buffering and writes in a separate platform file. The existing [NwjsUtility](../src/utility/nwjs/NwjsUtility.ts) is the appropriate shared implementation support. [NodeUtility](../src/utility/nwjs/NodeUtility.ts) continues resolving Node modules and overrides; that separate responsibility does not change.

## Shared-process feasibility: verified

**Research for the subsequent browser plan, not implementation instructions for this NW.js correction.** The findings establish that the later adaptation is feasible. They do not make that adaptation a prerequisite for the native fix or require the browser object to implement IProcess in this step.

The shared contract needs the subset actually used for engine I/O, not Node's complete ChildProcess/stream API. The following mapping is supported by the [Worker interface](https://html.spec.whatwg.org/multipage/workers.html#dedicated-workers-and-the-worker-interface) and the [Node child-process API](https://nodejs.org/api/child_process.html):

| Needed capability | Native process | Worker adaptation |
| --- | --- | --- |
| Command input | stdin.write with newline-delimited text | Buffer incomplete input lines; postMessage each complete command without its line terminator. |
| Output | stdout/stderr string chunks after manager-owned UTF-8 configuration | Expose string message events as stdout data, preserving message boundaries with a trailing newline. Keep stderr optional. |
| Output listener cleanup | Stream removeListener | Remove the adapter's listener registration; detach Worker event handlers on closure. |
| Request termination | kill() | Call terminate() and close the adapter's communication channel once. |
| Exit notification | Native exit event | Adapter-owned notification after managed termination or observed load/runtime/message failure. Native exit code/signal are unavailable and remain null. |

Two probes passed on 24 October 2026:

- A strict TypeScript assignment check against the installed Node types confirmed that spawn with this app's stdio: 'pipe' configuration returns ChildProcessWithoutNullStreams and satisfies the Node-free subset shown below. General ChildProcess instances with nullable streams are outside this contract. No native wrapper or prototype modification is needed for these operations.
- A standalone headless Chromium 156.0.8078.4 probe using real dedicated Workers verified split command input, multiple output lines, two isolated workers, detached listeners, one-shot managed exit, rejected writes after termination, continued operation of the other Worker, uncaught runtime-error cleanup and asynchronous script-load-error cleanup. Its script/report are under ignored test-results/SharedProcessWorkerProbe.cjs and test-results/SharedProcessWorkerProbe.json. No application source was changed.

Lifecycle limits must remain explicit. The standard Worker interface has no parent-side spawn/online/exit event, PID, OS exit status or termination acknowledgement. Its script loads asynchronously; protocol readiness still comes from the existing UCI handshake. A Worker calling close() silently cannot be detected through this interface alone. The probe observed no lifecycle event after self-close, and a later postMessage did not throw. The adapter's open state therefore means its channel has not been closed by the app or an observed error; it is not proof of a live worker thread. See the [worker interface and termination algorithms](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate).

Worker errors do not themselves supply native exit semantics. Retain the app's existing policy in BrowserUciTransport: explicitly terminate on observed error/messageerror, settle listeners and ignore later output. The probe covers actual runtime/load errors; messageerror handling is supported by the [message-event interface](https://html.spec.whatwg.org/multipage/web-messaging.html#messageeventtarget) but was not induced. Do not invent a success exit code, readiness event, heartbeat or engine-script wrapper to hide these limits.

This proves feasibility for the existing string-command/string-message engines. It does not verify every engine package, relative asset loading, service-worker serving, full application integration or a physically observable Worker-exit acknowledgement.

## Shared contract changes

Use a small Node-free process data contract in src/contracts/platform/IProcess.ts. This candidate subset was used in the native type-compatibility check and the Worker probe; it does not reproduce Node's full stream/event API.

```ts
export interface IProcessInput {
  write(chunk: string): boolean;
}
export interface IProcessOutput {
  on(event: 'data', listener: (chunk: string) => void): unknown;
  removeListener(event: 'data', listener: (chunk: string) => void): unknown;
}
export interface IProcess {
  readonly stdin?: IProcessInput;
  readonly stdout?: IProcessOutput;
  readonly stderr?: IProcessOutput;
  once(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  removeListener(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  kill(): boolean;
}
export interface IAssignedEngineRuntime {
  process?: IProcess;
  // Existing availability, error and analysis members remain unchanged.
}
export interface IProcessManager {
  spawnProcess(executablePath: string, args?: string[]): Promise<IProcess>;
  assertProcessOpen(process: IProcess): void;
  stopProcess(process: IProcess): Promise<void>;
  restartProcess(process: IProcess, executablePath: string, args?: string[]): Promise<IProcess>;
}
```

- Replace IAssignedEngineRuntime.processHandle with process. Do not retain both fields or convert between them at runtime.
- Rename IProcessManager.assertProcessHandleOpen to assertProcessOpen, changing its argument from an identifier to IProcess. The other method names and argument order stay unchanged; their process arguments/results use IProcess.
- IAssignedEngine and IPlatformService keep their existing non-generic declarations. EngineRuntimeService stores and passes the shared process object without inspecting host members. There is no runtime parameter passed into process-manager operations and no generic/unknown process slot.
- The existing native ISpawnedProcess model extends the shared IProcess and retains native-only details privately. The native manager/client can refine that process locally when they need exitCode/signalCode or Node stream details. Neither imports the other's interface implementation.
- The browser manager returns the existing raw Worker reference asserted as IProcess. The runtime passes that object back through the browser's existing lookup paths. The registry keeps its existing BrowserUciTransport values and uses object references as keys instead of strings. The browser client still resolves its transport through that registry; it does not call IProcess stream/event/kill members in this step.
- Remove the string ProcessHandle alias and its exports once all reference types use IProcess. Do not preserve a second runtime field, convert stored data, cast a string to IProcess, or introduce a conversion helper. The direct assertion of the existing raw browser object is the user's selected boundary for this step.
- Keep PlatformErrorKind.InvalidProcessHandle and its existing value. Existing runtime recovery depends on that discriminator; renaming the error catalogue is outside this correction. Native messages should describe an unavailable or exited process rather than an unknown synthetic handle.

stdin.write's boolean retains native write acceptance/backpressure semantics; false is not a process-start failure. The future Worker adapter can return true after accepting the command into its local input channel. kill's boolean indicates acceptance of the termination request, not a portable physical-exit acknowledgement. Optional streams remain optional, and no browser PID, OS signal or fabricated exit status is required. The exit callback uses Node's two native arguments, code and signal; no extra detail parameter is introduced for future browser behaviour. Browser failure-detail mapping belongs to its separate plan.

Optional stream properties use ?: only. Native engines always use piped stdio, so the shared contract does not need the null stream values permitted by Node's general ChildProcess type. Exit code/signal values retain null because Node supplies that value in its actual lifecycle properties and callbacks.

IProcessOutput delivers strings only. The native process manager sets [UTF-8 encoding](https://nodejs.org/api/stream.html#readablesetencodingencoding) on stdout and stderr before returning the process; consumers do not decode bytes. Keep setEncoding on the native stream model, without adding it to the shared output contract. The browser's raw-object substitution remains unchanged.

No NodeJS namespace, Buffer type or native utility type is imported into shared contracts. No new platform getter, platform-specific public API family or public process inspection/preparation API is added. A private native process refinement is sufficient here. The browser's later real process implementation belongs to its own plan; separate native/browser runtime contracts are unnecessary for carrying the reference.

## Browser reference substitution only

Use the already created Worker as the stable object identity. At browser spawn, replace the generated worker-N string with this direct assertion:

```ts
const process = markRaw(worker) as unknown as IProcess;
```

Keep the existing registry as Map<IProcess, BrowserUciTransport>. Its set/get/delete calls, the transport's onClosed callback, the client resolver, liveness assertion, stop/restart and platform disposal all continue through the same existing paths using that object key. Remove the now-unused string counter; add no replacement id, wrapper, adapter or helper. The same Worker reference must reach the runtime, registry key and later manager/client calls.

This assertion does not add stdin/stdout, kill, exit events or lifecycle properties to Worker. Shared domain code continues treating the reference as opaque and delegates operations to the selected implementation. The browser implementation continues calling BrowserUciTransport, never the asserted IProcess members. Keep URL/argument handling, Worker construction, command/message framing, failure details, subscriptions, registry ownership, sibling module imports and disposal order unchanged. Their architectural correction is deferred to the browser plan.

## Native process and utility design

Extend the existing ISpawnedProcess model in src/utility/nwjs/models with the native fields needed for lifecycle checks and diagnostics:

```ts
readonly pid?: number;
readonly exitCode: number | null;
readonly signalCode: NodeJS.Signals | null;
```

Keep its existing streams, events and kill method, and extend the shared IProcess shape. This remains a structural view of the actual ChildProcess, not a wrapper around it. The manager returns the exact spawn result after successful startup. Mark that object raw at the native boundary so Vue storage preserves its identity and stream/event internals.

Use exitCode and signalCode to determine whether a successfully spawned object has exited. A signal being sent does not prove termination: [Node's lifecycle properties](https://nodejs.org/api/child_process.html#subprocesskilled) distinguish those states. Do not use killed as an exit flag, probe the operating system by PID, or maintain a side table of liveness.

The following functions live in the existing NwjsUtility.ts. They are imported implementation helpers, not new architectural interfaces or flow owners:

```ts
export function isProcessOpen(process: ISpawnedProcess): boolean;
export function attachProcessLineListeners(
  process: ISpawnedProcess,
  onLine: (line: string) => void,
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void,
): () => void;
export function writeProcessLine(process: ISpawnedProcess, command: string): Promise<void>;
```

isProcessOpen is a stateless native-field check: exitCode and signalCode are both null. Only successfully spawned resources enter the runtime. attachProcessLineListeners receives string chunks already decoded by the manager's configured streams; remove its string/Buffer union and per-chunk toString conversion. Retain existing line buffering, trimming, stdout/stderr handling, exit callback and returned listener-detachment function. It creates no process store or session.

writeProcessLine drops the handle argument. Reject an exited process with the existing InvalidProcessHandle kind, replacing the old registry-miss check. Preserve ProcessStartFailed when stdin is unavailable, the trailing newline, current write semantics and existing asynchronous boundary. This move does not add write queues, backpressure policy, stream separation or UCI parsing to the utility.

Remove NwjsProcessLineUtility.ts after updating its imports. Keep NwjsUtility's existing host lookup functions and NodeUtility's module-resolution functions unchanged.

## Native implementation and ownership

### Process manager

defineNwjsProcessManagerStore(nw) no longer receives a registry. Remove IProcessSession, sessionByHandle, nextHandleId and the registry-dependent _getSession. The manager owns native spawning and physical termination, but retains no collection of processes after handing a resource to its caller.

spawnProcess keeps the existing executable/argument and stdio: 'pipe' configuration. In the successful spawn callback, call process.stdout.setEncoding('utf8') and process.stderr.setEncoding('utf8') before resolving with the actual raw process. The manager owns decoding, including UTF-8 characters split across byte chunks; clients and line helpers receive strings only. Its temporary spawn/error listeners belong to the startup promise and are removed on settlement. Start failure retains ProcessStartFailed without configuring a failed process. Do not add an AbortSignal parameter: the runtime already owns late-start cleanup.

assertProcessOpen refines the supplied IProcess to the native process model and checks its lifecycle through isProcessOpen, throwing the existing InvalidProcessHandle kind for an exited resource. It performs no manager-membership or registry lookup. The browser implementation keeps its existing registry-presence check, using the raw object key; no browser liveness policy changes here.

stopProcess checks liveness, registers the existing one-shot exit listener, calls process.kill() and awaits exit. Keep the original shutdown behaviour, replacing session.process with the supplied process. restartProcess continues awaiting stop before spawning and returns the replacement object.

### Engine client

defineNwjsUciEngineClientStore(nw) no longer receives a registry. Combine _requireProcessHandle(engine) and the registry-backed _requireProcess(handle) into _requireProcess(engine), reading the client-private runtime's actual process and checking its availability/liveness. No manager, sibling interface, registry or injected resolver is consulted.

Pass the process directly through _attachToProcess, _awaitUciOk, _awaitReadyOk and _writeCommand. All native command paths must change together: initial handshake, saved options, readiness, new-game boundary, registration response, analysis, player search, pondering and stop-search commands.

IUciSession.process remains only the identity of the resource to which its owned listeners are attached. It is not another lifecycle owner or lookup table. Keep the existing same-process initialisation shortcut and explicit session replacement/detachment when a new process is supplied. An identity check during attachment must compare the actual captured object with runtime.process; do not replace ownership with a sequence counter.

Client stopEngine must remain able to clear a session after the process has exited. Require the runtime/process reference, but do not apply an open-process check before rejecting session waits and detaching listeners. Normal I/O and initialisation still reject an exited object. The client does not kill the process or clear the runtime's process field.

Preserve all existing UCI states, command order, awaits, option parsing, move validation boundaries, analysis callbacks, session-owned completions and error handling. The existing exit listener continues failing the affected session and detaching its listeners. One process exiting must not affect another assigned engine.

### Runtime service and composition

EngineRuntimeService owns engine.$.process. Replace its processHandle reads/writes and private _assertProcessHandleOpen name with the process equivalents; call assertProcessOpen at the same existing boundaries. Do not add a public API or change callers above this service.

Preserve the existing invalid-process retry and error discriminator, startup cancellation, queued client work and shared analysisShutdownWork. Store a spawned object even if its awaiting action has been cancelled, so disposal can release the late result. Keep physical shutdown before client-session cleanup; clear runtime.process only after successful termination or the existing already-exited error path. A physical-stop failure leaves the reference available for another disposal attempt.

NwjsPlatformService and the journey bootstrap construct manager/client independently using their existing nw argument. Remove their createNwjsProcessRegistry calls and both registry arguments. Then delete NwjsProcessRegistry.ts; do not replace it with a Map, WeakMap, singleton, resource wrapper or forwarding factory.

The process remains runtime-only under $. Existing schemas and serialisation continue excluding it. No schema version, stored payload or migration changes are needed. Existing shallow runtime reactivity stays in place.

## Function flows

These are stacked single-column call tables: each header is a caller and its rows are direct calls in order. Branches are separate tables. State writes and ownership notes are outside the tables. Native utility details appear under their owning platform operation, without becoming architectural flow owners.

### Initialisation with no process

| `EngineRuntimeService.ensureReady(engine, signal?)` |
| --- |
| `_createBaseRuntime(engine)` |
| `_runEngineOperation(runtime, Ready, action, signal)` |

Keep the existing cancellation check before runtime creation. Existing availability/error updates remain owned by the service.

| `EngineRuntimeService._runEngineOperation(runtime, availability, operation, signal?)` |
| --- |
| `operation()` — await |

| `EngineRuntimeService.ensureReady: operation callback` |
| --- |
| `_initialiseEngine(engine, runtime, signal)` — await |

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal?): missing process` |
| --- |
| `usePlatformService().getProcessManager()` |
| `processManager.spawnProcess(engine.executablePath)` — await |
| `_runAnalysisClientWork(runtime, initialiseClient)` — await unless cancelled |

Store the returned object directly in runtime.process, including when cancellation arrived during spawn.

| `EngineRuntimeService._runAnalysisClientWork(runtime, action)` |
| --- |
| `action()` — await |

| `EngineRuntimeService._initialiseEngine: initialiseClient callback` |
| --- |
| `_getEngineClient(engine)` |
| `engineClient.initialiseEngine(engine)` — await |

| `EngineRuntimeService._getEngineClient(engine)` |
| --- |
| `usePlatformService().getEngineClient(engine.clientType)` |

These existing helpers keep their current work ownership and client selection. The native branch selects NwjsUciEngineClient; the browser branch retains its existing implementation.

| `NwjsProcessManager.spawnProcess(executablePath, args)` |
| --- |
| `childProcess.spawn(executablePath, args, { stdio: 'pipe' })` |
| `process.once('spawn', onSpawn)` |
| `process.once('error', onStartError)` |

| `NwjsProcessManager: onSpawn callback` |
| --- |
| `process.stdout.setEncoding('utf8')` |
| `process.stderr.setEncoding('utf8')` |
| `_cleanup()` |
| `markRaw(process)` |

Resolve the startup promise only after both streams are configured. Its success/error callbacks remove both startup listeners; success returns that exact process, failure rejects with ProcessStartFailed. There is no generated handle or insertion callback.

### Existing process: open and exited branches

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal?): open process` |
| --- |
| `usePlatformService().getProcessManager()` |
| `processManager.assertProcessOpen(runtime.process)` |
| `_runAnalysisClientWork(runtime, initialiseClient)` — await unless cancelled |

| `NwjsProcessManager.assertProcessOpen(process)` |
| --- |
| Native lifecycle check through `NwjsUtility.isProcessOpen(process)` |

The resource has no manager-membership requirement. An exited object produces the existing InvalidProcessHandle error.

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal?): exited process` |
| --- |
| `usePlatformService().getProcessManager()` |
| `processManager.assertProcessOpen(runtime.process)` — throws InvalidProcessHandle |
| `processManager.spawnProcess(engine.executablePath)` — await in existing recovery branch |
| `_runAnalysisClientWork(runtime, initialiseClient)` — await unless cancelled |

Replace runtime.process with the new object before initialising its protocol session. Keep the existing single recovery branch; other failures propagate.

### Protocol attachment, handshake and writes

| `NwjsUciEngineClient.initialiseEngine(engine): new session` |
| --- |
| `_requireProcess(engine)` |
| `_initialiseAssignedEngineSession(engine)` |
| `_attachToProcess(engine, process, session)` |
| `_awaitUciOk(session, process)` — await |
| `parseOptionLines(optionLines)` |
| `_writeCommand(process, optionCommand)` — await for each saved option |
| `_awaitReadyOk(session, process)` — await |

The existing ready-session shortcut and failed/stopped-session replacement branches remain. They use process identity instead of handle resolution. Existing session options/state writes retain their current order.

| `NwjsUciEngineClient._requireProcess(engine)` |
| --- |
| `_requireRuntimeAssignedEngine(engine)` |
| Native lifecycle check through `NwjsUtility.isProcessOpen(runtime.process)` |

Read the privately refined runtime.process directly; reject a missing reference before the lifecycle check. Return that same object.

| `NwjsUciEngineClient._attachToProcess(engine, process, session): first attachment` |
| --- |
| `_requireRuntimeAssignedEngine(engine)` |
| Native listener attachment through `NwjsUtility.attachProcessLineListeners(process, onLine, onExit)` |

Compare the captured process with runtime.process before attachment. The session retains that object and the returned detacher. Existing replacement attachment first terminates/detaches the old session; existing attachment to the same object is reused.

| `NwjsUciEngineClient._awaitUciOk(session, process)` |
| --- |
| `_writeCommand(process, buildUciCommand())` — await |

| `NwjsUciEngineClient._awaitReadyOk(session, process)` |
| --- |
| `_writeCommand(process, buildIsReadyCommand())` — await |

Each existing wait context is installed before writing. After the write, await the existing state-owned uciok/readyok completion, as today.

| `NwjsUciEngineClient._writeCommand(process, command)` |
| --- |
| Native line write through `NwjsUtility.writeProcessLine(process, command)` — await |

The helper checks native exit state/stdin and calls process.stdin.write with the newline. It performs no resource lookup. Search and control operations retain their existing orchestration and call this same path.

| `NwjsUciEngineClient: attached stdout/stderr callback` |
| --- |
| `_consumeLine(engine, session, line)` |

The utility buffers lines; the existing client state dispatch handles their meaning. Analysis, options, player completion and ready/stop acknowledgements retain their existing owners.

### Unexpected exit

| `NwjsUciEngineClient: attached process-exit callback` |
| --- |
| `_failUciSession(session, unexpectedExitError)` |

| `NwjsUciEngineClient._failUciSession(session, error): active session` |
| --- |
| `_terminateUciSession(session, Failed, error)` |

| `NwjsUciEngineClient._terminateUciSession(session, terminalContext, error)` |
| --- |
| `_rejectContextCompletion(session.current, error)` |
| `session.detachProcessListeners()` — when attached |

The native object already records its exit code/signal. Existing session termination rejects its owned wait, detaches listeners and clears its attachment. The service observes the existing failure/recovery paths; no registry-removal callback or new global process-exit subscription is needed.

### Shutdown and restart

| `EngineRuntimeService._releaseEngineProcess(engine, runtime): open process` |
| --- |
| `usePlatformService().getProcessManager().stopProcess(process)` — await |
| `_stopClientSession(engine)` — await |
| `_clearAnalysisState(runtime)` |

| `EngineRuntimeService._releaseEngineProcess(engine, runtime): already exited` |
| --- |
| `usePlatformService().getProcessManager().stopProcess(process)` — rejects with InvalidProcessHandle |
| `_stopClientSession(engine)` — await in existing already-exited handling |
| `_clearAnalysisState(runtime)` |

| `EngineRuntimeService._releaseEngineProcess(engine, runtime): no process` |
| --- |
| `_clearAnalysisState(runtime)` |

Capture runtime.process before awaiting. In the first two branches, keep the reference until physical stop is settled and client cleanup succeeds, then clear it before the existing analysis cleanup. Other physical-stop errors propagate without clearing the reference or session. Shared shutdown work and terminal-operation cancellation remain unchanged.

| `EngineRuntimeService._stopClientSession(engine)` |
| --- |
| `_getEngineClient(engine)` |
| `engineClient.stopEngine(engine)` — await |

| `NwjsProcessManager.stopProcess(process): open process` |
| --- |
| `assertProcessOpen(process)` |
| `process.once('exit', onExit)` |
| `process.kill()` |

The one-shot exit listener resolves the stop promise. Do not clear the runtime from this layer.

| `NwjsUciEngineClient.stopEngine(engine)` |
| --- |
| `_requireRuntimeAssignedEngine(engine)` |
| `_getSession(engine)` |
| `_stopUciSession(session)` — when a session exists |

Check process-reference presence without requiring a live process. Existing session termination rejects pending protocol work and invokes the owned listener detacher. It does not call the manager.

| `EngineRuntimeService._restartEngineProcess(engine, runtime, signal)` |
| --- |
| `_stopEngineProcess(engine, runtime)` — await |
| `signal.throwIfAborted()` |
| `EngineRuntimeService.ensureReady(engine, signal)` — await |

The service already uses this path for its own restart; do not replace it with a new lifecycle. The separate existing manager restart API remains stopProcess followed by spawnProcess.

| `EngineRuntimeService._stopEngineProcess(engine, runtime): no shutdown in progress` |
| --- |
| `_releaseEngineProcess(engine, runtime)` — await |

The existing runtime.analysisShutdownWork owns this physical stop. A concurrent terminal request awaits that same work rather than issuing another kill; settlement clears the owned shutdown reference.

| `NwjsProcessManager.restartProcess(process, executablePath, args)` |
| --- |
| `stopProcess(process)` — await |
| `spawnProcess(executablePath, args)` — await |

### Browser object identity: existing paths retained

| `BrowserProcessManager.spawnProcess(executablePath, args)` |
| --- |
| `_resolveWorkerUrl(executablePath)` |
| `_createWorker(url)` |
| `markRaw(worker)` |
| `new BrowserUciTransport(worker, onClosed)` |
| `registry.set(process, transport)` |

Keep the existing argument rejection before URL resolution. Assert the raw Worker reference as IProcess and return it. onClosed deletes that same object key from the same registry. No new Worker/process adaptation or startup handshake is added.

| `Browser UCI factory: _requireTransport(process)` |
| --- |
| `resolveTransport(process)` |

| `BrowserEngineClient: existing resolver callback` |
| --- |
| `registry.get(process)` |

The factory reads engine.$.process where it previously read processHandle, then follows its existing transport lookup. Its protocol operations still call transport.write/subscribe. Preserve the existing missing-reference and missing-registry-entry failures.

| `BrowserProcessManager.assertProcessOpen(process)` |
| --- |
| `_requireTransport(process)` |

| `BrowserProcessManager.stopProcess(process)` |
| --- |
| `_requireTransport(process)` |
| `transport.terminate()` |

| `BrowserProcessManager._requireTransport(process)` |
| --- |
| `registry.get(process)` |

Only key identity changes. Restart retains stop then spawn; dispose retains iteration over the existing registry values and transport termination. No shared IProcess member is invoked on the asserted Worker object.

## Files affected when implementation is requested

| File/group | Required change |
| --- | --- |
| src/contracts/platform/IProcess.ts; src/contracts/Engine.ts; src/contracts/platform/IProcessManager.ts; affected contract barrels | Shared process subset, process field and assertProcessOpen contract; remove ProcessHandle after aligning both implementations. Preserve unrelated fields/schema/API. |
| src/domain/EngineRuntimeService.ts | Internal field/helper/call substitutions only; preserve public APIs and lifecycle ordering. |
| src/utility/nwjs/models/ISpawnedProcess.ts; src/utility/nwjs/NwjsUtility.ts | Native lifecycle fields and the explicitly described existing-utility helpers. |
| src/platform/nwjs/NwjsProcessManager.ts | Direct process lifecycle and manager-owned UTF-8 configuration of stdout/stderr; remove both handle/session bookkeeping and registry dependency. |
| src/platform/nwjs/NwjsUciEngineClient.ts | Direct runtime process access and utility imports, preserving standalone protocol implementation. |
| src/platform/nwjs/NwjsPlatformService.ts; journeys/PrepareJourney.ts | Remove registry creation/arguments from native composition. |
| src/platform/nwjs/NwjsProcessRegistry.ts; src/platform/nwjs/NwjsProcessLineUtility.ts | Delete after updating all importers; no replacement modules. |
| src/platform/browser/BrowserProcessManager.ts; src/platform/browser/BrowserEngineClient.ts; src/platform/uci/UciEngineClient.ts; affected browser composition/type imports | Substitute the raw Worker reference for the string key/result; update shared type, runtime-field and assertion-method references only. Preserve the existing registry, transport, resolver, sibling imports and disposal. No browser adapter or architecture correction in this step. |
| src/utility/nwjs/NwjsMockUtility.ts; src/platform/__tests__/NwjsPlatformTestUtility.ts; journeys/runtime/engine/ScriptedEngine.ts | Represent native exitCode/signalCode/pid on the existing process doubles; update exit state before emitting exit. Existing fake output streams must support the manager's setEncoding call; keep their existing string output behaviour. Preserve journey barrier ownership. |
| EngineRuntimeService, NwjsProcessManager, NwjsUciEngineClient, BrowserUciEngineClient, BrowserPlatformService and PlatformTarget tests; journeys/__tests__/engine-races/Disposal.spec.ts | Update contract references/fakes and add the focused ownership assertions below. |

During implementation, update affected runtime/process/client and utility ownership documentation, including their function flows. Baseline low-level documents remain unchanged during this planning task. The package and browser plans must be rebased on this corrected contract before their implementation; this plan does not approve their unresolved replacement designs.

## Verification and implementation order

1. Change the shared contracts and runtime field/method references. For browser compatibility, use only the raw-object assertion and string-to-reference substitution described above. Keep its existing registry/transport implementation and behavioural expectations. The full browser plan is not a prerequisite for this NW.js step.
2. Change native spawn/stop/client communication to direct objects, configure stdout/stderr as UTF-8 in the manager, move the described helpers into NwjsUtility with string-only input, and remove native registry composition and both obsolete files. Preserve the restored UCI method bodies except for the explicit access substitutions.
3. Update the existing process doubles to maintain native lifecycle properties, including signalled exit, and accept output-encoding configuration. Verify that both streams deliver intact text when a UTF-8 character is split across byte chunks, and that encoding is configured before spawnProcess resolves. Add focused tests for actual resource identity through reactive runtime assignment; two independent processes; ordinary/signalled exit; restart replacement; startup failure; startup listener cleanup; waiting for exit after kill; session replacement; and stopping a runtime whose process has already exited.
4. Preserve the existing late-spawn cancellation, overlapping shutdown and pending-handshake/stop acknowledgement race checks. Add missing coverage only for the changed ownership paths, without mirroring implementation helpers.
5. Run npm run check:code, the focused native/runtime/browser/platform suites, the existing engine-races journey tests and npm run build. Preserve browser identity, isolation, closed-reference rejection, restart and disposal assertions while changing their reference types; verify that the returned reference is the original raw Worker. Run the existing real-Worker browser analysis/failure checks since the shared runtime references changed. Inspect for remaining native handle lookups/registries, imports of the deleted files, newly introduced sibling dependencies and new persistence fields. Existing browser sibling dependencies remain for its separate plan.
6. Only after these checks pass, update the corresponding committed low-level documentation. Then return to the separate browser correction plan; do not resume package implementation automatically.

Completion means runtime.process is the exact native spawn result, the native implementations communicate independently through that object, no NW.js handle registry/session map remains, native line support lives in the existing utility, EngineRuntimeService's public APIs are preserved, and the focused checks pass. Browser changes are limited to raw object identity in place of string identity and the necessary contract references; its implementation correction remains in the browser plan.

Implementation verification on 24 October 2026: 77 focused unit/application tests passed across nine files, including native process/client, runtime, browser compatibility and engine-race journeys. The code audit, all TypeScript projects and production build passed. Six real-Worker browser analysis/failure tests passed with one worker and no retries; report: test-results/NwjsProcessBrowserResults.json (ports 5473/5474). The journey unit teardown logs Pinia-destroyed cleanup messages; the same messages were confirmed on unchanged HEAD and its assertions passed. No browser adapter, inheritance correction or package rework was implemented.
