# Browser engine dependency correction

Updated on 24 October 2026. Status: implemented and verified following the user's implementation instruction. The [NW.js process ownership correction](ArchivedPlans/NwjsProcessOwnershipFixPlan.md) is implemented and verified. Its browser change deliberately returned a raw Worker asserted as IProcess while retaining the existing registry/transport. This correction replaces that temporary assertion with a real process implementation and removes the browser sibling dependency. The [engine package rework](EngineInstallationReworkPlan.md) remains subsequent work.

## Scope and preservation requirements

Use the agreed shared process contract, direct runtime process ownership and private inheritance. BrowserProcessManager and BrowserEngineClient must work independently with the same process object; neither imports or calls the other implementation. Replace the superseded registry-extraction design rather than moving its lookup into another module.

**Only the changes explicitly described here are in scope. All unmentioned APIs, behaviour, persistence and architecture remain unchanged. This document authorises no implementation.**

- Keep IProcess, IProcessInput, IProcessOutput, IProcessManager, IEngineClient and IPlatformService unchanged. EngineRuntimeService requires no source or API changes. It continues storing and passing engine.$.process.
- Preserve actual native ChildProcess ownership and manager-owned UTF-8 configuration. Following the user's subsequent instruction, verify the shared base against the standalone native implementation, then make NwjsUciEngineClient inherit that unchanged base through its native liveness and exit-detail hooks.
- Keep Worker construction settings, URL resolution, argument rejection, Stockfish alias/assets, EngineClientType.Uci assignment guard and executablePath/protocol fields. Changes to those belong to the package rework.
- Preserve UCI states, session-owned completions, command order, awaits, option discovery, analysis, player turns, pondering, registration handling, startup cancellation and shared shutdown ownership.
- Keep the nine IEngineClient operations, Worker construction settings and custom engine-services injection. BrowserPlatformService is the store that selects and returns the client; the browser client is a plain class instance with no separate Pinia store or action-binding object. Tests stub the global Worker constructor instead of injecting a factory into the manager.
- Add no platform getter, public host-specific API, injected service/resolver, persistence, migration, compatibility shim, package loading, service worker, heartbeat or IPC subsystem.
- During planning, edit this plan only. Update affected low-level architecture documents during an explicitly requested implementation, after verification.

## Defect addressed and ownership

[BrowserEngineClient.ts](../src/platform/browser/BrowserEngineClient.ts) previously imported BrowserEngineRegistry from [BrowserProcessManager.ts](../src/platform/browser/BrowserProcessManager.ts). That sibling-module dependency violated the layer boundary even though the import was type-only. The old manager exported Map<IProcess, BrowserUciTransport>; the old UCI factory received a resolver that looks up a transport in the same map. engine.$.process was the Worker object asserted as IProcess, without the required process members.

The target is one BrowserWorkerProcess implementing the existing IProcess. It privately owns the Worker, input/output adaptation, closure state and listeners. The manager returns that object, and the client reads it directly from engine.$.process. No process-to-transport lookup remains.

| Owner | Responsibility after this correction |
| --- | --- |
| BrowserProcessManager | Create and return the raw process object; check its local closure state; stop/restart it; retain live objects solely for platform disposal. |
| BrowserWorkerProcess | Adapt Worker messages to the shared process subset, retain failure detail, terminate its Worker and emit one managed exit notification. |
| Browser UCI client | Own protocol sessions, line parsing, command order and pending protocol completions over the supplied process. |
| BrowserPlatformService | Construct manager/client independently and dispose its manager at the existing scope boundary. |
| EngineRuntimeService | Retain the returned process reference and compose the existing lifecycle/client APIs, unchanged. |

The existing [dependency rules](LowLevel/Architecture/index.md#dependency-rules) permit imported private utility support. BrowserWorkerProcess and the UCI base are implementation support, not services or platform-layer interfaces. They must not import platform implementations, domain services or stores. The process manager and client do not receive each other's interfaces, including through callbacks or forwarding modules.

## Files and private construction

| Existing source | Planned change |
| --- | --- |
| src/platform/browser/BrowserUciTransport.ts (removed) | Replace with src/utility/BrowserWorkerProcess.ts implementing IProcess. Retain its Worker error handling and diagnostic messages while changing the communication shape. Remove the old file. |
| src/platform/uci/IUciTransport.ts (removed) | Remove after the browser client uses IProcess streams/events directly. Add no replacement transport contract. |
| [NwjsUciEngineClient.ts](../src/platform/nwjs/NwjsUciEngineClient.ts) | Use the process-based implementation as the reference for the base's UCI operations and session logic. After the parity check, replace the native copy with the subclass and two host hooks; construct it directly in the native platform store and journey override. |
| src/platform/uci/UciEngineClient.ts (removed) | Replace the browser-used transport factory with src/platform/base/UciEngineClientBase.ts, based on the native implementation described above. Remove the old factory file after updating its browser importer. |
| [BrowserEngineClient.ts](../src/platform/browser/BrowserEngineClient.ts) | Export BrowserUciEngineClient for internal platform composition, with only the host hooks described below. Remove the client store factory and bound-method object; the platform store constructs and returns the class instance directly. Remove the sibling manager import. |
| [BrowserProcessManager.ts](../src/platform/browser/BrowserProcessManager.ts) | Remove BrowserEngineRegistry, the registry constructor argument and transport lookups. Construct BrowserWorkerProcess and retain a private live-process Set for disposal only. Create Workers directly; the manager has no constructor arguments. |
| [BrowserPlatformService.ts](../src/platform/browser/BrowserPlatformService.ts) | Remove Map construction and registry arguments. Keep default manager construction, custom-services selection and scope disposal in their existing order. |
| Browser engine/platform tests | Update private construction and process identity expectations; exercise real process members instead of asserting that the return value is the underlying Worker. Preserve existing behavioural assertions. |
| New src/platform/__tests__/BrowserEngineProcess.spec.ts and BrowserEngineDependency.spec.ts | Cover the process adaptation and the affected import boundary, including type-only and barrel imports. |

The native client now also extends the base under the user's follow-up instruction. Native process-manager behaviour, shared contracts and EngineRuntimeService remain unchanged. Remove the unused native line/write helper copies after both clients use the base. Utility-module exports allow internal imports only; do not add them to the public platform barrel. No old location re-exports the removed factory or transport. The Set is owned only by its manager; the client never sees it, and no operation uses membership to recover a process.

## Worker-backed process design

The [existing shared contract](../src/contracts/platform/IProcess.ts) stays unchanged. BrowserWorkerProcess is an internal concrete class with this additional read-only implementation surface:

~~~ts
class BrowserWorkerProcess implements IProcess {
  constructor(worker: Worker);
  get closed(): boolean;
  get exitDetail(): string | undefined;
  // Existing IProcess stdin/stdout/once/removeListener/kill members.
}
~~~

The constructor takes only the Worker resource. closed records that the app has closed the channel. exitDetail preserves the existing browser diagnostics without changing IProcess or adding a third exit argument. Those getters are implementation details, used only inside the browser implementation. Mark the process object raw before returning it; it is the exact reference retained in the runtime, client session and manager's disposal set. Remove the raw-Worker-as-IProcess assertion. Disposal-set cleanup belongs to the manager's own exit listener, not a constructor callback.

| Shared member | Browser implementation |
| --- | --- |
| stdin.write(chunk) | Buffer incomplete input, split complete newline-terminated commands and post each command without its terminator. Preserve the command text and CRLF handling. Return true on accepted input; do not invent Worker backpressure. |
| stdout.on('data', listener) | Deliver string Worker message data as text chunks. Ensure each message ends with a newline so separate messages remain separate lines; do not join two messages into one UCI line. |
| stdout.removeListener('data', listener) | Remove the supplied listener registration. The UCI session owns its registration and detaches it during replacement or termination. |
| stderr | Leave absent; do not fabricate a second output stream. |
| once('exit', listener) | Register a one-shot managed closure callback with the existing two arguments, (null, null). It is not an OS exit status and is not replayed after closure. |
| removeListener('exit', listener) | Detach the supplied pending exit registration. |
| kill() | Close once, terminate the Worker and notify exit listeners; return true for the first accepted termination and false when already closed. |

Use small listener collections and input buffering inside the object; no Node imports or general event/stream framework. UCI trimming, blank-line filtering and parsing remain in the client. Non-string Worker messages remain ignored. Register Worker message/error/messageerror listeners in the constructor and remove them on closure.

A private _close(detail) is the single closure path for kill, observed error/messageerror and postMessage failure. It marks closed and records detail first, detaches Worker handlers, calls Worker.terminate(), notifies the one-shot exit listeners and clears remaining listeners/buffers. Keep the existing default termination, load/runtime-error and unreadable-message messages. A repeated close is a no-op. Output after closure is ignored. The process has no knowledge of the manager's disposal set.

Writing to a closed process retains InvalidProcessHandle. A postMessage throw closes the object and throws UnexpectedExit with the existing command-delivery message/detail. The client receives exitDetail when rejecting its pending handshake/search completion. The same failure must not affect another process.

Worker construction does not establish script or UCI readiness. Preserve the UCI handshake as the readiness boundary. The [Worker interface](https://html.spec.whatwg.org/multipage/workers.html#dedicated-workers-and-the-worker-interface) supplies message, error and messageerror events and terminate(), but no parent-side native exit acknowledgement. A Worker calling close() silently cannot be detected with this subset. closed therefore describes the managed communication channel; (null, null) and kill acceptance must not be presented as observed physical exit or readiness. See the [termination algorithm](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate).

The [earlier feasibility probes](ArchivedPlans/NwjsProcessOwnershipFixPlan.md#shared-process-feasibility-verified) verified string command framing, output boundaries, managed exit and runtime/load failures in real Workers. They did not execute this application refactor or induce messageerror. Cover that event with a fake Worker and keep the real-Worker checks below.

## Private inheritance design

UciEngineClientBase implements the existing IEngineClient. Its reference is the standalone NW.js client before its inheritance conversion, including its process-attached session, state machine, public operation bodies, command order, awaits and cleanup. The comparison is recorded before replacing that native copy. Both clients now inherit the same base; the native conversion leaves the base byte-for-byte unchanged.

The permitted mechanical differences are factory-local functions becoming class methods with this references, ISpawnedProcess becoming IProcess, and the existing string line-listener/write helper bodies becoming private base methods. Replace native liveness checking and exit-detail formatting with the two hooks below. Remove Node-only types/imports and the PID in the missing-stdin diagnostic, retaining the error kind. All other UCI logic follows the native reference. The base knows no BrowserWorkerProcess, Worker, manager, registry or transport interface.

Only these two host hooks are protected:

~~~ts
abstract class UciEngineClientBase implements IEngineClient {
  protected abstract _isProcessOpen(process: IProcess): boolean;
  protected abstract _getProcessExitDetail(process: IProcess): string | undefined;
  // Existing public operations and private protocol helpers.
}
// Internal implementation constructed by BrowserPlatformService; no platform-barrel export.
export class BrowserUciEngineClient extends UciEngineClientBase {
  protected override _isProcessOpen(process: IProcess) {
    return process instanceof BrowserWorkerProcess && !process.closed;
  }
  protected override _getProcessExitDetail(process: IProcess) {
    return (process as BrowserWorkerProcess).exitDetail;
  }
}
~~~

_isProcessOpen replaces the native isProcessOpen call in process acquisition and writing. _getProcessExitDetail replaces the native exit callback's code/signal formatting with the retained Worker diagnostic; it adds no shared event argument. These are the only host-specific behaviour hooks. The base owns error creation, subscription cleanup and every protocol operation. The subclass has no injected dependencies and does not override protocol operations. No further protected hooks are needed for this correction.

The base's _requireProcess reads engine.$.process directly and retains the native presence/liveness checks, using _isProcessOpen for liveness. A missing, closed or unsupported process still rejects with InvalidProcessHandle. stopEngine retains the native presence-only check before clearing its session; it must still work after physical stop has closed the channel. Do not add a separate assertion helper or extra checks at other boundaries.

Use the native session.process and detachProcessListeners fields directly, with IProcess replacing ISpawnedProcess. These are private fields only. Keep the same-object initialisation shortcut, explicit replacement of terminal sessions and identity comparison against the captured runtime process. Replacement detaches the previous process's listeners. Do not introduce session maps, counters or lazy initialisation.

Keep _attachToProcess's native body, replacing only the line-listener utility call and exit-detail formatting. Copy attachProcessLineListeners from NwjsUtility into a private _attachProcessLineListeners method using IProcess and the shared exit callback types. Preserve optional stdout/stderr subscriptions, the existing string buffer, trimming, empty-line filtering and exact listener removal. Once the native client inherits the same base, remove its unreferenced line/write helper copies and their error factory from NwjsUtility. Keep native liveness and host lookup there; introduce no additional helper module.

Keep _writeCommand awaiting a private _writeProcessLine method whose body follows the former native writeProcessLine: check liveness through _isProcessOpen, reject missing stdin with ProcessStartFailed, then write command + '\n'. Keep both existing async boundaries. Do not add command queues, change write-failure settlement or treat stdin.write returning false as a start failure.

Convert the existing UCI operation/helper bodies into methods by changing owner references to this, without altering command/state/await order. Event callbacks retain the owning instance. BrowserPlatformService constructs markRaw(new BrowserUciEngineClient()) in its default-services branch; NwjsPlatformService likewise constructs markRaw(new NwjsUciEngineClient()). Each getEngineClient returns its same object through IEngineClient. Call methods on the client instance; there is no client Pinia store, binding list or constructor binding. The two hooks remain protected and protocol helpers private.

## Manager lifecycle and composition

BrowserProcessManager keeps a private Set<BrowserWorkerProcess> solely to release live Workers on platform disposal. spawnProcess retains the current argument validation, URL resolution and Worker construction settings; it constructs and marks the process raw, adds it to the set, registers process.once('exit', () => this._processes.delete(process)) and returns it as IProcess. Register this listener synchronously before returning the process. It removes the exact reference on every closure path, independently of client-session listeners. Failed construction must terminate any Worker already created before returning the existing ProcessStartFailed error.

assertProcessOpen verifies that the supplied object is a BrowserWorkerProcess whose channel is open, using the object itself. It performs no lookup or set-membership test. stopProcess keeps this check before registering its one-shot exit callback and calling kill. This preserves the existing InvalidProcessHandle path for already-closed processes: otherwise a new exit wait would never settle. EngineRuntimeService already catches that error and continues client cleanup. Do not remove the check or add kill-error handling, listener scaffolding, timeouts or retries in this correction.

Restart remains await stop then spawn. dispose takes a snapshot of its live set and calls kill on each process; the manager's exit listener removes each entry. The client never calls these manager methods, removes set entries or terminates the Worker.

Platform composition constructs new BrowserProcessManager() and markRaw(new BrowserUciEngineClient()) independently. Keep _options.createEngineServices as the existing override and preserve disposal of the default browser manager. No shared Map is created or passed between implementations.

## Function flows

Use the existing [stacked single-column format](LowLevel/ProcessFlows/index.md#conventions): a callable owner in each header, direct calls in order beneath it and separate tables for branches. Private helpers expand only where needed to review the changed boundary. The private base/subclass remain inside the IEngineClient implementation boundary. Resource operations are terminal implementation support, not another architecture owner.

### Composition and construction

| useBrowserPlatformService setup: default engine services |
| --- |
| new BrowserProcessManager() |
| markRaw(new BrowserUciEngineClient()) |

| useBrowserPlatformService setup: custom engine services |
| --- |
| new BrowserProcessManager() |
| _options.createEngineServices() |

Preserve current evaluation and scope-disposal order in both branches. Remove only registry creation/arguments.

### Spawn and runtime assignment

| EngineRuntimeService._initialiseEngine(engine, runtime, signal): process absent |
| --- |
| usePlatformService().getProcessManager() |
| processManager.spawnProcess(engine.executablePath) - await |
| _runAnalysisClientWork(runtime, initialiseClient) - await unless cancelled |

This existing service body stays unchanged. It stores the returned process before client work, including a late result after cancellation so disposal can release it. Existing-process recovery continues using assertProcessOpen with that object.

| BrowserProcessManager.spawnProcess(executablePath, args) |
| --- |
| _resolveWorkerUrl(executablePath) |
| new Worker(url, { name: 'ChessVue UCI' }) |
| new BrowserWorkerProcess(worker) |
| markRaw(process) |
| process.once('exit', () => this._processes.delete(process)) |

Reject unsupported arguments before URL resolution. Add the constructed process to the manager's private disposal set before registering the exit listener, then return that same object. The manager's one-shot listener deletes its reference; construction failure terminates an already-created Worker. No registration id or transport insertion occurs.

### Protocol attachment and handshake

| IEngineClient implementation: initialiseEngine(engine) |
| --- |
| _requireProcess(engine) |
| _initialiseAssignedEngineSession(engine) |
| _attachToProcess(engine, process, session) |
| _awaitUciOk(session, process) - await |
| parseOptionLines(optionLines) |
| Existing saved-option writes - await each |
| _awaitReadyOk(session, process) - await |

The same-process initialised-session branch returns at the existing point. Replace terminal sessions and stop an attached old session before replacement, preserving the existing method order and error handling. Do not change the UCI guard, option commands or readiness state transitions.

| IEngineClient implementation: _requireProcess(engine) |
| --- |
| _requireRuntimeAssignedEngine(engine) |
| this._isProcessOpen(process) - protected browser override reads closed state |

Retain the native missing-process check before the hook and return the same process object after it succeeds.

| IEngineClient implementation: _attachToProcess(engine, process, session) |
| --- |
| _requireRuntimeAssignedEngine(engine) |
| _attachProcessLineListeners(process, onLine, onExit) |

Compare the captured object with runtime.process before attachment. Reuse an existing attachment only for that same object; otherwise stop/detach the old session as today. Store the process and the exact callbacks' removal closure in the session.

| IEngineClient implementation: _attachProcessLineListeners(process, onLine, onExit) |
| --- |
| process.stdout.on('data', onData) - when stdout exists |
| process.stderr.on('data', onData) - when stderr exists |
| process.once('exit', onExit) |

| IEngineClient implementation: attached data callback |
| --- |
| _consumeLine(engine, session, line) - for each complete non-empty trimmed line |

The callback retains its own string remainder. Each Worker message already carries a terminal newline from the process adapter. UCI parsing/state dispatch is unchanged.

### Command delivery and failure

| IEngineClient implementation: _writeCommand(process, command) |
| --- |
| _writeProcessLine(process, command) - await |

| IEngineClient implementation: _writeProcessLine(process, command) |
| --- |
| this._isProcessOpen(process) - protected browser override |
| process.stdin.write(command + '\n') |

Keep the native missing-input error before writing and the helper's async declaration. The input writes each complete command through Worker.postMessage(command), without the newline. The adapter buffers incomplete input only; it adds no protocol command generation.

| IEngineClient implementation: attached exit callback |
| --- |
| this._getProcessExitDetail(process) - protected browser override |
| _createPlatformError(UnexpectedExit, 'engineClient', message, detail) |
| _failUciSession(session, error) |

| IEngineClient implementation: _failUciSession(session, error) |
| --- |
| _terminateUciSession(session, Failed, error) |

| IEngineClient implementation: _terminateUciSession(session, context, error) |
| --- |
| _rejectContextCompletion(session.current, error) |
| session.detachProcessListeners() - when attached |

Keep the stopped/failed-session guards and current session-state clearing. Worker error/messageerror or a failed postMessage closes that process and notifies its exit listeners. The manager's listener removes its disposal reference; the client's independent callback reads retained detail before clearing its attachment. No manager callback forwards to the client.

### Shutdown, restart and platform disposal

| EngineRuntimeService._releaseEngineProcess(engine, runtime): process present |
| --- |
| usePlatformService().getProcessManager().stopProcess(process) - await |
| _stopClientSession(engine) - await |
| _clearAnalysisState(runtime) |

The existing InvalidProcessHandle catch covers an already-closed process and still reaches client cleanup. Clear runtime.process after client cleanup as today; other failures retain it. Existing analysisShutdownWork shares concurrent shutdown. No service changes are needed.

| BrowserProcessManager.stopProcess(process): open channel |
| --- |
| assertProcessOpen(process) |
| process.once('exit', onExit) |
| process.kill() |

The registered callback resolves the stop promise. Worker kill emits managed closure synchronously after terminate() returns; it does not await a browser physical-exit event.

| BrowserProcessManager.stopProcess(process): closed or unsupported object |
| --- |
| assertProcessOpen(process) - throws InvalidProcessHandle |

| IEngineClient implementation: stopEngine(engine) |
| --- |
| _requireRuntimeAssignedEngine(engine) - then check process presence only |
| _getSession(engine) |
| _stopUciSession(session) - when present |

| BrowserProcessManager.restartProcess(process, executablePath, args) |
| --- |
| stopProcess(process) - await |
| spawnProcess(executablePath, args) - await |

| BrowserPlatformService scope disposal |
| --- |
| Existing window/document/theme listener removal |
| browserProcessManager.dispose() |
| reset() |

| BrowserProcessManager.dispose() |
| --- |
| process.kill() - for each object in a snapshot of its live-process set |

The process object owns Worker-handler removal and managed exit notification; the manager's exit listener owns deletion from the disposal set. UCI-session detach removes only its own data/exit listeners, leaving the manager's listener intact and without terminating the Worker. All closure routes are one-shot and later output is ignored.

## Implementation and verification order

1. Implement BrowserWorkerProcess against the unchanged IProcess contract. Cover framing, original object identity through reactive storage, closure, retained failure detail and listener cleanup. Do not change the native implementation.
2. Create the base from the current NW.js client and its existing string line/write helper bodies, applying only the mechanical differences and two host hooks listed above. After checking parity, adopt the same unchanged base in the native client and remove its obsolete native I/O helper copies. Construct and retain each raw client directly in its platform store; remove the client store factory, binding object, browser resolver factory and both transport files.
3. Remove BrowserEngineRegistry and its composition arguments. Use a private manager-owned disposal set; construct Workers directly and update tests to stub the global Worker constructor. Keep custom-services selection and scope disposal unchanged. EngineRuntimeService and shared contracts remain untouched.
4. Add the focused BrowserEngineDependency.spec.ts regression check, including type-only imports/re-exports: neither sibling implementation may depend on the other; private support cannot depend on platform implementations. Check that no resolver, transport registry, raw-Worker assertion or compatibility export remains. Keep the check local to this affected graph, without a repository-wide architecture framework.
5. Run the focused checks below. Only during implementation, after they pass, update affected ownership notes in UtilityIndex, EngineClient, ProcessManager and EngineRuntimeOwnership. The Worker process is in src/utility/BrowserWorkerProcess.ts; the host-independent client base is private platform support in src/platform/base/UciEngineClientBase.ts. The later package plan must build on this direct process ownership rather than reintroduce its superseded registry/transport lookup.

## Verification and completion criteria

| Check | Required evidence |
| --- | --- |
| New BrowserWorkerProcess unit coverage | Split/multiple input commands; newline-free Worker messages; CRLF/multiple output lines; ignored non-string data; accepted/closed writes; postMessage throw; error/messageerror; one managed exit; no exit replay; callback removal; ignored output after close. |
| BrowserUciEngineClient.spec.ts | Existing handshake/options, analysis stop acknowledgement, legal moves, failure detail, isolated workers/restart, rejected targets/arguments and ignored late output. Change identity assertions to the returned process rather than the underlying Worker. Exercise inherited operations directly and verify that the platform getter returns the same raw client instance. |
| Browser process/platform coverage | Independent manager/client construction; direct process validity without registry membership; already-closed stop rejection; restart replacement; disposal of all live Workers; disposal-set cleanup through the manager's exit listener, including after client detachment; failed-construction cleanup; custom service injection. |
| EngineRuntimeService.spec.ts and engine-race journeys | Existing APIs and source unchanged; cancellation, late spawn, shared shutdown, closed-resource cleanup and pending client work still settle. |
| NW.js process/client/platform suites | Preserve the completed native process ownership, UTF-8 setup, handshake, protocol states and stop/replacement behaviour. |
| Base/native source comparison | UCI states, session fields, protocol operation bodies, command order and await boundaries match the current native reference after accounting for the explicitly listed mechanical changes and two hooks. Any further behavioural change requires a separate user decision. |
| Dependency review/check | No sibling implementation imports, including aliases/type-only/barrel paths; no reverse private-support dependency or injected resolver; the platform getter returns the plain client through the existing IEngineClient contract, with no nested client store. |

Run npm run check:code, the focused Vitest suites and npm run build. Then run the existing real-Worker [browser analysis](../e2e/browser/Analysis.spec.ts) and [browser failure](../e2e/browser/EngineFailure.spec.ts) checks with one worker and no retries. Verify load/WASM failure diagnostics, independent healthy Worker operation, stop/restart and reload. Fake Workers and scripted journeys alone do not verify this adapter's application integration.

Completion requires an actual raw IProcess in the browser runtime, no registry/transport lookup, independent manager/client implementations, private inherited UCI logic, retained failure details, unchanged shared/runtime APIs and shared base during native adoption, and passing focused checks. The implementation and verification below are complete. This does not resume the separate engine package rework.

## Implementation verification

Verified on 24 October 2026:

- 93 focused tests passed across 11 files: browser process/dependency/client/platform, native process/client/platform, platform target, runtime and engine-race journeys. Report: test-results/BrowserProcessFixUnitResults.json.
- Six real-Worker browser analysis/failure tests passed with one worker, no retries, skips or flaky results. They cover independent engines, stop/restart, position changes/reload, rejected paths and Worker/WASM loading failures. Report: test-results/BrowserProcessFixBrowserResults.json, ports 5573/5574.
- npm run build passed the code audit, all TypeScript projects and production bundling.
- An AST-based source comparison found all 53 native method bodies equivalent after only the documented mechanical substitutions and two hooks; the copied line-listener helper also matches. Report: test-results/BrowserProcessSourceComparison.json.
- Git comparison confirms no shared-contract, EngineRuntimeService, native implementation or NwjsUtility changes. The obsolete browser transport/resolver files and registry are removed.
- The disposal journey still logs its pre-existing Pinia-destroyed teardown messages; the same messages were verified on unchanged HEAD during the preceding native correction. Assertions pass. No native NW.js installation or full browser catalogue run is claimed.

Follow-up on 24 October 2026: removed the injected Worker factory and manager constructor argument. spawnProcess now constructs Worker directly; tests stub and restore the global Worker constructor. All 27 focused browser tests and the code audit, TypeScript checks and build passed. Report: test-results/BrowserWorkerConstructionUnitResults.json.

Follow-up on 24 October 2026: the platform store now constructs markRaw(new BrowserUciEngineClient()) and returns that same plain instance through getEngineClient. Removed the separate client Pinia store, factory and nine-method binding object. Preserved the user's support-file moves to src/platform/base/UciEngineClientBase.ts and src/utility/BrowserWorkerProcess.ts; updated stale test references and dependency checks for those locations.

Verification for this follow-up: 93 focused tests passed across 11 files with one worker thread (--maxWorkers=1 --pool=threads --testTimeout=45000); all six real-Worker browser checks passed separately with one worker and no retries. The build, code audit and TypeScript checks passed. Browser report: test-results/BrowserClientInstanceBrowserResults.json (ports 5673/5674). The unit run passed in the Vitest console; Playwright subsequently cleared its temporary JSON report when preparing its output directory. The initial overlapping run hit unit-worker startup timeouts and one browser form-setup timeout; both suites were rerun sequentially without further code changes. The current AST comparison confirms all 53 native method bodies, state declarations and copied line-listener logic match after the documented substitutions: test-results/BrowserClientInstanceSourceComparison.json.

## Native inheritance follow-up

The user explicitly requested comparing the base with the NW.js UCI client and then making the native client inherit it as well. This supersedes the initial browser-only scope statements that preserved the standalone native client; the earlier verification entries remain historical.

Before modifying the native implementation, the AST comparison found no unexpected differences in all 53 method bodies, state declarations or line-listener logic after the reviewed type/hook substitutions. The write helper also matches after error-factory adaptation and the already documented generic missing-stdin message: ProcessStartFailed is retained, with no native PID in that message.

NwjsUciEngineClient now extends UciEngineClientBase and implements only _isProcessOpen and _getProcessExitDetail. It uses actual native exitCode/signalCode and the existing native liveness utility. Both hooks retain the existing native lifecycle/error behaviour. The base itself is byte-for-byte unchanged. NwjsPlatformService and the journey override construct markRaw(new NwjsUciEngineClient()); the obsolete native client Pinia store, duplicate protocol implementation and unused native line/write helper copies are removed. No process-manager behaviour, shared contract, persistence or EngineRuntimeService API changes are included.

| NwjsPlatformService platform-store setup |
| --- |
| useNwjsStorageAdapter() |
| useNwjsProcessManager() |
| useNwjsSystemThemeAdapter() |
| markRaw(new NwjsUciEngineClient()) |

The existing getEngineClient switch returns the same raw native subclass through IEngineClient. Journey createEngineServices constructs it independently of its scripted process manager. UCI protocol, session and I/O flows above now apply to both subclasses.

Verified: 95 focused tests across 11 files, including both normal/signalled native exits and raw native client identity. The code audit, TypeScript checks and production build pass. Two browser journeys using the native client with scripted processes pass with one worker and no retries: crash/retry/manual replacement and pending-work removal/late-output cleanup. This does not claim an installed NW.js executable run.

Evidence under the ignored node_modules/.cache/codex directory is retained separately from Playwright's cleaned output directory: NwjsUciInheritanceBaseline.json (source snapshot and parity check), NwjsUciInheritanceVerification.json (unchanged-base check), NwjsUciInheritanceUnitResults.json and NwjsUciInheritanceBrowserResults.json. The pre-existing disposal-journey Pinia teardown messages remain unchanged; assertions pass.
