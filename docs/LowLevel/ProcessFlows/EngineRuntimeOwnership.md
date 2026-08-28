# Engine Runtime Ownership Flows

## Scope
This document covers the layer-2 and layer-1 runtime ownership behind `SCN-ANALYSIS-01` to `SCN-ANALYSIS-05`, `SCN-ENGINE-01` to `SCN-ENGINE-03`, and the engine-runtime portions of the live move loop.

## Ownership Summary
- `GamesStore` decides when analysis should run and when a live player turn should be armed.
- `EngineRuntimeService` owns base runtime creation, process lifecycle, process-handle checks, availability, last-error updates, analysis callback registration on `IAssignedEngine.$`, and optional pondering from a guarded engine-player result.
- `EngineClient` owns the protocol session, process listeners, current search position, expected ponder move, pending player-turn completion, protocol I/O, and parsing.
- `UciUtility` only builds protocol commands and parses individual protocol records. It does not own a process or session.
- Runtime state changes use explicit object-attached state. No flow relies on hidden side tables or silent runtime initialisation.

## Owner And Mutable State
`EngineRuntimeService` may mutate `engine.$.processHandle`, `availability`, `lastError`, `analysisCallback`, and `analysisLines`.

The concrete `EngineClient` may refine `engine.$` with a private session. Its UCI session records the protocol state, game boundary, root and active positions, expected ponder move, process listener, and deferred state or player-move completion.

`GamesStore` does not mutate either lower-layer runtime directly. It calls `EngineRuntimeService` and receives protocol-neutral analysis updates or `IMove` results. Emitted analysis payloads are readonly after callback dispatch, so the store may retain their result references without defensive cloning.

## Analysis Runtime

### Start Or Refresh Analysis
| `GamesStore.refreshAnalysis` |
| --- |
| `GameAnalysisComposable.refreshAnalysisForGame` |
| `GameAnalysisComposable.startAnalysisSnapshot` |
| `GameAnalysisComposable.subscribeToAnalysis` |
| `EngineRuntimeService.ensureReady` |
| `EngineRuntimeService.startAnalysis(engine, game, request)` |

| `EngineRuntimeService.startAnalysis` |
| --- |
| assert base runtime and live process |
| `EngineClient.startAnalysis(engine, game, request, analysisCallback)` |
| set runtime availability to `Running` |

| `EngineClient.startAnalysis` |
| --- |
| require an initialised session |
| stop and consume an existing analysis search when necessary |
| send `ucinewgame` and `isready` when the game id or root changed |
| derive the highlighted position command from `IGame` |
| enter `Analysing` and send the analysis commands |

### Stream Analysis Output
| `EngineClient._consumeLine` while `Analysing` |
| --- |
| parse `info` into `IAnalysisLine` |
| store the line by `IAnalysisLine.$.reference` |
| invoke `engine.$.analysisCallback` with a protocol-neutral update |

`bestmove` completes the analysis search, emits a final update, and returns the session to `Ready`. Unrecognised ancillary output is ignored. A recognised control response that is invalid in the current state fails the session rather than being consumed by an unrelated parser.

### Stop Analysis
| `GamesStore.stopAnalysis` |
| --- |
| dispose the analysis subscription |
| `EngineRuntimeService.stopAnalysis` |
| `EngineClient.stopAnalysis` |
| enter `StoppingAnalysis`, send `stop`, and consume the terminating `bestmove` |
| return the session to `Ready` |

## Player Turn Runtime

### Arm Every Live Turn
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| --- |
| `GamePlayerTurnComposable.requestPlayerMove` |
| create `game.$.pendingPlayerTurnPromise` for the current player |
| `GamePlayerTurnComposable.playerMoveHandler` awaits that shared promise |

`requestPlayerMove(...)` starts `playerMoveHandler(...)` and stores both the deferred and its handler promise before starting any engine provider. For a local player, `GamesStore.makeMove(...)` routes the current live move through `attemptPlayerMove(...)`. For a player engine, `requestEngineMove(...)` calls `ensureReady(...)` and `startPlayerTurn(engine, game, attemptPlayerMove)`, passing a callback bound to that request's deferred identity. A stale callback returns without submitting its move. Otherwise both player types resolve the same game-level deferred through `attemptPlayerMove(...)`; the same engine-agnostic handler stores the move as `deferredPlayerMove` while paused or commits it while live.

### Normal Engine Search
| `EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove)` |
| --- |
| capture the canonical live position being searched |
| `EngineClient.startPlayerTurn(engine, game)` |
| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| validate the best move against `searchedPosition` |
| derive a detached position after the best move and validate any ponder move |
| begin `EngineRuntimeService.startPondering(engine, game, engineMove, ponderMove)` immediately when available and the game is ongoing |
| `attemptPlayerMove(engineMove)` |

`EngineClient.startPlayerTurn(...)` derives the live position and timed search commands and enters `FindingMove`. While `FindingMove`, only `bestmove` completes the client-private pending engine move. The parsed `IMove` may carry an optional runtime-only `$.ponderMove` supplied by the engine. `EngineRuntimeService.awaitPlayerTurnMove(...)` is the one common legality guard for all clients; the concrete client and state layer do not duplicate it. The detached sequential-validation position is an intentional simulation copy so the captured live position remains unchanged before the move attempt.

### Ponder Search And Next Turn
As soon as a guarded engine result contains `$.ponderMove`, and while the game is still ongoing, `EngineRuntimeService.startPlayerTurn(...)` begins `startPondering(engine, game, engineMove, ponderMove)` before awaiting the shared move attempt. Pondering therefore does not depend on whether the handler commits immediately or stores a deferred move while paused. A ponder-start failure is recorded by the runtime but does not reject or repeat that move attempt.

The client constructs the ponder command from the game root, moves already represented by `game.livePath`, the directly supplied engine move, and the supplied ponder move. The transient sequence array is a command-building copy only; no best-move field, committed-move collection, or searched-position input is retained. The existing game clock snapshot is used even though it may still be pre-commit. The client enters `Pondering` and retains only the expected reply privately.

When that engine is next asked to move:
- If the latest live move matches the expected reply, `startPlayerTurn(...)` sends `ponderhit`, enters `FindingMove`, and delivers that search's next `bestmove` normally.
- If it does not match, `startPlayerTurn(...)` enters `StoppingPonder`, sends `stop`, consumes and discards that search's terminating `bestmove`, then sends a fresh live position and timed `go` in `FindingMove`.

This ordering prevents a stale ponder result from resolving the new player turn.

## Session State Machine
The UCI client uses these explicit states:

```text
Created -> AwaitingUciOk -> AwaitingReadyOk -> Ready
Ready -> Analysing -> StoppingAnalysis -> Ready
Ready -> FindingMove -> Ready
Ready -> Pondering -> FindingMove -> Ready
Ready -> Pondering -> StoppingPonder -> Ready -> FindingMove -> Ready
Any active state -> Stopped or Failed
```

Output handling is selected by the current state, not by trying several output parsers. State-transition deferreds are separate from the player-move deferred so a stop acknowledgement cannot satisfy a player turn.

## Stop, Restart, And Failure
`EngineRuntimeService.stopEngine(...)` asks the client to reject and clear private session work, then stops the process and clears shared analysis runtime. `restartEngine(...)` replaces or respawns the process before explicitly initialising a fresh protocol session.

`startAnalysis(...)`, `startPlayerTurn(...)`, and `startPondering(...)` may retry once only after `InvalidProcessHandle`, using the explicit engine initialisation path. Missing base runtime or a missing client session remains an exception and is not hidden by lazy repair. Start, await, or validation failure rejects the game-level deferred through the provider path and uses the existing handler retry behaviour; pondering failure alone preserves the accepted or deferred move.
