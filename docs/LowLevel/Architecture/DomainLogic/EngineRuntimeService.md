# EngineRuntimeService

## Purpose
Own the layer-2 engine runtime boundary consumed by state stores for temporary profile inspection, continuous analysis, and engine-controlled turns.

## Public Interface
```ts
ensureRuntime(engine: IAssignedEngine): IAssignedEngineRuntime
getOptions(engineProfile: IEngineRecord): Promise<readonly IEngineOptionMeta[]>
ensureReady(engine: IAssignedEngine, signal?: AbortSignal): Promise<void>
startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(engine: IAssignedEngine): Promise<void>
startPlayerTurn(engine: IAssignedEngine, game: IGame, attemptPlayerMove: (move: IMove) => Promise<void>, signal?: AbortSignal): Promise<void>
startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMove, ponderMove: IMove): Promise<void>
subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
awaitPlayerTurnMove(engine: IAssignedEngine, searchedPosition: IBoardPosition): Promise<IMove>
isRuntimeAlive(engine: IAssignedEngine): boolean
restartEngine(engine: IAssignedEngine): Promise<void>
stopEngine(engine: IAssignedEngine): Promise<void>
```

## Responsibilities
- run a temporary assigned-engine copy of a reusable profile, return copied option metadata, and close the temporary engine before the discovery call completes
- coordinate engine sessions in a game-facing shape so layer 3 consumes one runtime service instead of platform adapters
- assert that base runtime state already exists before lower-layer protocol work starts for actions that require it
- initialise, restart, and stop engine processes through `ProcessManager`
- check process-handle validity through `ProcessManager` before runtime actions that require a live engine process
- set runtime availability and runtime last error on the shared assigned-engine runtime state
- register and unregister the shared analysis callback on `engine.$`
- compose `ProcessManager` for process lifecycle and `EngineClient` for protocol conversation without layering one platform service through another
- own the complete engine-player turn from client search start through guarded result, immediate optional pondering, and the shared state-layer move attempt
- validate the common client best-move result against the captured search position and any ponder continuation against a detached position after that best move
- expose typed streamed analysis updates plus promise-shaped player-turn completion without leaking UCI or engine-communication semantics upward

## Dependencies
- `ProcessManager`
- `EngineClient`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-SESSION-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `ensureRuntime(...)` creates the base runtime without launching a process and returns the existing runtime on subsequent calls. The state layer may wrap it with shallow reactivity before engine work starts; runtime creation and process/status ownership remain in this service.
- `getOptions(...)` copies a reusable profile into a temporary `IAssignedEngine`, including its saved configured options, initialises that engine explicitly, copies the client-discovered metadata, and closes the engine in `finally`. The temporary runtime is never retained by a store or attached to a game.
- Option discovery does not populate, validate, or reconcile `IEngineRecord.options`. Saved configured values remain authoritative, while `EnginesStore` caches the returned metadata separately for profile-editor rendering.
- `GamesStore` owns runtime intent and session usage, but it reaches protocol and process behaviour only through this service. **Why:** `EngineRuntimeService` owns game-facing process state while `EngineClient` owns protocol-session state; merging them would leak protocol details upward, and allowing the two layer-1 adapters to call each other would obscure which owner mutates `engine.$`. A redesign must retain one owner for process state, one for protocol state, and an explicit composition boundary.
- `EngineRuntimeService` is a session-oriented coordinator, not a raw parser or command-builder hub.
- `EngineRuntimeService` owns process start, stop, restart, and process-handle validity checks through `ProcessManager`.
- `EngineRuntimeService` binds runtime process state directly onto `IAssignedEngine.$`, including the `processHandle` returned by `ProcessManager`.
- `EngineRuntimeService` relies on the shared `IAssignedEngineRuntime` fields under `engine.$` and does not refine that runtime namespace for its documented ownership.
- `EngineRuntimeService` owns base runtime creation, `processHandle`, `availability`, `lastError`, analysis subscriptions, and the attached `analysisOperation`, `analysisWork`, and `analysisNeedsStop` fields. Protocol-state completions remain client-owned.
- Base runtime existence is a precondition, not a lazy recovery path, for runtime actions that require it. If that precondition is violated, the service asserts and surfaces the failure. Explicit initialisation, analysis subscription, and engine restart may create base runtime state. Analysis start requires that state before claiming its operation.
- `startAnalysis(...)` asserts base runtime, supersedes the previous analysis operation synchronously, and coordinates `ensureReady(...)` followed by client startup. The composable no longer awaits readiness separately. `ensureReady` remains the explicit initialisation path; engine restart also owns process replacement.
- Analysis operations are serialised per assignment. Cancelling rejects a pending service startup promise with `Aborted`; underlying issued client work is still observed and drained. Superseded queued requests skip startup, and different engines start independently. A streaming operation retains its identity after the startup promise resolves.
- Output is forwarded only to the subscriber captured for the current operation. Ownership checks precede legality validation and guard status, error, and completion writes. Natural final output sets Ready even if it arrives before startup returns. All reported lines are validated without a presentation cap.
- `stopAnalysis(...)` invalidates ownership before awaiting outstanding work, then drains an issued search through the client's existing Stop transition. It is a no-op when no search was issued. The game keeps rendered results. `stopEngine`/`restartEngine` also terminate pending client waits and coordinate process cleanup; a handle returned by a late spawn is not abandoned.
- `startPlayerTurn(...)` and `startPondering(...)` retain their existing explicit-initialisation preconditions and one retry for an invalid stored process handle. Analysis readiness repairs a stale handle through `ensureReady` before entering the client.
- `EngineClient` owns UCI mapping, engine-facing FEN, engine-output interpretation, protocol sequencing, and client-private runtime state behind this service.
- Streamed analysis is surfaced through the shared runtime state on `engine.$`. `EngineRuntimeService` coordinates when that lower-layer analysis path is started, stopped, or subscribed to, but it is not the owner of client-private state such as `session`, current search position, expected ponder move, or pending player-turn state.
- `isRuntimeAlive(...)` is the only public runtime-health polling surface. Detailed runtime state stays internal on `engine.$`.
- If the stored `processHandle` is present but no longer valid, `EngineRuntimeService` surfaces that failure through the attempted runtime operation rather than handling it through background callbacks.
- `startPlayerTurn(...)` captures the canonical live position being searched, starts and awaits the client search through `awaitPlayerTurnMove(...)`, begins available pondering before waiting for `attemptPlayerMove(...)`, and always attempts a guarded move exactly once unless its optional turn signal aborts first. Aborting while awaiting a client move returns without creating a second submission path; local submission and accepted engine output still share `GamePlayerTurnComposable.attemptPlayerMove(...)`. **Why:** waiting for commit would waste ponder time and would prevent pondering while pause holds an accepted move; treating ponder failure as move failure would repeat or discard a valid result. Any future speculation mechanism must remain independent from move acceptance.
- `startPlayerTurn` has no response timeout in the baseline. If the process stays alive but does not produce a move, the turn remains pending until a move arrives or the session exits unexpectedly.
- `awaitPlayerTurnMove(...)` is the single application move guard for all concrete clients. It validates against the position captured when the search started, rejects an illegal best move, and validates any ponder reply on the sequential position after that move before either reaches state. **Why:** validating in every client would duplicate chess policy, while waiting until state would let untrusted output cross the boundary and make an engine-agnostic handler provider-aware. The invariant is one common acceptance guard at the external engine boundary, not repeated checks in later layers.
- Analysis updates use the same common boundary: `startAnalysis(...)` validates the reported best move and every principal-variation move against each evolving position before forwarding the update to subscribers. A rejected update does not replace the concrete client's last accepted analysis lines.
- The position after the best move used for ponder validation is an intentional detached simulation. **Why:** a ponder reply is legal only after the best move, but applying that move to the captured live position would mutate authority before the shared turn handler commits or defers it.
- `startPondering(...)` receives the guarded engine move and ponder move directly and keeps runtime availability ready because pondering is speculative; the concrete client owns the later hit or miss. **Why:** the engine move is not yet represented by `game.livePath`, and retaining a private "last best move" would create a second history authority that can become stale across pause, cancellation, or a new turn.
- Immediate pondering deliberately uses the game's current pre-commit clock snapshot. Projecting a post-move clock is outside this flow.
- Session health checks use `isRuntimeAlive(...)` polling rather than a public session-event callback contract.
- Unexpected process exit is observed when the next attempted runtime operation checks or uses the stored process handle. Recovery stays manual through the owning retry flows.
- Unrecognised ancillary output is ignored. Positively identified control output that is invalid for the current client state, player-turn parse failures, and other runtime exceptions are surfaced to the owning standard error-handling path.
- The default runtime design here is explicit object-attached state on `engine.$`. It does not use hidden side tables.
- Suggested owner-private mutation steps use mutation-obvious names such as `_assertBaseRuntime`, `_ensureProcessHandleOpen`, `_setAvailabilityStarting`, `_setAvailabilityReady`, `_setAvailabilityRunning`, `_setAvailabilityFailed`, `_clearLastError`, `_setLastError`, `_registerAnalysisCallback`, `_unregisterAnalysisCallback`, and `_clearAnalysisState`.
- The runtime ownership breakdown and state-mutation order are defined in [../../ProcessFlows/EngineRuntimeOwnership.md](../../ProcessFlows/EngineRuntimeOwnership.md).
