# Engine Runtime Ownership Flows

## Scope
This document covers the layer-2 and layer-1 runtime ownership behind `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, `SCN-ENGINE-01` to `SCN-ENGINE-03`, and the engine-runtime portions of the live move loop.

## Ownership Summary
- `EnginesStore` owns reusable engine profiles and caches discovered option metadata separately by profile id for configuration rendering.
- `GamesStore` decides when analysis should run and when a live player turn should be armed.
- `EngineRuntimeService` owns temporary option-discovery runtimes, base runtime creation, process lifecycle, process-handle checks, availability, last-error updates, analysis callback registration on `IAssignedEngine.$`, and optional pondering from a guarded engine-player result.
- `EngineClient` owns the protocol session, process listeners, current search position, expected ponder move, pending player-turn completion, protocol I/O, and parsing.
- `UciUtility` only builds protocol commands and parses individual protocol records. It does not own a process or session.
- Runtime state changes use explicit object-attached state. No flow relies on hidden side tables or silent runtime initialisation.

## Owner And Mutable State
`EngineRuntimeService` may mutate `engine.$.processHandle`, `availability`, `lastError`, `analysisCallback`, `analysisOperation`, `analysisWork`, `analysisNeedsStop`, and analysis-cache cleanup. The client owns normal map entry updates.

The concrete `EngineClient` may refine `engine.$` with a private session. Its UCI session records stable game-boundary and process-listener data plus a discriminated context for the current protocol state. Handshake lines and completions, active positions, the expected ponder move, the stopping completion, and a ready player move are owned only by the states that require them.

`GamesStore` does not mutate either lower-layer runtime directly. It calls `EngineRuntimeService` and receives protocol-neutral analysis updates or `IMove` results. Emitted analysis payloads are readonly after callback dispatch, so the store may retain their result references without defensive cloning.

## Option Metadata Discovery

| `EnginesStore.loadOptionMeta(engineProfile)` or `refreshOptionMeta(engineProfile)` |
| --- |
| `EngineRuntimeService.getOptions(engineProfile)` |
| copy the profile into a temporary `IAssignedEngine` |
| `EngineRuntimeService.ensureReady(temporaryEngine)` |
| `EngineClient.getOptions(temporaryEngine)` |
| copy the discovered metadata |
| `EngineRuntimeService.stopEngine(temporaryEngine)` in `finally` |
| cache the returned metadata by profile id only after successful discovery |

The temporary engine is never stored by `EnginesStore` or attached to a game. `EngineRuntimeService.getOptions(...)` applies the profile's saved configured options during normal initialisation, but it does not modify or reconcile them. The returned metadata is a detached copy and the temporary process has been closed before the promise resolves.

## Analysis Runtime

### Start Or Refresh Analysis

```text
GamesStore.refreshAnalysis / retryAnalysis / rendered-position action
  -> GameAnalysisComposable.refreshAnalysisForGame
     -> dispose targeted subscriptions and clear all targeted seat results
     -> ensure the rendered-position cache exists
     -> startAnalysisSeat for each engine independently
        -> subscribeToAnalysis
        -> EngineRuntimeService.startAnalysis(engine, game, request)
           -> _beginAnalysisOperation: abort/reject prior service operation
           -> mark Starting; _queueAnalysisOperation
           -> drain prior issued work; skip superseded pending requests
           -> ensureReady(engine, operation.abortController.signal)
           -> if current, EngineClient.startAnalysis(..., capturedGuard)
     -> touchGame publishes empty/starting seats before awaiting startup
```

The service startup promise resolves after commands are issued, while its operation identity remains active for streaming. Replacing or stopping pending startup rejects it with `Aborted`. The composable consumes expected cancellation and checks subscription membership before publishing completion/error. Late service writes are guarded by operation identity, not position keys. Player-turn coordination remains separate.

The UCI client captures its detached parsing board, commands, game ID, root FEN, and MultiPV option before awaiting anything. It retains its existing replacement sequence: `Analysing -> StoppingSearch -> bestmove -> Ready`, followed by any game-boundary readiness, then `Analysing`. Already issued work drains before a replacement enters the client; cancellation does not retract written commands.

### Stream Analysis Output

```text
NwjsUciEngineClient._consumeAnalysingLine
  -> parse against the captured board
  -> stage engine.$.analysisLines[reported rank], with no display cap
  -> _buildAnalysisUpdate: all retained lines in numeric rank order
  -> service guard checks current operation and captured subscriber
  -> validate every line and best move, including non-displayed ranks
  -> game subscription verifies its captured seat is still assigned
     -> seat.lines = update.lines.slice(0, 3)
     -> update bestMove, updatedAt, isComplete; touchGame
```

A rejected update returns `false`, restoring the prior runtime entry. Emitted line/PV objects remain immutable. `bestmove` returns the client to Ready and publishes a final update; a final update during startup cannot be overwritten with Running afterwards. `getVisibleAnalysis` returns all seats in roster order without filtering, and the panel renders their prepared lines directly.

### Stop, Remove, And Edit

```text
GamesStore.stopAnalysis(game, index?)
  -> dispose each targeted subscription
  -> EngineRuntimeService.stopAnalysis for each engine independently
     -> invalidate operation/reject pending service startup immediately
     -> drain issued startup; stop only when a search needs stopping
     -> client StoppingSearch consumes terminating bestmove, then Ready
  -> retain rendered results and isComplete; publish current status
```

Position changes and Refresh/Retry clear results before publication. Board-edit entry cancels work; effective edits clear results; exit restarts analysis. Removal starts service disposal and removes the captured seat before awaiting process cleanup. Setup replacement disposes old engine objects. Terminal disposal can reject pending client waits, releases late-spawned processes, and prevents delayed startup from reviving a stopped session.

## Player Turn Runtime

### Arm Every Live Turn
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| --- |
| `GamePlayerTurnComposable.requestPlayerMove` |
| create `game.$.pendingPlayerTurnPromise` for the current player |
| `GamePlayerTurnComposable.playerMoveHandler` awaits that shared promise |

`requestPlayerMove(...)` starts `playerMoveHandler(...)` and stores the deferred, its handler promise, and its abort controller before starting any engine provider. For a local player, `GamesStore.makeMove(...)` routes the current live move through `attemptPlayerMove(...)`. For a player engine, `requestEngineMove(...)` passes that signal through `ensureReady(...)` and `startPlayerTurn(engine, game, attemptPlayerMove, signal)`, with a callback bound to the request's deferred identity. A stale or aborted provider returns without submitting its move. Otherwise both player types resolve the same game-level deferred through `attemptPlayerMove(...)`. Move resolution and cancellation use that one deferred, so its first settlement determines whether the engine-agnostic handler returns or stores the move as `deferredPlayerMove` while paused or commits it while live. The handler clears the completed turn's runtime ownership fields in its `finally` block.

### Normal Engine Search
| `EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove, signal)` |
| --- |
| capture the canonical live position being searched |
| `EngineClient.startPlayerTurn(engine, game)` |
| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| validate the best move against `searchedPosition` |
| derive a detached position after the best move and validate any ponder move |
| begin `EngineRuntimeService.startPondering(engine, game, engineMove, ponderMove)` immediately when available and the game is ongoing |
| `attemptPlayerMove(engineMove)` |

`EngineClient.startPlayerTurn(...)` derives the live position and player search commands and enters `FindingMove`. Timed games supply both clocks and increments; untimed games use `go movetime 1000`, bounded by `BuildConfig.engine.untimedMoveTimeMs`. Ponder commands follow the same time-control choice. While `FindingMove`, only `bestmove` completes the client-private pending engine move. The parsed `IMove` may carry an optional runtime-only `$.ponderMove` supplied by the engine. `EngineRuntimeService.awaitPlayerTurnMove(...)` is the one common legality guard for all clients; the concrete client and state layer do not duplicate it. The detached sequential-validation position is an intentional simulation copy so the captured live position remains unchanged before the move attempt.

### Ponder Search And Next Turn
As soon as a guarded engine result contains `$.ponderMove`, and while the game is still ongoing, `EngineRuntimeService.startPlayerTurn(...)` begins `startPondering(engine, game, engineMove, ponderMove)` before awaiting the shared move attempt. Pondering therefore does not depend on whether the handler commits immediately or stores a deferred move while paused. A ponder-start failure is recorded by the runtime but does not reject or repeat that move attempt.

The client constructs the ponder command from the game root, moves already represented by `game.livePath`, the directly supplied engine move, and the supplied ponder move. The transient sequence array is a command-building copy only; no best-move field, committed-move collection, or searched-position input is retained. The existing game clock snapshot is used even though it may still be pre-commit. The client enters `Pondering` and retains only the expected reply privately.

When that engine is next asked to move, the `Pondering` state and its expected reply decide whether the latest live move is a hit. The command builder remains contextual, but its returned command is never inspected to infer state:
- On a hit, `startPlayerTurn(...)` selects `buildFindNextMoveCommands(game, expectedMove)`, which returns `ponderhit`.
- On a miss, it awaits `_stopSearch(engine, session)`. That enters `StoppingSearch`, sends `stop`, consumes and discards the terminating stale `bestmove`, and returns to `Ready`. The client then follows the normal game-boundary path and selects `buildFindNextMoveCommands(game)` from the current root and live path.

After command selection and the optional awaited stop, hit and miss use the same tail: capture the current live position, create the player-move completion, enter `FindingMove`, send the selected commands, and handle `bestmove` identically.

This ordering prevents a stale ponder result from resolving the new player turn.

## Session State Machine
The UCI client uses these explicit states:

```text
Created -> AwaitingUciOk -> AwaitingReadyOk -> Ready
Ready -> Analysing -> StoppingSearch -> Ready
Ready -> FindingMove -> PlayerMoveReady -> Ready
Ready -> Pondering -> FindingMove -> PlayerMoveReady -> Ready
Ready -> Pondering -> StoppingSearch -> Ready -> FindingMove -> PlayerMoveReady -> Ready
Any active state -> Stopped or Failed
```

Analysis and ponder searches share `StoppingSearch` because their stop protocol is identical: write `stop`, wait for `bestmove`, discard it, and return to `Ready`. Output handling is selected by the current state, not by trying several output parsers. Each pending completion belongs to its state context, so a stop result cannot satisfy a player turn.

## Stop, Restart, And Failure
`EngineRuntimeService.stopEngine(...)` asks the client to reject and clear private session work, then stops the process and clears shared analysis runtime. `restartEngine(...)` replaces or respawns the process before explicitly initialising a fresh protocol session.

`startPlayerTurn(...)` and `startPondering(...)` may retry once only after `InvalidProcessHandle`, using the explicit engine initialisation path. Missing base runtime or a missing client session remains an exception and is not hidden by lazy repair. Start, await, or validation failure rejects the game-level deferred through the provider path; the owning handler logs an unexpected failure and schedules the existing delayed player-turn retry. An `Aborted` cancellation returns without retry. Pondering failure alone preserves the accepted or deferred move.
