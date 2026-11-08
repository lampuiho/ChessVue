# Contract-Aware Utility Index

## Purpose
Define shared private utilities in `src/utility` that touch committed contract models.

These utilities behave like imported library code:

- they are private implementation only
- they are not public architecture modules
- they do not own scenarios
- they do not appear directly in process-flow docs
- they are visible only through the owners that import them

If a helper does not touch committed contract models, it does not need to be designed here.

## Entry Format
Each entry defines:

- utility name and location
- purpose
- touched contract models
- importers
- purity or side-effect classification
- validation or failure semantics

## Persistence And Saved Documents
- Managed-save enumeration and latest-save selection are layer-2 calls: `SerializationService.listManagedSaveEntries(...)` with `SavedGameIndexService.projectSaveGroups(...)` and `getLatestSaveEntry...(...)`. Duplicate-id repair and workspace hydration remain private to `GamesStore` composables.
- Session-route coercion (`_coerceActiveRoute`, `_validateGameRoute`, `_selectFallbackRoute`, `_coerceGameSessionSnapshot`) remains private to `UiStateStore`; there is no shared session-navigation utility.
- Direct `SerializationService.readGameDocument(...)` and `writeGameDocument(...)` calls do not need a utility wrapper when the wrapper would add no shared behaviour beyond pass-through.

## Timestamps
### UtcTimestamp subclasses
- Location: `src/utility/date/` (`UtcTimestamp`, `RecordTimestamp`, `ClockTimestamp`, `AnalysisTimestamp`, `SaveTimestamp`, `RegistrationTimestamp`).
- Purpose: purpose-specific `Date` subclasses that serialise to ISO 8601 through `toJSON()` and each own their display format through `toString()`.
- Touched contract models: every persisted or runtime UTC instant, including clock snapshots, game metadata, analysis records, saved-file entries and platform event registrations.
- Importers: contracts and their schemas, domain services, stores, platform adapters and views that create or display instants.
- Classification: value types.
- Semantics: the convention and its rationale are owned by the [DataInterface UTC timestamp convention](DataInterface/index.md#utc-timestamp-convention).

## Async Coordination
### Deferred
- Location: `src/utility/async/Deferred.ts`.
- Purpose: expose one promise identity that may be settled by an external caller or by an optional provider promise supplied at construction. **Why:** a raw `Promise` cannot be settled by board submission or protocol output owned elsewhere, while separate provider and UI promises could each run their own handler and race to commit.
- Touched contract models: `IGameRuntime.pendingPlayerTurnPromise` and `IEngineAnalysisOperation.completion`; `UciEngineClientBase` also uses it for private protocol-state completions.
- Importers: `GamePlayerTurnComposable`, `EngineRuntimeService`, `UciEngineClientBase`, and the contracts that type those fields.
- Classification: runtime coordination.
- Settlement is idempotent through native `Promise` semantics. Following a provider promise and calling `resolve(...)` or `reject(...)` externally race to settle the same completion rather than creating competing promises; chained operations return ordinary `Promise` values through `Symbol.species`.
- A `Deferred` has one workflow owner. Intentional cancellation rejects it before the owner clears its runtime reference. **Why:** merely dropping the reference would leave an abandoned waiter unresolved and hide the cancellation from its handler.
- `Deferred` is a one-shot primitive, not a turn model or queue. **Why:** premoves and multiple future inputs require ordering, intended-position validation and cancellation semantics that one-shot settlement cannot express; stacking `Deferred` instances would create competing current-turn owners rather than a queue.

### OperationOwner
- Location: `src/utility/async/OperationOwner.ts`.
- Purpose: own one replaceable unit of asynchronous UI work. `run(action)` aborts the current action's signal, waits for its settlement, then runs the replacement with a fresh `AbortSignal`; `cancel()` aborts and returns the settlement; `dispose()` cancels and makes later runs start already aborted.
- Touched contract models: none directly; it guards work that produces games, saved-game details and engine archives.
- Importers: `GameView` (analysis-line playback), `SavedGamesView` (saved-game details), `EnginePackageImportView` (archive reading) and `useQuickGame`.
- Classification: runtime coordination.
- Semantics: real failures propagate to the caller of `run`; failures after the owner's own abort are treated as cancellation and settle internally. **Why:** superseded async work must be cancelled and settled at its owner's action or lifecycle boundary, without generation, epoch or sequence counters that only hide stale results. See [CodeCleanupPlan](../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions).

### Abortable
- Location: `src/utility/async/Abortable.ts`.
- Purpose: `abortable(work, signal)` stops delivery of an uncancellable promise when the signal aborts while still observing its eventual success or rejection; `abortableDelay(ms, signal)` is a delay whose timer is cleared on abort.
- Touched contract models: none directly.
- Importers: `GameView` (playback delays), `SavedGamesView` (details reads) and `useQuickGame` (game creation).
- Classification: runtime coordination.
- Semantics: both reject with `signal.reason` on abort; `abortable` does not cancel the underlying work.

## Error Handling
### StandardErrorHandlingUtility
- Location: `src/utility/errors/StandardErrorHandlingUtility.ts`, re-exported by `src/utility/errors/index.ts`.
- Purpose: normalise runtime and platform exceptions into `IPlatformError`, log handled errors, and raise reference errors from chess utilities.
- Surface: `isPlatformError(error)`, `toPlatformError(operation, error)`, `logHandledError(scope, operation, error)` and `throwReferenceError(message)`.
- Touched contract models: `IPlatformError`.
- Importers: `EngineRuntimeService` (`isPlatformError`); `GamesStore`, `GameAnalysisComposable`, `GamePlayerTurnComposable`, `UiStateStore` and `ModalComposable` (`logHandledError`); `useModalAction` and `SavedGamesView` (`isPlatformError` for messages); `GameRuleUtility` and `SquareUtility` (`throwReferenceError`).
- Classification: `mixed`; `logHandledError` writes to the console.
- Semantics: `toPlatformError` keeps an existing platform error's kind with the new operation and maps any other value to `unexpectedExit`. Every handled error is logged. The owning caller decides whether the error remains local state, such as an analysis seat's error row, a modal or view message, or a recovery warning.

## Game Creation
### GameCreationUtility
- Location: `src/utility/GameCreationUtility.ts`.
- Purpose: share game-creation request rules between the settings defaults schema, game creation and engine-package reference checks.
- Surface: `gameClockChoices`, `selectGameClock`, `getGameClockError`, `getGameCreationError`, `copyGameRequest`, `createLocalPlayer`, `copyEngineProfile`, `createEnginePlayer` and `getGameEngineUsage`.
- Touched contract models: `ICreateGameRequest`, `ITimeControl`, `IPlayer`, `IEnginePlayer`, `IEngineRecord` and `IEnginePackageUsage`.
- Importers: the settings contract (`settingsGameDefaultsSchema` refinement), `UserSettingService` (default seats), `SettingsStore`, `useQuickGame`, `GameCreationModal`, `GameClockFields`, `GamePlayerField`, `AnalysisSnapshotFields`, `SettingsView` and `EnginePackageDetailsView`.
- Classification: `pure`.
- Semantics: validation returns a user-facing message or an empty string rather than throwing. Clocks are untimed, one of the fixed presets, or a custom 1-600 minute clock with a 0-300 second whole-second increment. A game has at most four analysis engines with unique names, and every required engine seat needs an entry path. `copyGameRequest` parses through `createGameRequestSchema`, trims the name and fills the takeback and live-analysis defaults. Engine copies take fresh option maps so later profile edits do not retarget a game.

## Chess Structure Support
`src/utility/chess/index.ts` re-exports the five modules below.

### Movement Candidates
- `GameRuleUtility.genCandidateMovesForPiece(position, from)` returns raw piece-colour movement candidates independent of actual turn, pins, check and attacks. Geometry and blockers, friendly destinations, opposing-king capture, pawn direction, start rank, promotion choices and castling rights, rook and path remain chess-rule concerns. Empty pawn diagonals are possible future captures.
- It is a pure chess-data query shared by board input (`Chessboard`, `GameView`) and changed-board FIFO revalidation (`GamePremoveComposable`). It owns no queue, UI, projection or turn API. Actual due legality remains in `genLegalMovesForPiece` and canonical details in `toDetailedMove`.

### Lazy Derived-Cache Contract
- `GameRuleUtility.getCheckState(...)` and `isStandardInitialPosition(...)` may initialise `IBoardPosition.$`; `MoveNotationUtility.buildFen(...)`, `getSan(...)` and `getUci(...)` may initialise position or move `$` metadata.
- These functions are deterministic query APIs with read-through runtime caches. Callers may treat the returned domain value as a read, but contracts and reviews must account for the local `$` write.
- The cache is colocated with each utility derivation because utilities cannot fetch through a same-layer service without violating the layer model. Centralising it also avoids repeated calculation and prevents protocol, presentation and rule callers from implementing separate lookup caches.
- Cached values are never persisted. Every position mutation clears the position's runtime metadata (`GameRuleUtility.applyMove` and the `MoveApplicationService` board edits) before another query, while persisted move facts are immutable after a move enters history, so SAN and UCI remain valid for that move.

### GameRuleUtility
- Location: `src/utility/chess/GameRuleUtility.ts`.
- Purpose: own pure chess-rule queries, detailed-move generation, initial-position handling and board-rule game-result resolution, plus the low-level `applyMove` and `cloneBoardPosition` mechanics.
- Touched contract models: `IBoardPosition`, `IMoveRaw`, `IMoveCandidate`, `IMove`, `CheckState`, `ResultState` and `ResultReason`.
- Importers: `MoveApplicationService` (mutation mechanics); `EngineRuntimeService`, `UciEngineClientBase` and `UciUtility` (legality, detailed moves, detached clones, standard-root detection); `GamesStore` composables (legal and candidate moves, detailed moves, results, initial positions); and presentation (`Chessboard` and `GameView` for input candidates and preview legality).
- Classification: `deterministic read-through cache`; queries do not change persisted chess state but may populate derived values under `IBoardPosition.$`.
- Validation or failure semantics: `isMoveLegal(...)` matches against fully legal moves, including the current check constraint and the absence of any move from checkmate, rather than checking piece movement alone. **Why:** pseudo-legal validation would admit moves that leave the king attacked and could let play continue from a terminal position. Illegal raw moves and unresolved promotions throw before detailed-move generation. Copied-position simulation is used for legality, check state and move-sequence enrichment. Application workflows consume `applyMove` and clone mechanics through `MoveApplicationService`; stores must not bypass that boundary merely because the utility exports them. `UciEngineClientBase` uses `cloneBoardPosition` directly because layer 1 cannot call a layer-2 service.

### MoveNotationUtility
- Location: `src/utility/chess/MoveNotationUtility.ts`.
- Purpose: lazily format FEN from positions, SAN from detailed move facts and UCI from raw move coordinates; `getPieceLetter` shares the piece letters.
- Touched contract models: `IBoardPosition`, `IMoveRaw`, `IMove` and `IMoveRuntime`.
- Importers: `UciUtility`, `UciEngineClientBase`, `AnalysisPanel` and `HistoryPanel` (`getSan`), and `GameView` (`buildFen`).
- Classification: `deterministic read-through cache`; queries may populate `IBoardPosition.$.fen`, `IMoveRaw.$.san` or `IMoveRaw.$.uci`.
- Validation or failure semantics: SAN accepts detailed moves only; UCI accepts the protocol-neutral raw shape inherited by detailed moves.

### BoardUtility
- Location: `src/utility/chess/BoardUtility.ts`.
- Purpose: share board-structure helpers: `getOpponentColour`, `findKingBoardId` and `createSparseBoard`.
- Touched contract models: `IBoardPosition`, `IChessPiece`, `BoardId` and `PlayerColour`.
- Importers: `GameRuleUtility`, `GameClockComposable`, `GameStatusComposable`, `GameView`, `SavedGamesView` (sparse preview boards) and journey fixture builders.
- Classification: `pure`.
- Validation or failure semantics: helpers preserve structural board concerns only. They do not invent missing pieces or infer legality. `createSparseBoard` creates a fresh 64-square board with no castling rights.

### SquareUtility
- Location: `src/utility/chess/SquareUtility.ts`.
- Purpose: share board-index, coordinate and pawn-direction helpers: `isBoardId`, `boardIdToCoords`, `tryCoordsToBoardId`, `coordsToBoardId`, `getForwardDirection`, `getPawnHomeRank` and `getPromotionRank`.
- Touched contract models: `BoardId` and `PlayerColour`.
- Importers: `GameRuleUtility`, `MoveNotationUtility`, `UciUtility` and `GamePositionComposable`.
- Classification: `pure`.
- Validation or failure semantics: `tryCoordsToBoardId` returns `undefined` for out-of-range coordinates; `coordsToBoardId` throws a `ReferenceError` instead of coercing to a board id.

### PositionIdentityUtility
- Location: `src/utility/chess/PositionIdentityUtility.ts`.
- Purpose: build the structural position key exposed by [PositionIdentityService](DomainLogic/PositionIdentityService.md).
- Touched contract models: `IBoardPosition`.
- Importers: `PositionIdentityService` only.
- Classification: `pure`.

## Platform Host Support
### UciUtility
- Location: `src/utility/UciUtility.ts`.
- Purpose: generate UCI protocol commands and parse UCI output into shared engine, analysis, board and move contracts.
- Command-builder surface: `buildAnalysisCommands`, `buildDebugCommand`, `buildFindNextMoveCommands`, `buildIsReadyCommand`, `buildPonderMoveCommands`, `buildPositionCommand`, `buildQuitCommand`, `buildRegisterCommand`, `buildSetOptionCommand`, `buildStopCommand`, `buildUciCommand`, `buildUciMove` and `buildUciNewGameCommand`.
- Parser surface: `parseBestMoveLine`, `parseInfoLine`, `parseOptionLines` and `parseUciMove`, returning `IUciBestMove` and `IUciAnalysisLine` raw shapes; `boardIdToNotation` formats squares.
- Search-context predicate: `isPonderHit(game, expectedPonderMove)` shares the exact move-match rule used by `buildFindNextMoveCommands(...)` so the client can select its state before sending the builder's contextual result.
- Touched contract models: `IEngineOptionMeta`, `IBoardPosition`, `IGame` and `IMoveRaw`.
- Importers: `UciEngineClientBase` only, plus utility tests.
- Classification: `mixed`; command construction and parsing are deterministic, while `buildUciMove(...)` may populate the runtime-only `IMoveRaw.$.uci` cache.
- Validation or failure semantics: invalid rendered or live paths, missing timed clocks, malformed UCI moves or option declarations, and unsupported option types throw rather than creating partial protocol data. `bestmove (none)` parses to no move. Standard initial roots emit `position startpos`, with one-time verification cached under `IBoardPosition.$.isStandardInitialPosition`; custom roots emit full FEN. `buildFindNextMoveCommands(...)` keeps its contextual contract: a matching ponder returns `ponderhit`, a mismatch returns `stop`, and a normal request returns the current position plus a timed `go` or a bounded untimed `go movetime` (`BuildConfig.engine.untimedMoveTimeMs`). The client selects hit or miss independently, and a miss awaits its own stop boundary before rebuilding normal commands from the current game.

### BrowserWorkerProcess
- Location: `src/utility/BrowserWorkerProcess.ts`.
- Purpose: adapt one dedicated Worker to the Node-free `IProcess` input, output and exit subset.
- Touched contract models: `IProcess`, `IProcessInput`, `IProcessOutput` and `IPlatformError`.
- Importers: `WorkerProcessManagerBase` (and through it `BrowserProcessManager` and the desktop Worker binding) and `BrowserUciEngineClient`, plus focused tests; no platform-barrel export.
- Classification: resource-owning implementation support; it is not a service or flow owner.
- Validation or failure semantics: the constructor takes only the Worker. Detailed framing, closure and diagnostic semantics are in [ProcessManager](PlatformAbstraction/ProcessManager.md#browserworkerprocess). The manager owns removal from its disposal set through its own exit listener.

### WorkerScriptLoader
- Location: `src/utility/WorkerScriptLoader.ts`.
- Purpose: self-contained support for storing JavaScript packages and executing a stored or external entry script in a dedicated Worker with its neighbouring scripts and binary assets.
- Surface: `new WorkerScriptLoader({ databaseName, storeName, rootPath })`, `listRoots()`, `listFiles(root)`, `writeFiles(root, files, signal?)`, `removeFiles(root)`, `resolveUrl(entryPath, appBaseUrl)`, `isStoredUrl(url, appBaseUrl)` and `createWorker(entryUrl, appBaseUrl, signal?, options?)`.
- Touched contract models: none; it accepts plain storage configuration and file records and imports no application configuration, contracts, services, stores or platform implementations.
- Importers: `EnginePackageService` (a storage-only instance) and `WorkerProcessManagerBase` (one instance per manager), each constructed with `EnginePackageConfig`.
- Classification: resource-owning implementation support.
- Storage: files live in one IndexedDB object store keyed by `[root, relativePath]`, with original bytes. A write or removal is one atomic transaction; writes and stored-package reads honour an optional `AbortSignal` and reject with its reason, otherwise with the transaction error. Paths are validated as relative `/`-separated segments.
- Worker creation: ordinary app URLs construct a native Worker directly. A stored-package URL reads that package's files in one read-only transaction; a `file:` URL uses no storage read. Both then create typed Blob URLs for the assets, generate a bootstrap that sets the entry's original `location` and resolves `importScripts`, `fetch` (strings, URLs and Requests) and `XMLHttpRequest.open` against the asset map, and import the original entry. The bootstrap installs no application-global listener.
- Resource ownership: the returned Worker owns its Blob URLs and revokes them on `terminate()`; construction failure releases them. There is no loader-level registry, readiness cache, server, service-worker entry or disposal operation. **Why:** an earlier service-worker serving design needed registration, control waits and separate serving files; the Blob bootstrap was tested to run unchanged Stockfish/WASM and Lozza builds on an online-hosted page and inside NW.js without uploading engine files, flags or local servers. Nested and module Workers are not supported. See [EngineInstallationReworkPlan](../../ArchivedPlans/EngineInstallationReworkPlan.md#reusable-stored-file-worker-library) and [ExternalWorkerLoadingExperiments](../../ArchivedPlans/ExternalWorkerLoadingExperiments.md).
- Verification: generic non-UCI execution, storage rollback and cancellation, resource ownership and original bytes are covered by `e2e/browser/WorkerScriptLoader.spec.ts`.

### NwjsUtility
- Location: `src/utility/nwjs/NwjsUtility.ts`, with host models in `src/utility/nwjs/models/` (`INwjsGlobal`, `INwjsWindow`, `ISpawnedProcess`).
- Purpose: resolve the platform target and typed NW.js host, and check native process liveness.
- Surface: `getPlatformTarget()`, `setNwjsOverride(nw)`, `getNwjs()`, `isProcessOpen(process)` and the re-exported `PlatformTarget`.
- Touched contract models: `PlatformTarget`, and `IProcess` through the native `ISpawnedProcess` refinement kept private to host implementations.
- Importers: `PlatformService` bootstrap, the NW.js platform implementations, `EnginePackageService` (`getPlatformTarget` for its capability check) and `App.vue` (resolved target for viewport scaling).
- Classification: `mixed`.
- Validation or failure semantics: host selection is described in [PlatformServices](PlatformAbstraction/PlatformServices.md#host-selection). `getNwjs()` throws for a non-NW.js target before resolving overrides, real bindings or the cached mock host. `isProcessOpen` is a stateless check that `exitCode` and `signalCode` are both `null`. The utility has no process lifecycle ownership or registry; UCI line framing and writes belong to `UciEngineClientBase`.

### NodeUtility
- Location: `src/utility/nwjs/NodeUtility.ts`.
- Purpose: resolve the Node modules exposed by NW.js (`fs`, `path`, `child_process`, `url`) and allow explicit overrides.
- Surface: `getNodeFs()`, `getNodePath()`, `getNodeChildProcess()`, `getNodeUrl()` and `setNodeModuleOverrides(overrides?)`.
- Touched contract models: none directly; supports platform-owned file-system and process implementations without adding Node-module concerns to the public platform contract.
- Importers: `NwjsStorageAdapter`, `NwjsProcessManager` and journey bootstrap (`setNodeModuleOverrides` installs scripted engines and a journey file system).
- Classification: `mixed`.
- Validation or failure semantics: each module is resolved separately, in order: override, the host `require`, then the mock module from `NwjsMockUtility`. A `require` failure is logged and rethrown. `getNodeUrl()` has no mock and throws when unavailable.

### NwjsMockUtility
- Location: `src/utility/nwjs/NwjsMockUtility.ts`.
- Purpose: supply cached mock `nw`, `fs`, `path` and `child_process` objects so the NW.js implementation can run under an explicit `nwjs` target without an SDK, and so journeys can borrow a deterministic `path` module.
- Importers: `NwjsUtility`, `NodeUtility` and journey bootstrap.
- Classification: test and development support; never selected by automatic host detection.
