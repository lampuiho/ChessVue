# EngineRuntimeService

## Purpose
Own the layer-2 engine runtime boundary consumed by state stores for temporary profile inspection, continuous analysis and engine-controlled turns.

## Public Interface
```ts
// src/domain/EngineRuntimeService.ts
ensureRuntime(engine: IAssignedEngine): IAssignedEngineRuntime
getOptions(engineProfile: IEngineRecord): Promise<readonly IEngineOptionMeta[]>
ensureReady(engine: IAssignedEngine, signal?: AbortSignal): Promise<void>
startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest): Promise<void>
stopAnalysis(engine: IAssignedEngine): Promise<void>
startPlayerTurn(engine: IAssignedEngine, game: IGame, attemptPlayerMove: (move: IMove) => Promise<void>, signal?: AbortSignal): Promise<void>
startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMoveRaw, ponderMove: IMoveRaw): Promise<void>
subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void
awaitPlayerTurnMove(engine: IAssignedEngine, searchedPosition: IBoardPosition): Promise<IMove>
isRuntimeAlive(engine: IAssignedEngine): boolean
restartEngine(engine: IAssignedEngine): Promise<void>
stopEngine(engine: IAssignedEngine): Promise<void>
```

## Responsibilities
- run a temporary assigned-engine copy of a reusable profile, return copied option metadata, and close the temporary engine before discovery completes
- coordinate engine sessions in a game-facing shape so layer 3 consumes one runtime service instead of platform adapters
- assert that base runtime state already exists before lower-layer protocol work that requires it
- start, restart, validate and stop engine processes through the `ProcessManager` paired with the assignment's `clientType`
- set runtime availability and `lastError` on the shared assigned-engine runtime state
- register and unregister the shared analysis callback on `engine.$`
- compose `ProcessManager` for process lifecycle and `EngineClient` for protocol conversation without layering one platform service through another
- own the complete engine-player turn from client search start through guarded result, immediate optional pondering and the shared state-layer move attempt
- validate client best moves against the captured search position and any ponder reply against a detached position after that best move
- expose typed streamed analysis updates and promise-shaped player-turn completion without leaking UCI or process semantics upward

## Dependencies
- `usePlatformService().getProcessManager(engine.clientType)` and `getEngineClient(engine.clientType)`
- `MoveApplicationService` for detached validation positions
- `GameRuleUtility` (`isMoveLegal`, `resolveGameResult`), `Deferred`, `Aborted` and `StandardErrorHandlingUtility.isPlatformError`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-SESSION-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Callers
- `GamesStore` composables: `GameAnalysisComposable` (`ensureRuntime`, `subscribeToAnalysis`, `startAnalysis`, `stopAnalysis`, seat `stopEngine`) and `GamePlayerTurnComposable` (`ensureRuntime`, `ensureReady`, `startPlayerTurn`, `stopEngine` on reassignment), plus `GamesStore`'s own player-engine stops during takeback and store-scope disposal.
- `EnginesStore` for profile option metadata through `getOptions`.
- `GameCreationModal` and `useQuickGame` call `getOptions` directly to check that required engine seats can start before a game is created. This presentation call is a recorded exception to the layer rules; see [Architecture index](../index.md#current-exceptions).

## Notes
- `ensureRuntime(...)` creates the base runtime without launching a process and returns the existing runtime on later calls. The state layer may wrap that runtime in shallow reactivity before engine work starts; runtime creation and process or status ownership remain here.
- `getOptions(...)` copies a reusable profile into a temporary `IAssignedEngine`, including its saved configured options, awaits `ensureReady`, copies the client-discovered metadata and stops the engine in `finally`. The temporary runtime is never retained by a store or attached to a game.
- Option discovery does not populate, validate or reconcile `IEngineRecord.options`. Saved configured values remain authoritative, while `EnginesStore` caches the returned metadata separately for profile editing.
- `GamesStore` owns runtime intent and session usage, but it reaches protocol and process behaviour only through this service. **Why:** this service owns game-facing process state while `EngineClient` owns protocol-session state; merging them would leak protocol details upward, and letting the two layer-1 adapters call each other would obscure which owner mutates `engine.$`. A redesign must keep one owner for process state, one for protocol state and an explicit composition boundary.
- This service owns base runtime creation, `process`, `availability`, `lastError`, `analysisCallback`, `analysisOperation`, `analysisWork`, `analysisClientWork`, `analysisShutdownWork` and `analysisNeedsStop`. The client writes `analysisLines`, and both owners clear it. Protocol-state completions remain client-owned.
- Base runtime existence is a precondition, not a lazy recovery path, for actions that require it. Explicit initialisation, analysis subscription and restart may create base runtime state; analysis start asserts it before claiming its operation.
- `_initialiseEngine` spawns a process when none is stored, or validates the stored one and respawns once on `invalidProcessHandle`. A process returned after cancellation is still stored, so later disposal can release it. Client initialisation is skipped when the readiness signal has aborted.
- `startAnalysis(...)` asserts base runtime, supersedes the previous analysis operation synchronously by aborting it and rejecting its completion with `Aborted`, sets availability `Starting`, and queues `ensureReady(...)` followed by client startup. Callers do not await readiness separately.
- Analysis operations are serialised per assignment through `analysisWork`. A superseded queued request skips startup; underlying issued client work is still observed and drained through `analysisClientWork`. Different engines start independently. A streaming operation keeps its identity after its startup promise resolves.
- Output is forwarded only while the subscriber captured at operation start is still registered and the operation has not been aborted or finalised. These ownership checks precede legality validation and guard status, error and completion writes. Natural final output sets `Ready` even if it arrives before startup returns. All reported lines are validated without a presentation cap.
- `stopAnalysis(...)` supersedes the current operation, then drains an issued search through the client's stop transition only when a search may still be running. Otherwise it only resets availability. The game keeps rendered results.
- `stopEngine(...)` and `restartEngine(...)` share `_queueEngineDisposal`. It supersedes analysis, physically stops the process early when client work is blocked waiting on it, then queues the stop or restart. Process shutdown runs through one shared `analysisShutdownWork` per assignment: stop the physical process first, then clear the client session, then clear `process` and analysis state. **Why:** keeping response contexts intact until the physical process has stopped prevents a pending client wait from being abandoned while its process can still answer; a physical-stop failure leaves the reference available for another disposal attempt. Stop sets `Unavailable` and clears the captured analysis callback; restart sets `Starting` and then re-runs `ensureReady`.
- `startPlayerTurn(...)` and `startPondering(...)` keep their explicit-initialisation precondition and retry once after an invalid stored process reference. Analysis readiness repairs a stale process through `ensureReady` before entering the client.
- `startPlayerTurn(...)` captures `game.$.livePosition`, starts the client search, awaits `awaitPlayerTurnMove(...)`, begins available pondering, then awaits `attemptPlayerMove(...)` exactly once unless its optional signal aborts first. Aborting while waiting for a client move returns without creating a second submission path; local submission and accepted engine output share `GamePlayerTurnComposable`'s move attempt. **Why:** waiting for commit would waste ponder time and prevent pondering while pause holds an accepted move; treating ponder failure as move failure would repeat or discard a valid result. Any future speculation mechanism must remain independent from move acceptance.
- Pondering starts only when the move carries a ponder reply, the game is still ongoing and the position after both moves is not terminal. Ponder start failures are swallowed.
- `startPlayerTurn` has no response timeout. If the process stays alive but produces no move, the turn remains pending until a move arrives or the session fails.
- `awaitPlayerTurnMove(...)` is the single application move guard for all concrete clients. It validates against the position captured when the search started, rejects an illegal best move, and validates any ponder reply on the position after that move before either reaches state. **Why:** validating in every client would duplicate chess policy, while waiting until state would let untrusted output cross the boundary and make an engine-agnostic handler provider-aware. The invariant is one common acceptance guard at the external engine boundary.
- Analysis updates use the same boundary: the best move and every principal-variation move are validated against each evolving position before an update reaches the subscriber. A rejected update returns `false` to the client, which keeps its prior accepted line for that rank.
- The positions used for ponder and principal-variation validation are intentional detached simulations from `MoveApplicationService.genPosition(...)`. **Why:** a ponder reply is legal only after the best move, but applying that move to the live position would mutate authority before the shared turn handler commits or defers it.
- `startPondering(...)` receives the guarded engine move and ponder move directly and keeps availability `Ready`, because pondering is speculative; the client owns the later hit or miss. **Why:** the engine move is not yet on `game.livePath`, and retaining a private last best move would create a second history authority that can become stale across pause, cancellation or a new turn. Immediate pondering deliberately uses the game's current pre-commit clock snapshot.
- `isRuntimeAlive(...)` is the only public runtime-health query. It returns `false` without runtime, process, or with `Unavailable` or `Failed` availability, and otherwise asks the paired manager whether the process is open.
- Unexpected process exit is observed by the client's exit listener, which fails the session, or by the next runtime operation that validates or uses the stored process. Recovery stays manual through the owning retry flows.
- An `invalidProcessHandle` failure clears the stored process before availability becomes `Failed`. `Aborted` failures do not mark the engine failed.
- State is explicit object-attached state on `engine.$`; there are no hidden side tables.
- Private mutation steps are named for their effect, for example `_createBaseRuntime`, `_assertBaseRuntime`, `_setRuntimeAvailability`, `_clearAnalysisState`, `_beginAnalysisOperation`, `_queueAnalysisOperation`, `_failAnalysisOperation`, `_runAnalysisClientWork`, `_initialiseEngine`, `_releaseEngineProcess`, `_stopEngineProcess` and `_queueEngineDisposal`.
- The runtime ownership breakdown and state-mutation order are defined in [EngineRuntimeOwnership](../../ProcessFlows/EngineRuntimeOwnership.md).
