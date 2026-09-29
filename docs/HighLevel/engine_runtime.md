# ChessVue Engine Runtime Contract

## Purpose
This document defines the committed engine runtime model for the rewrite baseline.

The baseline is desktop-first and multi-engine now. Engine behaviour must follow this contract instead of being inferred from older notes.

## Runtime Baseline
- Engine protocol: `UCI`
- Engine transport: local child process
- Engine host capability: desktop shell with process and filesystem access

The baseline does not commit to browser, WASM, network, or remote-engine transports. Those options are tracked in [ideas.md](ideas.md).

## Engine Roles
ChessVue supports two committed engine roles.

### 1. Player Engine
- A side in a live game may be assigned an engine instead of a local player.
- At most one player engine may control each side.
- Player-engine behaviour is part of the live game flow, not the analysis flow.
- When both sides are engine-controlled, the same live-game player-turn loop continues turn by turn without a separate engine-vs-engine mode.

### 2. Analysis Engine
- A game may have zero or more analysis engines assigned.
- Analysis engines evaluate positions and stream independent results into the analysis panel.
- Multiple analysis engines may run concurrently for the same game.

## Engine Inventory
Configured engines are user-managed profiles stored through settings.

Each committed engine profile must include:

- display name
- executable path
- protocol, which is `UCI` in the baseline
- engine options

Only profile names must be unique.

All other profile fields are user-managed values. The app stores them as entered and uses them when creating copied in-game engine payloads.

Profile edits change the reusable engine profile only. They do not mutate already copied player-engine or analysis-engine payloads inside an existing game.

## Per-Game Assignment Rules
- Live games require both sides to be assigned, using either a local player or an engine profile.
- Free analysis/setup is used whenever either side is assigned `none`.
- Analysis engine assignment is per game, not global to the whole app.
- Analysis engines may be assigned when a game is created and may also be added or removed later from that same game's analysis panel.
- The same configured engine may be used by more than one game, but each copied in-game engine payload keeps its own runtime state.
- Assigning an engine to a side or analysis row captures a copied in-game engine payload with the launch configuration used by that game.
- That copied engine payload stores the copied display name, executable path, protocol, and engine options directly on the game.
- Editing or deleting the source engine profile later does not rename, retarget, or otherwise mutate an already copied in-game engine participant because the game keeps its own copied engine payload.
- The player-strip player label acts as the explicit player-reassignment affordance. The baseline choices are `none`, `local`, or one configured engine profile.
- Engine-controlled interaction contracts are written as the baseline implementation of a more general non-local participant boundary so a future remote adapter can reuse the same draw and seat-control surfaces without rewriting gameplay flows.

## Process Lifetime
- Engine processes start on demand when analysis or engine-controlled play needs them.
- If a position changes while analysis is running, the previous search is superseded and the engine is redirected to the new position.
- Removing a copied in-game analysis engine, deleting a game, or closing the app stops the related engine processes.
- Updating the configuration of a running engine requires a restart before the new options apply.
- After a committed engine-controlled live move, the normal live-state gate decides whether the next side should immediately receive an engine turn; this is the same rule for `local/engine` and `engine/engine` games.
- In the baseline, profile edits do not force that restart automatically. Updated profile values apply only when a new copied in-game engine payload is created or an existing engine is explicitly unseated and reseated.
- If player reassignment changes a side to `none`, the previous live game ends, live player-engine sessions stop, and the workspace continues as `freeAnalysisSetup` while preserving the move tree.
- If player reassignment results in both sides being assigned again, live play restarts from the preserved setup/history with a newly chosen time control and fresh live clock state.
- After that restarted live game is created, the normal live-state gate decides whether the side to move should immediately receive an engine turn.
- If a timed live game is paused while a player-engine turn search or analysis search is already in flight, that current search may continue until it reaches a best line or move result.
- Analysis output produced while paused may update the stored analysis seat for read-only display, but it must not unlock paused interaction.
- A player-engine move produced while paused has already passed the common engine-result legality boundary against its searched position. It is stored as deferred output and must not mutate the game tree or clocks until the game resumes.
- On resume, deferred player-engine output commits only when the live turn is still ready; otherwise it is discarded. **Why:** paused gameplay cannot change the live position and ownership-changing actions clear the pending or deferred runtime, so a second legality check would duplicate the completed engine-boundary decision.

## Player Move Contract
- Engine-backed move generation is exposed to the game flow as a simple async request/response boundary.
- Higher layers request a move and await the returned `IMove`.
- Local board submission and guarded engine output settle the same per-turn completion boundary. **Why:** separate player-type handlers duplicated pause and commit behaviour and let provider timing change ownership; the shared boundary keeps one current-turn owner.
- The common engine runtime validates an engine result before it crosses into game state; concrete protocol clients and later state handlers do not duplicate that guard. **Why:** per-client checks would duplicate chess policy, while state-only checks would let untrusted protocol output cross the application boundary.
- The runtime implementation may still use internal callbacks or engine-output listeners to resolve that promise.
- Polling is reserved for runtime-health checks such as whether the underlying process is still running.

## Multi-Engine Analysis Contract
- Multiple assigned analysis engines may evaluate the same position concurrently.
- Each engine updates its own row or group in the analysis UI independently.
- The app stores the latest valid result from each copied in-game analysis engine inside that game's persisted analysis data.
- Each engine group may expose up to `3` visible lines for the active position.
- Each assignment is an analysis seat. The client retains every reported runtime rank, while the game's subscription selects the first three ranked lines for rendering and persistence. Position changes clear these rendered results before publication; visible reads do not filter by a position key.
- The service cancels and serialises requests per assigned engine, including readiness. It forwards only the current operation's captured subscriber; the client remains a protocol state machine with its existing stop acknowledgement boundary.
- Each engine group may be folded or expanded independently without affecting the other engine groups.
- Partial failure of one engine must not stop the remaining engines.

## Resource Limit Policy
To prevent the low-level rewrite from inventing concurrency rules, the baseline high-level policy is:

- up to `4` concurrent analysis engines per game
- one player-engine runtime session per engine-controlled side

If the user selects more than the supported concurrent analysis engines, the app must reject the extra selection with a user-visible explanation rather than silently queueing or overcommitting resources.

## Search and Streaming Behaviour
- Analysis engines stream incremental results over time.
- The latest valid output from an engine replaces its earlier displayed result for that same position.
- Paused live play blocks suggested-move application but permits Refresh, Retry, Stop, assignment controls, and continued streamed updates. Board editing blocks analysis startup.
- Protocol parsing remains an internal engine-boundary concern owned by `EngineClient`; upper layers consume app-facing analysis updates and awaited moves rather than raw engine lines.
- If the engine stops unexpectedly, the next attempted runtime operation fails explicitly for that engine. The last valid displayed result remains visible until replaced.

## Failure and Retry Behaviour
- Engine start failure must be isolated to the affected engine.
- Unexpected engine stop is detected when the next runtime operation checks or uses that process handle and fails for that engine.
- The explicit initialisation path is `EngineRuntimeService.ensureReady(...)`. Analysis start coordinates that path internally after claiming its cancellable operation; player operations retain their explicit readiness flow.
- If a runtime action finds that a previously stored process handle has gone stale, that action may retry once by re-running the same explicit initialisation path before continuing.
- The user may retry engine start manually.
- Automatic reconnect or backoff retry is not part of the baseline and is deferred to [ideas.md](ideas.md).

## Restore Behaviour
- When a saved game is loaded, the restored workspace position becomes the new analysis target.
- Only after that may live analysis restart for available engines.
- If a copied in-game engine is unavailable, analysis remains empty or unavailable for that engine and the user gets actionable feedback.

## Ownership Boundaries
- `EnginesStore` owns configured engine profiles, exposes them for selection flows, and caches separately discovered option metadata for profile configuration.
- `SettingsStore` owns user settings and appearance projection, not engine-profile configuration.
- `GamesStore` owns copying a selected reusable engine profile into the current game's assigned-engine snapshot, plus assignment on the current game, turn waiting, and analysis coordination for already copied engine participants.
- `GamesStore` persists up to three rendered lines per analysis seat and exposes all seats through the existing readonly accessor. Stop retains accepted results; Refresh/Retry and position changes clear the affected results.
- `EngineRuntimeService` owns the layer-2 engine runtime boundary consumed by `GamesStore` and the temporary option-discovery runtime used by `EnginesStore`.
- `EngineRuntimeService` composes `ProcessManager` for process lifecycle and `EngineClient` for protocol conversation.
- `EngineClient` owns protocol sequencing, engine-output interpretation, move or line parsing, and new-game-boundary decisions behind `EngineRuntimeService`.
- `ProcessManager` owns child-process lifecycle only and is consumed by `EngineRuntimeService`.

## Non-Baseline Exclusions
The following are explicitly out of scope for the rewrite baseline:

- `xboard` or other non-UCI protocols
- remote engines
- browser or WASM engines
- automatic crash recovery

