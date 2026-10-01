# Analysis Drift Fix Follow up Plan

Status: implemented with serial execution and cooperative cancellation. All 258 tests across 29 files pass, and `npm run build` passes, including the TypeScript check. The stale-reply regression fails against the synced `5f0c869` service and passes with this implementation. Desktop checks remain unperformed; see verification below.

## 1. Serialise engine work and check cancellation at safe boundaries

Use one serial work chain per assigned engine. A newer request aborts its predecessor, but the predecessor finishes any issued engine step before observing cancellation and leaving the queue. The next queue entry checks its own signal before starting. Analysis replacement reuses the running process and the existing client's search Stop handshake.

The defect being addressed is `_queueEngineDisposal` calling `_stopClientSession` before its queued action starts. That discards the old response context even when a later start supersedes disposal and keeps the same process. Preserve that context until the next operation consumes it or an actual process shutdown is issued.

### Promise roles and cancellation rules

Reuse [Deferred](../src/utility/async/Deferred.ts) and the existing runtime fields in [Engine.ts](../src/contracts/Engine.ts). No new public request IDs or cancellation parameters are required.

| Value | Meaning | On supersession |
| --- | --- | --- |
| Request's `AbortController` | Whether this request may issue more work or publish results | Abort immediately with `Aborted`; every replacement must abort its predecessor, including one whose startup already completed. |
| Request's `completion: Deferred<void>` | Promise returned to the caller; analysis start resolves after startup | Reject immediately if still pending. This does not release the queue or interrupt a protocol wait. |
| `engine.$.analysisWork` | Tail of actual issued work, including any required protocol response | Remain pending until that work settles. Later entries await this tail, never the caller's deferred promise. |
| `engine.$.analysisClientWork` | Deferred completion of the currently awaited client call | Resolve only when that call settles; lets explicit shutdown identify and interrupt a protocol wait. |
| `engine.$.analysisShutdownWork` | Actual physical shutdown already issued | Share this promise across terminal requests; successors wait for it even if its initiating caller is cancelled. |
| Request's `isFinal` | Whether a natural final update has already arrived | Retain it to avoid changing Ready back to Running when startup subsequently resolves. |

The signal is the authority for request cancellation. Remove `_isCurrentAnalysis` and its operation-identity comparisons from the service; use the captured signal at execution/publication boundaries. Keep the latest request record only so the next request can abort it and settle its caller. An old request may settle normally without ever being aborted; queue progression waits for real work settlement, not for an abort event.

Do not race a protocol request against the abort signal to advance the queue early. Register rejection handling for the deferred completion and underlying work immediately. Queue failures must settle the affected caller and leave a usable tail for later requests.

### Request registration and queue function flow

```text
EngineRuntimeService.startAnalysis / stopAnalysis / stopEngine / restartEngine
  -> _beginAnalysisOperation(runtimeState)                   [synchronous]
     -> previous.abortController.abort(new Aborted(...))
     -> previous.completion.reject(...)                     [pending caller only]
     -> create and store { abortController, completion, isFinal }
  -> _queueAnalysisOperation(runtimeState, request, action)
     -> capture previous analysisWork
     -> append actual runner; install it as analysisWork
     -> return request.completion to the caller

Queued runner
  -> await previous actual work's settlement
  -> signal.throwIfAborted()                                 [skip obsolete entry]
  -> await action(signal)
     -> await each issued engine step to its safe boundary
     -> retain acquired resources / reconcile completed resource work
     -> signal.throwIfAborted() before further commands or publication
  -> resolve completion
  -> catch:
     -> if signal.aborted: reject completion with its Aborted reason
        and suppress stale availability/error publication
     -> otherwise: retain existing runtime failure handling;
        reject completion and abort this request to reject further output
  -> settle the work tail after handling the result
```

Keep the settled `analysisWork` promise as the tail until the next request replaces it. This avoids the existing old-tail/new-tail identity check in `finally`. Catch failures within the runner so a rejected predecessor cannot silently prevent a later entry from running or settling its caller.

For analysis, readiness belongs inside the queued action. Avoid nested queue acquisition: `startAnalysis` awaits the existing `ensureReady` implementation within its slot. Do not independently queue that internal call behind the slot that is awaiting it. Preserve unrelated player-turn and option-discovery behaviour; this follow-up changes the existing analysis lifecycle queue and its Stop Engine/Restart integration.

### Await boundaries and resource handover

| Issued engine step | What must finish before proceeding | Cancellation checkpoint |
| --- | --- | --- |
| `ProcessManager.spawnProcess` | Spawn succeeds or fails; record a returned handle on the assigned engine | After retaining the handle, before client initialisation. A successor can reuse or explicitly release it. |
| `IEngineClient.initialiseEngine` | Existing UCI initialisation/readiness sequence settles | After the client call, before starting analysis or publishing Ready. |
| `IEngineClient.startAnalysis` | Existing replacement Stop handshake, game-boundary readiness, and startup commands settle | After the client call. Streaming may continue; the next operation can use the client's existing stop/start transitions. |
| `IEngineClient.stopAnalysis` | `_stopSearch` consumes the terminating `bestmove` and reaches Ready | After recording that the search stopped, before publishing status. |
| Process stop/restart work already issued | Physical process work settles and its handle is reconciled | Before any additional spawn, initialisation, or status publication. |

Cancellation must not skip bookkeeping for resources already acquired or released. A late spawn still needs its handle retained; completed shutdown still needs its captured handle cleared. Serial execution gives those writes a defined place before the successor runs. They do not require an extra request-identity guard.

Keep the client state machine's existing state/context checks. They validate protocol transitions, which is separate from the service's request cancellation. There is no requirement to observe a service abort between every private UCI write: an already-entered client method can finish its existing sequence, then the service observes cancellation at the boundary. The successor handles any search that sequence started.

### Analysis startup and streaming function flow

```text
startAnalysis(engine, game, request)
  -> register request; capture its signal and current subscriber
  -> publish Starting for the new request
  -> _queueAnalysisOperation(..., action)
     -> signal.throwIfAborted()                              [runner entry]
     -> await ensureReady(engine, signal)
     -> signal.throwIfAborted()
     -> mark analysisNeedsStop before entering client startup
     -> await IEngineClient.startAnalysis(..., guardedOnUpdate)
     -> signal.throwIfAborted()
     -> if !isFinal: publish Running
     -> resolve caller's startup completion

Client emits an update, including after startup completion
  -> guardedOnUpdate(update)
     -> if signal.aborted: return false
     -> if captured subscriber is no longer registered: return false
     -> if isFinal was already accepted: return false
     -> validate every incoming line and best move
     -> update isFinal / analysisNeedsStop / availability
     -> forward to captured subscriber
```

The callback's signal check remains necessary because streaming outlives the awaited startup call. Subscriber registration can also change independently of a queued request, so retain that check and the composable's existing active-seat/subscription checks. These are the remaining publication boundaries, not a second operation-ownership mechanism.

Use signal checks for post-await success/error publication in `ensureReady`, `_runEngineOperation`, and analysis lifecycle helpers. Preserve the existing behaviour of showing Starting immediately when a request is registered: an older operation that finishes afterwards must not overwrite it. Legal-update validation, natural completion, and failure retention keep their current behaviour.

### Successive requests and skipped work

```text
A is analysing
B starts replacement and awaits A's Stop response
D requests Stop Engine but has not begun terminal work
C requests analysis, aborting D
  -> B's caller is already cancelled; B's actual client work is still observed
  -> A's bestmove is consumed by its original StoppingSearch context
  -> B finishes its issued client sequence, then observes cancellation
  -> D's runner sees its aborted signal and skips unissued teardown
  -> C's runner sees a live signal
     -> reuse the same handle/session
     -> stop any search B started through the existing client transition
     -> clear runtime analysisLines and start C
```

Do not require an obsolete request to perform cleanup already owned by its successor. Active searches are stopped by the next client start/Stop; runtime lines are cleared by the next start; pending spawns hand their handle to the next operation. `stopAnalysis` retains the process and rendered results. Different assigned engines have independent work tails.

### Explicit shutdown of a blocked protocol wait

Cooperative cancellation cannot release an engine that never answers `uciok`, `readyok`, or `bestmove`. Preserve one narrow interruption path for an explicit Stop Engine/Restart that remains un-aborted. Ordinary analysis replacement and Stop Analysis keep the serial flow above.

```text
_queueEngineDisposal(...)
  -> register the request; capture previous analysisWork and analysisClientWork
  -> arrange an interruption in a microtask
     -> signal already aborted, or no client call pending: skip interruption
     -> otherwise await _stopEngineProcess(...)
        -> join analysisShutdownWork if shutdown is already issued
        -> otherwise _releaseEngineProcess(...)
           -> await ProcessManager.stopProcess(capturedHandle)
              -> process exit releases the client's state-owned waits
           -> await _stopClientSession(...) after successful physical release
           -> clear handle and runtime analysis state
  -> combine previous work, captured client completion, and interruption
     into analysisWork before a successor can register
  -> _queueAnalysisOperation(...)
     -> await that combined work; signal.throwIfAborted()
     -> Stop Engine: await remaining process release; check signal; publish Unavailable
     -> Restart: await remaining process release; check signal; await ensureReady
  -> publish completion/error only while the signal remains live
```

The terminal path does not wait behind the client promise it needs to release. `_runAnalysisClientWork` registers a `Deferred<void>` and resolves it in `finally`, independently of the cancelled caller's completion. `_stopEngineProcess` shares issued physical shutdown through `analysisShutdownWork`. The combined work tail observes both completions; cancellation does not release it early. A pending spawn has no client completion marker, so disposal awaits that spawn through the normal queue before deciding whether to stop it.

The signal check directly precedes initiation of physical shutdown. Client termination follows successful process release, preserving the live response context and handle if physical shutdown fails. A failed shutdown rejects its caller promptly, while the original client work still has to drain or be interrupted by a later terminal request. Once physical shutdown has been issued it must settle before reuse; a later request can skip only the remaining unissued work. Restart uses stop followed by `ensureReady`, allowing cancellation between shutdown and a new spawn. No blanket mandatory-disposal stage or persistent cleanup ledger is needed.

### Files and verification

| File | Implementation |
| --- | --- |
| [EngineRuntimeService.ts](../src/domain/EngineRuntimeService.ts) | Make the queue tail represent drained work; replace service operation-identity checks with captured-signal checks; move speculative session termination out of request registration; keep explicit shutdown able to release a client wait. |
| [Engine.ts](../src/contracts/Engine.ts) | Reuse the request controller/deferred/final state and work tail. Add `analysisClientWork` and `analysisShutdownWork` for explicit terminal interruption. |
| [GameAnalysisComposable.ts](../src/state/game/GameAnalysisComposable.ts) | Preserve current subscription/seat checks, synchronous result invalidation, and Stop retention. Confirm expected Aborted completion remains consumed. |
| [NwjsUciEngineClient.ts](../src/platform/nwjs/NwjsUciEngineClient.ts) | Preserve client signatures, captured input, and state-owned waits; verify that service cancellation no longer destroys a reusable session. |

Use controlled promises and callbacks in the existing [service](../src/domain/__tests__/EngineRuntimeService.spec.ts) and [UCI client](../src/platform/__tests__/NwjsUciEngineClient.spec.ts) suites:

1. Cancel during spawn, initialisation, client startup, and Stop. The caller settles immediately, but the next queued client call waits for the issued step's real completion. A queued obsolete request sends nothing.
2. Exercise A -> B -> C and A -> B -> A. Signals reject obsolete callbacks, success writes, and late failures without operation-object comparisons. Changing the subscriber alone also rejects old output.
3. Preserve natural final output received before startup resolves. It must leave Ready and must not be overwritten by Running.
4. Reproduce B awaiting A's `bestmove`, followed by unissued Stop Engine/Restart D and replacement C. Assert that D is skipped, the same process is reused, and old replies are consumed by the correct stopping contexts. C returns to A's position: A's old `e7e5` is still legal there but must produce no update; B's `g1f3` must also be drained before C receives its own `c7c5`. Check both interim and final updates. Also cover `stopAnalysis` as successor.
5. Preserve explicit removal during a pending `readyok` wait without supplying `readyok`. If terminal shutdown has already been issued before a replacement arrives, the replacement waits for actual shutdown and never uses the released handle.
6. Verify late spawn reuse versus current removal, failure settlement without a poisoned queue tail, preservation of the newest subscriber, and independent progress of another assigned engine. Repeated terminal requests share issued shutdown; failed physical shutdown preserves the client wait and process handle.

## 2. Persist fold indexes when removing a seat

In [GameView](../src/views/GameView.vue), keep synchronous seat removal and the existing splice of `analysisEngineExpandedByIndex`. Start `uiStateStore.saveLayoutState()` immediately after applying the adjusted layout, then observe both persistence and engine cleanup with `Promise.all`. This lets the layout save proceed while process shutdown is pending and sends persistence failures through the existing `run` error handler.

### Removal and persistence function flow

```text
AnalysisPanel emits engineRemoveRequested(index)
  -> GameView.run(() => removeAnalysisEngine(index))
     -> GameView.removeAnalysisEngine(index)
        -> capture current game; return if the seat no longer exists
        -> cleanup = GamesStore.removeAnalysisEngine(game, index)
           -> GameAnalysisComposable.removeAnalysisEngine(...)
              -> capture seat; disposeAnalysisSubscription(assignedEngine)
              -> stopAssignedEngine(assignedEngine)
                 -> EngineRuntimeService.stopEngine(...) [flow above]
              -> remove captured seat; touchGame(game)   [before yielding]
              -> await engine cleanup
        -> copy and splice analysisEngineExpandedByIndex [before awaiting cleanup]
        -> UiStateStore.setLayoutState(adjustedLayout)
        -> saving = UiStateStore.saveLayoutState()
           -> loadLayoutState()
           -> SerializationService.writeUiLayoutDocument(...)
              -> serialiseUiLayoutState(...)
              -> StorageAdapter.writeTextFile(...)
        -> await Promise.all([cleanup, saving])
     -> run catches persistence failure and displays the existing notice
```

Start both promises before awaiting either. If no layout is loaded, keep the existing removal behaviour and use a resolved no-op for `saving`. Engine cleanup errors retain the existing `stopAssignedEngine` handling; layout-save errors propagate to `GameView.run`.

Verify the visible behaviour: configure two seats with different fold states, remove the first, save the remaining roster, and reload. The surviving seat must retain its fold state. Also check removal while engine cleanup is pending. Use the existing layout persistence coverage and a focused manual check for this small UI change.

## 3. Verify and update completion status

Verification completed:

- The full `npm run test:unit -- --run` suite passes: **258 tests in 29 files**, including 30 service tests, 17 UCI client tests, and the existing layout persistence and GameView suites.
- `npm run build` passes, including `vue-tsc --build`. The regression uses `slice(-1)` instead of `Array.at()` to stay compatible with the project's TypeScript target.
- Both stale-reply cases were also run against an isolated copy of the synced service. They fail at the callback assertion: A's old `info` and `bestmove` produce **two updates where zero are allowed**, for both superseded Stop Engine and Restart. The temporary baseline copies were removed afterwards.
- `git diff --check` passes. The original [Analysis Feature Drift And Fix Plan](AnalysisFeatureDriftAndFixPlan.md) remains unchanged and closed.

The desktop fold-state removal/reload check and real-engine smoke test have not been run. Fold persistence was checked through code review and the existing automated persistence coverage. The original plan's real-engine and interaction/runtime-notification follow-ups remain separate from these two implemented review fixes.

