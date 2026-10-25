# Contract-Aware Utility Index

## Purpose
Define shared private utilities that touch committed contract models.

These utilities behave like imported library code:

- they are private implementation only
- they are not public architecture modules
- they do not own scenarios
- they do not appear directly in process-flow docs
- they are visible only through the owner-private functions that delegate to them

If a helper does not touch committed contract models, it does not need to be designed here.

## Entry Format
Each entry must define:

- utility name
- purpose
- touched contract models
- allowed importers
- owner-private delegates
- purity or side-effect classification
- validation or failure semantics

## Session And Routing
### SessionNavigationUtility
- Purpose: share baseline route coercion, open-tab filtering, and fallback selection for persisted session state and routed navigation.
- Touched contract models: `IGameSessionSnapshot`, committed route map, `activeGameId`, `openGameIds`.
- Allowed importers: `UiStateStore`, `Router`.
- Owner-private delegates:
  - `UiStateStore._coerceOpenTabs`
  - `UiStateStore._coerceActiveRoute`
  - `Router._resolveStartupTarget`
  - `Router._restoreReturnRoute`
  - `Router._validateGameRoute`
  - `Router._selectFallbackRoute`
- Classification: `pure`.
- Validation or failure semantics: invalid or stale route targets are coerced to the nearest committed fallback without mutating persisted settings or workspace payloads.

## Persistence And Saved Documents
- Managed-save enumeration and latest-save target selection remain owner-private helpers inside `SavedGamesStore` and `RecentGameStore`, while duplicate-id repair and workspace hydration remain owner-private helpers inside `GamesStore`.
- Direct `SerializationService.readGameDocument(...)` and `SerializationService.writeGameDocument(...)` calls do not need a contract-aware utility wrapper when the wrapper adds no shared behaviour beyond pass-through.

## Async Coordination
### Deferred
- Purpose: expose one promise identity that may be settled by an external caller or by an optional provider promise supplied at construction. **Why:** a raw `Promise` cannot be settled by board submission or protocol output owned elsewhere, while separate provider and UI promises could each run their own handler and race to commit.
- Location: `src/utility/async/Deferred.ts`.
- Touched contract models: `IGameRuntime.pendingPlayerTurnPromise`; concrete engine clients also use it for private protocol waits.
- Allowed importers: state, domain, and platform owners that need an explicitly settleable one-shot completion boundary.
- Classification: `runtime coordination`.
- Settlement is idempotent through native `Promise` semantics. Following a provider promise and calling `resolve(...)` or `reject(...)` externally race to settle the same completion rather than creating competing promises; chained operations return ordinary `Promise` values through `Symbol.species`.
- A `Deferred` has one workflow owner. Intentional cancellation rejects it before the owner clears its runtime reference. **Why:** merely dropping the reference would leave an abandoned waiter unresolved and hide the cancellation from its handler.
- `Deferred` is a one-shot primitive, not a turn model or queue. **Why:** premoves and multiple future inputs require ordering, intended-position validation, and cancellation semantics that one-shot settlement cannot express; stacking `Deferred` instances would create competing current-turn owners rather than a queue.

## Error Handling
### StandardErrorHandlingUtility
- Purpose: share normalisation of runtime and platform exceptions into logging plus caller-owned user-facing error presentation policy.
- Location: `src/utility/errors/StandardErrorHandlingUtility.ts`.
- Touched contract models: `IPlatformError` and the shared runtime-error presentation payload owned by the handling path.
- Allowed importers: `EngineRuntimeService`, `EnginesStore`, `GamesStore`, `SerializationService`, `UiStateStore`, `UserSettingService`.
- Owner-private delegates:
  - `EngineRuntimeService._handleRuntimeError`
  - `EnginesStore._handlePlayerTurnRuntimeError`
  - `logHandledError`
  - `SerializationService._handlePlatformError`
  - `UiStateStore._handlePersistenceError`
  - `UserSettingService._handlePlatformError`
- Classification: `mixed`.
- Validation or failure semantics: every handled error is logged. The owning caller decides whether the error remains local state such as an analysis-engine unavailable row or is escalated into a user-facing runtime dialog. Blocking runtime dialogs may be rendered through `RuntimeErrorDialogMountUtility`, a private presentation-only helper that mounts a dedicated Vue app inside the shared dialog shell without adding a new public modal contract.

## Store-Private Contract Helpers
- Theme projection, session-route coercion, engine-position mapping, and workspace hydration remain owner-private helpers inside their stores or services unless they become genuinely shared across multiple owners with meaningful behaviour beyond local composition.

## Chess Structure Support
### Movement Candidates
- `GameRuleUtility.genCandidateMovesForPiece(position, from)` returns raw piece-colour movement candidates independent of actual turn, pins, check and attacks. Geometry/blockers, friendly destinations, opposing king capture, pawn direction/start rank/promotion choices and castling rights/rook/path remain chess-rule concerns. Empty pawn diagonals are possible future captures.
- It is a pure chess-data query shared by board input and changed-board FIFO revalidation. It owns no queue, UI, projection or turn API. Actual due legality remains in existing `genLegalMovesForPiece` and canonical details in `toDetailedMove`.

### Lazy Derived-Cache Contract
- `GameRuleUtility.getCheckState(...)` and `isStandardInitialPosition(...)` may initialise `IBoardPosition.$`; `MoveNotationUtility.buildFen(...)`, `getSan(...)`, and `getUci(...)` may initialise position or move `$` metadata.
- These functions are deterministic query APIs with read-through runtime caches. Callers may treat the returned domain value as a read, but contracts and reviews must account for the local `$` write.
- The cache is colocated with each utility derivation because utilities cannot fetch through a same-layer service without violating the layer model. Centralising it also avoids repeated calculation and prevents protocol, presentation, and rule callers from implementing separate lookup caches.
- Cached values are never persisted. Any effective position mutation clears the position runtime metadata before another query, while persisted move facts are immutable after a move enters history, so SAN and UCI remain valid for that move.

### GameRuleUtility
- Purpose: own pure chess-rule queries, detailed-move generation, initial-position handling, and board-rule game-result resolution.
- Location: `src/utility/chess/GameRuleUtility.ts`.
- Touched contract models: `IBoardPosition`, `IMoveRaw`, `IMove`, `CheckState`, `ResultState`, and `ResultReason`.
- Allowed importers: owning domain services, focused state composables for rule queries/setup, concrete engine clients, notation consumers, and chess-rule tests.
- Classification: `deterministic read-through cache`; queries do not change persisted chess state but may populate derived values under `IBoardPosition.$`.
- Validation or failure semantics: `isMoveLegal(...)` matches against fully legal moves, including the current check constraint and the absence of any move from checkmate, rather than checking piece movement alone. **Why:** pseudo-legal validation would admit moves that leave the king attacked and could let play continue from a terminal chess position. Illegal raw moves and unresolved promotions throw before detailed-move generation. Copied-position simulation is used for legality, check state, and move-sequence enrichment. Low-level `applyMove` and clone mechanics are consumed through `MoveApplicationService` by app workflows; stores must not bypass that service boundary merely because the utility exports those mechanics for domain composition and focused tests.

### MoveNotationUtility
- Purpose: lazily format SAN from detailed move facts and UCI from raw move coordinates.
- Location: `src/utility/chess/MoveNotationUtility.ts`.
- Touched contract models: `IMoveRaw`, `IMove`, and `IMoveRuntime`.
- Allowed importers: stores, UCI protocol utilities, presentation readers, and notation tests.
- Classification: `deterministic read-through cache`; notation queries may populate `IMoveRaw.$` so repeated consumers reuse the derived string.
- Validation or failure semantics: SAN accepts detailed moves only; UCI accepts the protocol-neutral raw shape inherited by detailed moves.

### ChessBoardUtility
- Purpose: share public board-structure helpers used by domain services and tests without exposing a `domain/internal` module surface.
- Touched contract models: `IBoardPosition`, `ICastlingAvailability`, `IChessPiece`, `BoardId`, `PlayerColour`.
- Allowed importers: chess utilities, domain services, stores, domain tests, and platform tests.
- Owner-private delegates:
  - `GameRuleUtility._findKingBoardId`
  - `GameRuleUtility._getOpponentColour`
- Classification: `pure`.
- Validation or failure semantics: helpers preserve shared structural board concerns only. They do not invent missing pieces, infer legality, or clone caller-owned board arrays unless the owning service explicitly needs that behaviour.

### ChessSquareUtility
- Purpose: share board-index, coordinate, notation, and pawn-direction helpers used by chess-rule and notation code without exposing a `domain/internal` module surface.
- Touched contract models: `BoardId`, `PlayerColour`.
- Allowed importers: chess utilities, domain services, stores, domain tests, and platform tests.
- Owner-private delegates:
  - `GameRuleUtility._boardIdToCoords`
  - `GameRuleUtility._coordsToBoardId`
  - `GameRuleUtility._getForwardDirection`
  - `MoveNotationUtility._boardIdToNotation`
- Classification: `pure`.
- Validation or failure semantics: helpers perform only structural coordinate conversion and deterministic notation mapping. Out-of-range coordinates return `undefined` rather than coercing to a board id.

## Platform Host Support
### UciUtility
- Purpose: generate UCI protocol commands and parse UCI protocol output into shared engine, analysis, board, and move contracts.
- Location: `src/utility/UciUtility.ts`.
- Command-builder surface: `buildAnalysisCommands`, `buildDebugCommand`, `buildFindNextMoveCommands`, `buildIsReadyCommand`, `buildPonderMoveCommands`, `buildPositionCommand`, `buildQuitCommand`, `buildRegisterCommand`, `buildSetOptionCommand`, `buildStopCommand`, `buildUciCommand`, `buildUciMove`, and `buildUciNewGameCommand`.
- Search-context predicate: `isPonderHit(game, expectedPonderMove)` shares the exact move-match rule used by `buildFindNextMoveCommands(...)` so the client can select state before sending the builder's contextual result.
- Touched contract models: `IEngineOptionMeta`, `IAnalysisLine`, `IBoardPosition`, `IGame`, and `IMove`.
- Allowed importers: concrete UCI engine clients and utility tests.
- Owner-private delegates: inherited native and browser UCI handshake, game-boundary, state-transition, analysis-line and best-move handlers.
- Classification: `mixed`; command construction and parsing are deterministic, while `buildUciMove(...)` may populate the runtime-only `IMove.$.uci` cache.
- Validation or failure semantics: invalid highlighted or live paths, missing timed clocks, malformed UCI moves or option declarations, and unsupported option types throw rather than creating partial protocol data. Standard initial roots emit `position startpos`; one-time verification is cached under `IBoardPosition.$.isStandardInitialPosition`, while custom roots emit full FEN. `buildFindNextMoveCommands(...)` retains its contextual contract: a matching ponder returns `ponderhit`, a mismatch returns `stop`, and a normal request returns the current position plus a timed `go` or bounded untimed `go movetime 1000` (`BuildConfig.engine.untimedMoveTimeMs`). The client selects hit or miss independently, and a miss awaits its own stop boundary before rebuilding normal commands from the current game.

### BrowserWorkerProcess
- Purpose: adapt a dedicated Worker resource to the existing Node-free IProcess input/output/exit subset.
- Location: src/utility/BrowserWorkerProcess.ts.
- Touched contract models: IProcess, IProcessInput, IProcessOutput and IPlatformError.
- Allowed importers: BrowserProcessManager and the browser UCI client, plus focused tests; no platform-barrel export.
- Owner-private delegates: manager spawn/validity/stop/disposal and the client liveness/exit-detail hooks and inherited process I/O.
- Classification: resource-owning implementation support; it is not a service or architecture flow owner.
- Validation or failure semantics: the constructor takes only the Worker. Buffer incomplete input; post complete command lines; preserve string message boundaries as stdout chunks. Closure is one-shot, records closed/exitDetail, detaches handlers, terminates the Worker and emits exit(null, null) without replay. Worker errors and failed postMessage retain existing diagnostics. Managed closure is not a physical Worker-exit acknowledgement. The manager owns its disposal-set removal through its own exit listener.

### NwjsUtility
- Purpose: share typed NW.js host access and native process liveness for the independent native manager/client implementations.
- Touched contract models: PlatformTarget and IProcess through the native ISpawnedProcess refinement, kept private to host implementations.
- Allowed importers: platform bootstrap and NW.js implementations, plus the app shell for resolved host styling.
- Owner-private delegates:
  - `PlatformService` bootstrap
  - `NwjsProcessManager` native liveness checks
  - `NwjsUciEngineClient._isProcessOpen` native liveness hook
- Classification: `mixed`.
- Validation or failure semantics: the utility must return one shared typed `nw` object for the active build target, allow explicit test or bootstrap override, and fall back to the cached mock host when real NW.js bindings are unavailable. `getNwjs()` throws when the resolved target is not `PlatformTarget.Nwjs`, before resolving overrides, real bindings or fallback mocks. The `PlatformTarget` enum represents resolved targets. Automatic selection ignores the mock fallback and uses the browser platform when no real or explicitly injected NW.js runtime exists. `PlatformService` resolves that shared instance once, and the concrete NW.js store definitions receive it through injected parameters rather than resolving host globals independently.

The native manager owns UTF-8 configuration. The inherited UCI base owns string line framing, listener detachment and command writes; the unused native copies of those helpers are removed. NwjsUtility keeps host lookup and exitCode/signalCode liveness checking only, without process lifecycle ownership or a registry.

### NodeUtility
- Purpose: share access to Node modules exposed through the NW.js host and the temporary mock-module fallback required before the real desktop bootstrap is present.
- Touched contract models: none directly; supports platform-owned file-system and process implementations without adding Node-module concerns to the public platform contract.
- Allowed importers: `NwjsStorageAdapter`, `NwjsProcessManager`.
- Owner-private delegates:
  - `NwjsStorageAdapter._resolveFs`
  - `NwjsStorageAdapter._resolvePath`
  - `NwjsProcessManager._resolveChildProcess`
- Classification: `mixed`.
- Validation or failure semantics: the utility must resolve each required Node-backed dependency separately from the active NW.js host when available, and fall back to temporary mock implementations only when the real NW.js-exposed Node environment is unavailable.

## WorkerScriptLoader

WorkerScriptLoader is self-contained support for executing stored JavaScript with neighbouring scripts and binary assets. It accepts database/store/root configuration and imports no application configuration, contracts, services, stores or platform implementations. It keeps the original IndexedDB schema and original script/asset bytes.

createWorker reads a stored package atomically, creates correctly typed Blob resources, supplies an entry/asset-map bootstrap and returns a normal Worker. The bootstrap resolves importScripts, fetch (strings, URLs and Requests) and XHR within that dedicated Worker. It installs no application-global listener. Ordinary app URLs use the native Worker directly; desktop file entries use the same bootstrap with original file URLs.

The returned Worker owns its bootstrap/asset URLs and revokes them through normal terminate. Constructor failure releases allocated URLs. The class keeps no process/registration registry, readiness cache or shared execution resource. There is no separate server, service-worker entry, build plugin or loader disposal operation. Nested Worker and module-worker loading are not added.

EnginePackageService retains a storage-only instance; each process manager owns a separate loader and the process wrapper it creates from the returned Worker. Engine names and profile/game checks stay with their existing owners. Generic non-UCI execution, storage rollback/cancellation, resource ownership and original bytes are verified in e2e/browser/WorkerScriptLoader.spec.ts. Detailed implementation: [installation plan](../../EngineInstallationReworkPlan.md#reusable-stored-file-worker-library).
