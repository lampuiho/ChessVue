# Engine Runtime Ownership Flows

## Scope
This document covers the layer-2 and layer-1 runtime ownership behind `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, option discovery for `SCN-ENGINE-01` and `SCN-ENGINE-02`, the engine side of `SCN-ENGINE-03` and of the live move loop, and the engine side of `SCN-PLATFORM-01` and `SCN-PLATFORM-02`: native UCI executables under NW.js, and UCI Worker scripts, including the bundled Stockfish WASM build and installed browser packages, on both targets. Installing and removing packages (`SCN-ENGINE-04` and `SCN-ENGINE-05`) is in [PersistenceAndAdministration.md](PersistenceAndAdministration.md). Game-level triggers are in [GameplayAndControl.md](GameplayAndControl.md) and [AnalysisAndSetup.md](AnalysisAndSetup.md).

## Ownership Summary
- `EnginesStore` owns the configured profiles read from settings and caches discovered option metadata by profile id, together with the client type and entry path it was read from.
- `GamesStore` decides when analysis runs (`GameAnalysisComposable`) and when a player turn is armed (`GamePlayerTurnComposable`). It calls `EngineRuntimeService` only and never touches a process or protocol session.
- `EngineRuntimeService` owns `engine.$`: the process reference, availability, `lastError`, the analysis callback registration, the analysis operation, the serial work queue, issued client work, shared shutdown work, temporary option-discovery engines, and pondering started from a guarded player-turn result.
- The platform service (`NwjsPlatformService` or `BrowserPlatformService`) selects one `{ processManager, engineClient }` binding per `EngineClientType` and disposes its process managers.
- A process manager spawns, checks and terminates the process object it returns. Its private live-process set exists only for disposal.
- An engine client (`NwjsUciEngineClient` or `BrowserUciEngineClient`, both extending `UciEngineClientBase`) owns the UCI session on `engine.$`: process listeners, protocol state, captured search positions, the expected ponder move, state-owned completions and parsing.
- `BrowserWorkerProcess` adapts one Worker to `IProcess`, and `WorkerScriptLoader` loads Worker scripts, including installed packages stored in IndexedDB. Both live in `src/utility` but appear in tables because they are the process and script-storage boundary of the Worker target. `UciUtility` builds commands and parses single records; like the chess rule utilities it is named in notes, not tabled.

Ownership decisions:

- **One process reference, no registry.** `spawnProcess` returns the actual process object; the runtime stores it on `engine.$.process`, and the manager and client both receive that same object. **Why:** the earlier generated handles and process maps duplicated the runtime field, and a PID cannot recover the streams. The rejected alternative, a lookup registry, had to be kept in sync with exits and replacements. The invariant is that no operation resolves a process through membership; the managers' live-process sets are used only to kill what is still running at disposal. See the [NW.js process ownership correction](../../ArchivedPlans/NwjsProcessOwnershipFixPlan.md).
- **Independent manager and client.** The process manager and engine client never import or call each other; the browser Worker is adapted to the shared `IProcess` contract instead of being looked up through a transport registry. **Why:** the old browser client imported the manager's registry, a sibling dependency across the platform boundary. See the [browser engine dependency correction](../../ArchivedPlans/BrowserEngineDependencyFixPlan.md).
- **Explicit owners, no counters.** Every analysis start, stop and disposal is an operation with its own `AbortController` and `Deferred` completion; a new operation aborts and rejects the previous one, and a serial queue drains issued work before the next starts. **Why:** this replaced generation-style invalidation, which had to be rechecked after every await. The invariant is one current operation per engine, cancelled at the action that supersedes it. Callback identity checks protect the registration being detached, not a version. See the [code cleanup decisions](../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions).

## Owner And Mutable State
`EngineRuntimeService` mutates these `engine.$` fields:

- `process`: the exact object returned by `spawnProcess`, stored even when its startup was cancelled so that disposal can release it; cleared only after physical stop and client cleanup succeed.
- `availability` and `lastError`: `Starting`, `Ready`, `Running`, `Unavailable` or `Failed`, with the failure message. The client also writes `lastError` when it fails a session on bad protocol output.
- `analysisCallback`: the single game subscription registered by `subscribeToAnalysis`.
- `analysisOperation`: `{ abortController, completion, isFinal }` for the current start, stop or disposal.
- `analysisWork`: the tail of the serial queue; `analysisClientWork`: settles when the issued client call drains, even if its caller was cancelled; `analysisShutdownWork`: the physical stop shared by concurrent terminal requests; `analysisNeedsStop`: whether a running search must be stopped.
- `analysisLines`: every reported rank; the client fills it while analysing and the service clears it on release.

The client keeps a private `session` on the same runtime. It records the attached process, its listener detacher, the game id and root FEN of the current protocol game, discovered options and a discriminated context for the current protocol state. Handshake completions, captured positions, the expected ponder move, the stop completion and a ready player move belong only to the state that needs them.

`GamesStore` does not mutate either layer directly. It receives protocol-neutral `IEngineAnalysisUpdate` values and validated `IMove` results. Emitted updates are readonly, so the store keeps their line references without copying.

## Platform Composition

| `defineNwjsPlatformServiceStore(nw)` store setup |
| --- |
| `useNwjsStorageAdapter()` |
| `markRaw(new NwjsProcessManager(EngineClientType.Uci))` |
| `useNwjsSystemThemeAdapter()` |
| `markRaw(new NwjsProcessManager(EngineClientType.UciWorker))` |
| bind `Uci` to the native-configured manager and `markRaw(new NwjsUciEngineClient())` |
| bind `UciWorker` to the Worker-configured manager and `markRaw(new BrowserUciEngineClient())` |
| `onScopeDispose(_dispose)` |

| `useBrowserPlatformService` store setup |
| --- |
| `markRaw(new BrowserProcessManager())` |
| bind `UciWorker` to that manager and `markRaw(new BrowserUciEngineClient())` |
| `setBrowserPlatformOptions({ createEngineServices })` given: bind `Uci` to the injected services (journeys) |
| register `pagehide`, `focus` and `visibilitychange` listeners |
| `onScopeDispose(...)` (see [platform disposal](#platform-disposal)) |

| `getProcessManager(clientType)` / `getEngineClient(clientType)` |
| --- |
| `_getEngineBinding(clientType)`; an unbound type throws `Unsupported engine client type` |

`usePlatformService` selects the NW.js or browser store once from `getPlatformTarget()`. The default profile from `UserSettingService` is the bundled single-threaded Stockfish WASM build (`StockfishConfig.entryPath`, `engines/stockfish/stockfish-19-lite-single.js`) with `EngineClientType.UciWorker`, so both targets run it as a Worker. Only NW.js binds native `Uci` executables.

## Option Metadata Discovery

| `EnginesStore.refreshOptionMeta(engineProfile)` (also `loadOptionMeta` on a cache miss) |
| --- |
| `EngineRuntimeService.getOptions(engine)` |
| cache the result only if the profile still has the same client type and entry path |

| `EngineRuntimeService.getOptions(engineProfile)` |
| --- |
| `_createAssignedEngine(engineProfile)`: a temporary copy |
| `EngineRuntimeService.ensureReady(temporaryEngine)` |
| `EngineClient.getOptions(temporaryEngine)`, copied through `_copyOptionMeta` |
| `finally`: `EngineRuntimeService.stopEngine(temporaryEngine)` |

The temporary engine is never stored or attached to a game, its saved options are applied during the normal handshake, and its process is closed before the promise settles. `GameCreationModal._validateRequiredEngines` and `useQuickGame` also call `getOptions` as an availability probe for engine players before creating or starting a game; this is a recorded presentation-to-domain [exception](../Architecture/index.md#current-exceptions).

## Readiness And Process Start

| `EngineRuntimeService.ensureReady(engine, signal?)` |
| --- |
| aborted: return |
| `_createBaseRuntime(engine)` |
| `_runEngineOperation(runtime, Ready, () => _initialiseEngine(engine, runtime, signal), signal)` |
| failure after abort: swallowed |

| `EngineRuntimeService._runEngineOperation(runtime, successAvailability, operation, signal?)` |
| --- |
| `operation()` |
| not aborted: set `successAvailability` |
| failure, not aborted: `InvalidProcessHandle` clears `process`; set `Failed` and `lastError`; rethrow |

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal?)` |
| --- |
| `usePlatformService().getProcessManager(engine.clientType)` |
| availability `Starting` |
| no process: `processManager.spawnProcess(engine.entryPath)` |
| process: `processManager.assertProcessOpen(process)`; `InvalidProcessHandle`: `processManager.spawnProcess(engine.entryPath)` |
| not aborted: `_runAnalysisClientWork(runtime, () => EngineClient.initialiseEngine(engine))` |

`_runAnalysisClientWork` publishes the call as `analysisClientWork` until it settles, so disposal can see that a client wait is in flight.

### Native Spawn

| `NwjsProcessManager.spawnProcess(entryPath, args)` (`Uci` configuration) |
| --- |
| disposed: throw `ProcessStartFailed` |
| `childProcess.spawn(entryPath, args, { stdio: 'pipe' })` |
| add to `_nativeProcesses`; `process.once('exit', remove)` |
| `process.once('spawn', _handleSpawn)`; `process.once('error', _handleError)` |

| `NwjsProcessManager: _handleSpawn` |
| --- |
| `process.stdout.setEncoding('utf8')`; `process.stderr.setEncoding('utf8')` |
| `_cleanup()` removes both startup listeners |
| disposed meanwhile: reject `ProcessStartFailed` |
| resolve `markRaw(process)` |

| `NwjsProcessManager: _handleError(error)` |
| --- |
| remove from `_nativeProcesses`; `_cleanup()` |
| reject `ProcessStartFailed` with the start error |

The manager decodes output as UTF-8 so clients only see strings. The process is added to the disposal set before it has spawned, so a spawn racing disposal is still stopped.

### Worker Spawn

| `WorkerProcessManagerBase.spawnProcess(entryPath, args)` (`BrowserProcessManager`, and `NwjsProcessManager` in its `UciWorker` configuration) |
| --- |
| arguments supplied: throw `ProcessStartFailed` |
| `_lifetime.signal.throwIfAborted()` |
| `_resolveWorkerUrl(entryPath)` |
| `WorkerScriptLoader.createWorker(url, appBaseUrl, _lifetime.signal, { name: 'ChessVue UCI' })` - await |
| `_lifetime.signal.throwIfAborted()` |
| `markRaw(new BrowserWorkerProcess(worker))` |
| add to `_processes`; `process.once('exit', remove)` |
| failure: `worker?.terminate()`; rethrow a `PlatformError`, otherwise wrap it as `ProcessStartFailed` |

| `WorkerProcessManagerBase._resolveWorkerUrl(entryPath)` |
| --- |
| reject empty, drive-letter, UNC and `.exe` paths (desktop executables) |
| `WorkerScriptLoader.resolveUrl(entryPath, appBaseUrl)` |
| require a same-origin `http:` or `https:` URL |

`NwjsProcessManager._resolveWorkerUrl` overrides this for the desktop: an absolute local path becomes a `file:` URL, and `file:`, same-host `chrome-extension:` and same-origin `http(s)` URLs are accepted.

| `WorkerScriptLoader.createWorker(entryUrl, appBaseUrl, signal, options)` |
| --- |
| `signal?.throwIfAborted()` |
| installed package (`engine-files/<name>/...`): `WorkerScriptLoader._readFiles(root, signal)` from IndexedDB `chessvue-engines`/`files`; the entry must be one of the files |
| `signal?.throwIfAborted()` |
| `WorkerScriptLoader._createWorker(entryUrl, rootUrl, files, options)` |

| `WorkerScriptLoader._createWorker(entryUrl, rootUrl, files, options)` |
| --- |
| no stored files and not `file:`: `new Worker(entryUrl, options)` (the bundled Stockfish script and its WASM are served by the app) |
| otherwise: a Blob URL per file and a bootstrap Blob that maps `importScripts`, `fetch`, `XMLHttpRequest.open` and `location` onto them |
| return a `Worker` subclass whose `terminate` also revokes those Blob URLs |

The manager's lifetime signal cancels pending stored-file reads at disposal, and a Worker delivered after disposal is terminated before a process is returned. No readiness wait is added; protocol readiness comes from the UCI handshake.

### Protocol Handshake

| `UciEngineClientBase.initialiseEngine(engine)` |
| --- |
| `_requireProcess(engine)`: present and `_isProcessOpen` |
| `_initialiseAssignedEngineSession(engine)` |
| initialised session on the same process: return |
| initialised on another process: `_stopUciSession(session)`; failed or stopped: `_replaceAssignedEngineSession(engine)` |
| `_attachToProcess(engine, process, session)` |
| `_awaitUciOk(session, process)`; parse the collected option lines |
| `_writeCommand(process, setoptionCommand)` for each saved option |
| `_awaitReadyOk(session, process)` |
| failure: `_failUciSession(session, error)`; rethrow |

| `UciEngineClientBase._attachToProcess(engine, process, session)` |
| --- |
| `engine.$.process !== process`: throw `InvalidProcessHandle` |
| already attached to this process: return |
| attached to another process: `_stopUciSession(session, 'Engine process was restarted.')` |
| `session.process = process` |
| `_attachProcessLineListeners(process, (line) => _consumeLine(engine, session, line), onExit)` |

| `UciEngineClientBase._writeCommand(process, command)` |
| --- |
| `_writeProcessLine(process, command)`: `_isProcessOpen` else `InvalidProcessHandle`; `process.stdin.write(command + '\n')` |

| `BrowserWorkerProcess.stdin.write(chunk)` |
| --- |
| closed: throw `InvalidProcessHandle` |
| buffer to complete lines; `worker.postMessage(command)` for each |
| `postMessage` throws: `_close(detail)`; throw `UnexpectedExit` |

| `BrowserWorkerProcess._onMessage(event)` |
| --- |
| string data while open: add a trailing newline if missing; deliver to each stdout listener |

The two subclasses implement only the host hooks. `NwjsUciEngineClient._isProcessOpen` uses `isProcessOpen` (native `exitCode` and `signalCode` both `null`), and `_getProcessExitDetail` formats `code=... signal=...`. `BrowserUciEngineClient._isProcessOpen` requires an open `BrowserWorkerProcess`, and `_getProcessExitDetail` returns its stored `exitDetail`. A registration error during the handshake is answered with `register later`. `UciUtility` supplies `parseOptionLines`, `buildSetOptionCommand`, `buildUciCommand` and `buildIsReadyCommand`.

## Analysis Runtime

### Start Or Refresh Analysis

| `EngineRuntimeService.startAnalysis(engine, game, request)` |
| --- |
| `_assertBaseRuntime(engine)` |
| `_beginAnalysisOperation(runtime)` |
| capture `onUpdate = runtime.analysisCallback`; availability `Starting` |
| `_queueAnalysisOperation(runtime, operation, action)` |

| `EngineRuntimeService._beginAnalysisOperation(runtime)` |
| --- |
| previous operation: abort with `Aborted('Analysis was superseded.')` and reject its completion |
| store `{ abortController, completion: new Deferred(), isFinal: false }` as `analysisOperation` |

| `EngineRuntimeService._queueAnalysisOperation(runtime, operation, action)` |
| --- |
| chain after `runtime.analysisWork` |
| `signal.throwIfAborted()`: a superseded request is skipped |
| `action(signal)` |
| `signal.throwIfAborted()`; `completion.resolve()` |
| failure: `_failAnalysisOperation(runtime, operation, error)` |
| return `operation.completion` |

| `EngineRuntimeService.startAnalysis: queued action(signal)` |
| --- |
| `EngineRuntimeService.ensureReady(engine, signal)` |
| `signal.throwIfAborted()`; availability `Starting`; `analysisNeedsStop = true` |
| `_runAnalysisClientWork(runtime, () => EngineClient.startAnalysis(engine, game, request, guardedCallback))` |
| `signal.throwIfAborted()`; not yet final: availability `Running` |

| `UciEngineClientBase.startAnalysis(engine, game, request, onUpdate)` |
| --- |
| search mode other than `Infinite`: throw |
| `_requireInitialisedSession(engine)` |
| capture a copy of `game.$.renderedPosition`, the `position ...` and `go infinite` commands, the game id, the root FEN and the `MultiPV` option command |
| `Analysing`: `_stopSearch(engine, session)` |
| require `Ready`; `_prepareGameBoundaryIfNewGame(engine, session, gameId, rootFen)`; require `Ready` |
| `engine.$.analysisLines.clear()` |
| `_writeCommand(process, multiPvCommand)`; require `Ready` |
| `session.current = { Analysing, position, onUpdate }` |
| `_writeSearchCommands(engine, session, commands)`: `position ...` and `go infinite` |

| `UciEngineClientBase._prepareGameBoundaryIfNewGame(engine, session, gameId, rootFen)` |
| --- |
| game id or root FEN changed: `_writeCommand(process, 'ucinewgame')`; `_awaitReadyOk(session, process)` |
| `_assertSessionOperational(session)`; record the game id and root FEN |

- The service promise resolves once the search commands are written; the operation stays current while results stream. Replacing or stopping a pending start rejects it with `Aborted`, which the game composable ignores.
- The client captures its parsing board, commands, game id, root FEN and MultiPV option before its first await, so a later canonical change cannot alter a started search. Issued work drains before the next operation enters the client; cancellation does not retract written commands.
- The new-game boundary compares the root FEN, not the root object, because board editing mutates the root in place.
- Utilities: the captured board comes from `cloneBoardPosition`, the commands from `buildAnalysisCommands` and `buildSetOptionCommand`, and the root FEN from `buildFen`.

### Stream Analysis Output

| `UciEngineClientBase._consumeLine(engine, session, line)` |
| --- |
| dispatch on `session.current.state` |
| thrown error: `engine.$.lastError = message`; `_failUciSession(session, error)` |

| `UciEngineClientBase._consumeAnalysingLine(engine, session, context, line)` |
| --- |
| `info`: `_parseDetailedAnalysisLine(context.position, line)`; a parse failure drops the line |
| store the line at `analysisLines[reference]` |
| `context.onUpdate(_buildAnalysisUpdate(position, analysisLines, false))` returned `false`: restore the previous entry |
| `bestmove`: `_completeAnalysis(engine, session, context, line)` |
| other recognised control output: `_throwUnexpectedControlLine(session, line)` |

| `EngineRuntimeService.startAnalysis: guardedCallback(update)` |
| --- |
| `runtime.analysisCallback !== onUpdate`: return `false` |
| `_acceptAnalysisUpdate(runtime, operation, update)` is `false`: return `false` |
| `onUpdate(update)`: the game subscription callback ([AnalysisAndSetup](AnalysisAndSetup.md#shared-rendered-analysis-refresh)) |
| return `true` |

| `EngineRuntimeService._acceptAnalysisUpdate(runtime, operation, update)` |
| --- |
| operation aborted or already final: `false` |
| `_isAnalysisUpdateLegal(update)`: the best move and every PV line are legal from `update.position` |
| `operation.isFinal = update.isFinal`; final clears `analysisNeedsStop` |
| availability `Ready` when final, otherwise `Running` |

| `UciEngineClientBase._completeAnalysis(engine, session, context, line)` |
| --- |
| `_parseDetailedBestMove(context.position, line)`; no move while legal moves exist: throw |
| `session.current = Ready` |
| `context.onUpdate(_buildAnalysisUpdate(position, analysisLines, true, bestMove))` |

`_buildAnalysisUpdate` orders every retained line by engine rank; it does not apply the three-line display limit. A rejected update leaves the previous runtime entry in place, and emitted line objects are never mutated. A final update cannot be overwritten by `Running` afterwards because the operation is then final.

### Stop, Remove, And Edit

| `EngineRuntimeService.stopAnalysis(engine)` |
| --- |
| no runtime: return |
| `_beginAnalysisOperation(runtime)` |
| queued: `analysisNeedsStop` and a process: `_assertProcessOpen(engine, runtime)`; `_runAnalysisClientWork(runtime, () => EngineClient.stopAnalysis(engine))` |
| `analysisNeedsStop = false`; availability `Ready` with a process, otherwise `Unavailable` |

| `UciEngineClientBase.stopAnalysis(engine)` |
| --- |
| `Ready`: return |
| require `Analysing`; `_stopSearch(engine, session)` |

| `UciEngineClientBase._stopSearch(engine, session)` |
| --- |
| require `Analysing` or `Pondering` |
| `session.current = { StoppingSearch, completion }` |
| `_writeCommand(process, 'stop')` |
| await the completion, resolved by the terminating `bestmove`, which is discarded |

A position change or Refresh supersedes the running operation and restarts the search through `UciEngineClientBase.startAnalysis`, which stops the old search first. Board-edit entry stops analysis; effective edits clear results without starting; leaving board edit restarts. Removing a seat or replacing it at setup calls `stopEngine` ([stop, restart and failure](#stop-restart-and-failure)) after the game has detached its subscription.

## Player Turn Runtime

The game-level turn owner (`Deferred`, handler and `AbortController` on `game.$`) is described in [GameplayAndControl](GameplayAndControl.md#live-player-turn-request-and-engine-moves). For an Engine seat, `GamePlayerTurnComposable._requestEngineMove` calls `EngineRuntimeService.ensureReady(engine, signal)` and then the flow below; its callback checks the same signal before `attemptPlayerMove`.

### Normal Engine Search

| `EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove, signal?)` |
| --- |
| aborted: return |
| `searchedPosition = game.$.livePosition`; missing: throw |
| `_runInitialisedEngineOperation(engine, Running, () => EngineClient.startPlayerTurn(engine, game))` |
| aborted: return |
| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| failure after abort: return; otherwise rethrow |
| ponder move, ongoing game and `_canPonder(searchedPosition, move, ponderMove)`: `EngineRuntimeService.startPondering(engine, game, move, ponderMove)` *(background; its failure is ignored here)* |
| aborted: return |
| `attemptPlayerMove(move)` |
| await the pondering start |

| `EngineRuntimeService._runInitialisedEngineOperation(engine, availability, operation)` |
| --- |
| `_assertBaseRuntime(engine)` |
| `_runEngineOperation(runtime, availability, action)` |
| action: `_assertProcessOpen(engine, runtime)`; `operation()` |
| `InvalidProcessHandle`: `_initialiseEngine(engine, runtime)`; retry `operation()` once |

| `UciEngineClientBase.startPlayerTurn(engine, game)` |
| --- |
| `_requireInitialisedSession(engine)` |
| `Pondering` and the latest live move is the expected move (a hit): keep `Pondering` |
| `Pondering` and a miss: `_stopSearch(engine, session)`; `_prepareGameBoundaryIfNewGame(...)` |
| otherwise: require `Ready`; `_prepareGameBoundaryIfNewGame(...)` |
| select the commands: `ponderhit` on a hit; otherwise `position ...` and `go ...` |
| `_requireLivePosition(game)` |
| `session.current = { FindingMove, position, playerMoveCompletion }` |
| `_writeSearchCommands(engine, session, commands)` |

| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| --- |
| `_runLiveEngineOperation(engine, Ready, action)`: `_assertProcessOpen` then the action |
| `EngineClient.awaitPlayerTurnMove(engine)` |
| the move must be legal from `searchedPosition`, else throw |
| `move.$.ponderMove`: it must be legal from `MoveApplicationService.genPosition(searchedPosition, [move])`, else throw |

| `UciEngineClientBase.awaitPlayerTurnMove(engine)` |
| --- |
| require `FindingMove` or `PlayerMoveReady` |
| await `playerMoveCompletion` |
| `finally`: `PlayerMoveReady` for this completion returns to `Ready` |

| `UciEngineClientBase._completePlayerMove(session, context, line)` |
| --- |
| `_parseDetailedBestMove(context.position, line)`: detailed move, with any ponder move on `move.$.ponderMove` |
| `session.current = { PlayerMoveReady, move, playerMoveCompletion }` |
| `playerMoveCompletion.resolve(move)` |

- Search commands: timed games send `wtime`/`btime` and, with an increment, `winc`/`binc`; untimed games send `go movetime` with `BuildConfig.engine.untimedMoveTimeMs` (1000 ms). Ponder commands use the same choice with `go ponder`.
- Utilities: hit detection is `isPonderHit`, command selection is `buildFindNextMoveCommands`, best-move parsing is `parseBestMoveLine` with `genDetailedMoves`, and the legality guard uses `isMoveLegal`.
- Single legality guard: `awaitPlayerTurnMove` validates the move and its ponder continuation against the captured search position for every client. The detached ponder position is a simulation copy so the captured live position is not changed before the attempt. Neither the client nor the store repeats the check.
- While `FindingMove`, only `bestmove` completes the turn; each completion belongs to its state, so a stop result cannot satisfy a player turn.

### Ponder Search And Next Turn

| `EngineRuntimeService.startPondering(engine, game, engineMove, ponderMove)` |
| --- |
| `_runInitialisedEngineOperation(engine, Ready, () => EngineClient.startPondering(engine, game, engineMove, ponderMove))` |

| `UciEngineClientBase.startPondering(engine, game, engineMove, ponderMove)` |
| --- |
| require `Ready` |
| `_prepareGameBoundaryIfNewGame(...)` |
| build the ponder commands from the root, the moves on `livePath` and both supplied moves, with `go ponder ...` (`buildPonderMoveCommands`) |
| `session.current = { Pondering, expectedMove: ponderMove }` |
| `_writeSearchCommands(engine, session, commands)` |

- Timing: pondering starts from the guarded engine result before `attemptPlayerMove`. **Why:** a genuine pause can hold that move uncommitted, so waiting for `livePath` to include it would delay or skip pondering; building the command from the supplied moves avoids retaining a best move that could outlive its turn. The existing pre-commit clock snapshot is used for the ponder command.
- `_canPonder` skips pondering when the predicted position after both moves has already ended, because there would be nothing to search.
- A ponder-start failure records `Failed` and `lastError` but does not reject or repeat the move attempt.
- Next turn: the `Pondering` context and its expected move decide hit or miss. A hit sends `ponderhit`; a miss stops the ponder search through `StoppingSearch`, discards its `bestmove`, applies any game boundary and sends a fresh search. Both then enter `FindingMove` the same way, so a stale ponder result can never resolve the new turn.

## Session State Machine

```text
Created -> AwaitingUciOk -> Created -> AwaitingReadyOk -> Ready
Ready -> AwaitingReadyOk -> Ready                                (ucinewgame boundary)
Ready -> Analysing -> Ready                                      (bestmove ends the search)
Ready -> Analysing -> StoppingSearch -> Ready
Ready -> FindingMove -> PlayerMoveReady -> Ready
Ready -> Pondering -> FindingMove -> PlayerMoveReady -> Ready    (ponderhit)
Ready -> Pondering -> StoppingSearch -> Ready -> FindingMove     (ponder miss)
Any active state -> Stopped or Failed
```

Analysis and ponder searches share `StoppingSearch` because their stop protocol is identical. Output is interpreted by the current state rather than by trying several parsers. `Stopped` follows `stopEngine` or a process replacement; `Failed` follows an unexpected exit, a write failure or invalid control output.

## Stop, Restart, And Failure

| `EngineRuntimeService.stopEngine(engine)` |
| --- |
| no runtime: return |
| `_queueEngineDisposal(engine, runtime, false)` |

`EngineRuntimeService.restartEngine(engine)` calls `_queueEngineDisposal(engine, _createBaseRuntime(engine), true)`; no current flow calls it.

| `EngineRuntimeService._queueEngineDisposal(engine, runtime, restart)` |
| --- |
| `_beginAnalysisOperation(runtime)` |
| capture `analysisCallback`, `analysisWork` and `analysisClientWork` |
| next microtask, client work in flight and the disposal not superseded: `_stopEngineProcess(engine, runtime)` |
| `runtime.analysisWork = Promise.all([previousWork, clientWork, interruption])` |
| restart: availability `Starting` |
| `_queueAnalysisOperation(runtime, operation, action)` |
| stop action: `_stopEngineProcess(engine, runtime)`; `throwIfAborted`; `Unavailable`; clear the captured callback if it is still registered |
| restart action: `_restartEngineProcess(engine, runtime, signal)`: `_stopEngineProcess`, then `EngineRuntimeService.ensureReady(engine, signal)` |

| `EngineRuntimeService._stopEngineProcess(engine, runtime)` |
| --- |
| `analysisShutdownWork` exists: return it |
| `_releaseEngineProcess(engine, runtime)`, stored as `analysisShutdownWork` and cleared in `finally` |

| `EngineRuntimeService._releaseEngineProcess(engine, runtime)` |
| --- |
| capture `process` |
| process present: `processManager.stopProcess(process)`; `InvalidProcessHandle` is tolerated |
| process present: `_stopClientSession(engine)` -> `EngineClient.stopEngine(engine)`; `InvalidProcessHandle` is tolerated |
| `runtime.process = undefined` |
| `_clearAnalysisState(runtime)` |

| `NwjsProcessManager.stopProcess(process)` (`Uci` configuration) |
| --- |
| not open: return |
| `process.once('exit', _finish)` |
| `process.kill()`; `false` or a throw: `_finish()` |

| `WorkerProcessManagerBase.stopProcess(process)` |
| --- |
| not an open `BrowserWorkerProcess`: return |
| `process.once('exit', resolve)` |
| `process.kill()` |

| `BrowserWorkerProcess.kill()` |
| --- |
| closed: return `false` |
| `BrowserWorkerProcess._close('Engine worker terminated.')` |

| `BrowserWorkerProcess._close(detail)` |
| --- |
| mark closed; store `exitDetail` |
| remove the Worker `message`, `error` and `messageerror` handlers |
| `worker.terminate()`, which also revokes its Blob URLs |
| notify each exit listener once with `(null, null)` |
| clear data listeners and the input buffer |

| `UciEngineClientBase.stopEngine(engine)` |
| --- |
| no process reference: throw `InvalidProcessHandle` |
| session present: `_stopUciSession(session)` |

| `UciEngineClientBase._terminateUciSession(session, terminalContext, error)` |
| --- |
| `_rejectContextCompletion(session.current, error)` |
| `session.current = terminalContext`; clear game id, root FEN and options |
| `session.detachProcessListeners()`; clear `session.process` |

#### Unexpected Exit
| `UciEngineClientBase._attachToProcess: onExit` |
| --- |
| `Stopped`: return |
| `_failUciSession(session, UnexpectedExit error with _getProcessExitDetail(process))` |

A Worker reaches this through `BrowserWorkerProcess._close` from its `error` or `messageerror` handler or a failed `postMessage`; the closure keeps the diagnostic in `exitDetail`. Session detach removes only the client's own listeners and never terminates the Worker or removes the manager's disposal listener.

- Stop order: the physical stop comes first, then client cleanup, then the runtime reference is cleared. **Why:** keeping the session until the process is gone means a failed kill leaves a retryable resource with its waits intact. Client `stopEngine` requires only the reference, not a live process, so it can clean up after an exit. A physical-stop failure other than `InvalidProcessHandle` propagates and keeps the reference.
- Interruption: if a client call is blocked on a hung engine (`uciok`, `readyok` or a stop's `bestmove`), disposal kills the process immediately instead of queuing behind it. **Why:** only the process exit can release that wait; without it the serial queue would never drain. A disposal superseded before the microtask runs issues no kill.
- Shared shutdown: concurrent terminal requests share `analysisShutdownWork` instead of killing twice.
- Recovery: an exited process is found by the next operation. `_initialiseEngine` respawns after `InvalidProcessHandle`, and `_runInitialisedEngineOperation` retries a player-turn or ponder start once after re-initialising. A missing runtime or session is an error, not something repaired lazily.
- Failure routing: analysis failures reject the operation through `_failAnalysisOperation`, set `Failed` and `lastError`, and are logged by the game composable unless they are `Aborted`. Player-turn failures reject the game turn; the handler logs them and schedules the 500 ms retry. `Aborted` never retries. Pondering failure leaves the accepted or held move alone.
- Exits while idle are not published by themselves; availability changes when the next operation fails or recovers.

## Platform Disposal

| `NwjsPlatformService: _close` (native window `close` listener) |
| --- |
| already closing: return |
| `triggerAppCloseRequested()`: close registrations, including the autosave-on-close callback |
| `_disposeProcessManagers()` |
| `nw.App.quit()`, or `nativeWindow.close(true)` without `nw.App` |

| `NwjsPlatformService._dispose()` (store scope disposal) |
| --- |
| run window listener cleanups |
| `reset()` |
| `_disposeProcessManagers()` |

| `NwjsPlatformService._disposeProcessManagers()` |
| --- |
| `Promise.allSettled([processManager.dispose(), workerProcessManager.dispose()])` |

| `NwjsProcessManager.dispose()` |
| --- |
| `_disposed = true` |
| `_disposeWork ??= _disposeProcesses()` |

| `NwjsProcessManager._disposeProcesses()` |
| --- |
| `NwjsProcessManager.stopProcess(process)` for each process in `_nativeProcesses` |
| `WorkerProcessManagerBase.dispose()` |
| await all with `Promise.allSettled` |

| `WorkerProcessManagerBase.dispose()` |
| --- |
| `_lifetime.abort(ProcessStartFailed)`: cancels pending loads and rejects later spawns |
| `process.kill()` for a snapshot of `_processes` |

| `BrowserPlatformService` scope disposal |
| --- |
| remove the `pagehide`, `focus`, `visibilitychange` and theme listeners |
| `browserProcessManager.dispose()`, logging a rejection |
| `reset()` |

| `GamesStore` `onScopeDispose` callback |
| --- |
| each game: `GamePremoveComposable.clearPremoves(game)` |
| `GameTurnRuntimeComposable.clearPlayerTurnRuntime(game)`, `GameAnalysisComposable.disposeAnalysisForGame(game)` and `EngineRuntimeService.stopEngine` for each engine player, logged together on failure |
| `game.$.focusReturnUnsubscribe?.()` |

- Desktop close order: close callbacks (autosave) run first, then every engine process is stopped and awaited, then the app quits. **Why:** native engines are separate operating-system processes that are not guaranteed to exit with the window, and Vue/Pinia do not await scope-disposal callbacks, so relying on store disposal alone could quit before the kills finish. The rejected alternative, fire-and-forget disposal at scope end, left engines running after close.
- Idempotent disposal: `_disposeWork` and the lifetime signal make repeated disposal share one result. A spawn that completes after disposal is rejected: a native child was already in `_nativeProcesses` and is stopped with the rest, and a late Worker is terminated by `spawnProcess` before any process is returned. The disposal sets track only processes still alive; each process's own exit listener removes it, so a stopped engine is never killed twice and no set is consulted to find a process.
