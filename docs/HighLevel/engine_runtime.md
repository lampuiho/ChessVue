# ChessVue Engine Runtime Contract

## Purpose
This document defines the committed engine runtime model.

The baseline is desktop-first and multi-engine now, implemented for NW.js desktop and browser targets. Engine behaviour follows this contract instead of being inferred from older notes.

## Runtime Baseline
- Engine protocol: `UCI`
- Engine interfaces (`EngineClientType`): `uci` runs a native executable as a local child process; `uciWorker` runs a UCI script in a dedicated Web Worker
- Desktop (NW.js) supports both interfaces, including within one game. The browser supports `uciWorker` only.
- Bundled engine: Stockfish.js 19.0.1, lite single-threaded WASM build, served at `engines/stockfish/stockfish-19-lite-single.js` with its WASM and licence files

Both interfaces share `UciEngineClientBase`, which owns handshake, options, analysis, player turns and pondering. The process manager owns one process or worker per engine assignment; a worker entry can be an app-served script (including the bundled engine), a script inside an imported browser package, or, on desktop, a local script path. The bundled build needs no cross-origin-isolation headers. Native executables remain desktop-only; a browser assignment that names one fails for that engine with an explicit error. Remote transports remain deferred in [ideas.md](ideas.md). Journey runs inject scripted UCI transport behind the same interfaces.

**Why a worker interface rather than a separate engine protocol:** the browser cannot start child processes, but the engines it can run still speak UCI. Modelling a worker as another `IProcess` lets one UCI client implementation serve both hosts, and `EngineClientType` remains the single implementation selector; the unused engine `protocol` field was removed. A replacement must keep one UCI session implementation and must not add host-specific runtime APIs above the platform layer. Revisit for a non-UCI protocol or remote engine. See the archived [engine package rework](../ArchivedPlans/EngineInstallationReworkPlan.md#agreed-model).

## Engine Roles
ChessVue supports two committed engine roles.

### 1. Player Engine
- A side in a live game may be assigned an engine instead of a local player.
- At most one player engine may control each side.
- Player-engine behaviour is part of the live game flow, not the analysis flow.
- Timed games supply their clocks to UCI. Untimed games use a fixed 1000 ms player search (`BuildConfig.engine.untimedMoveTimeMs`), so engine turns finish without introducing game clocks or a new user preference.
- When both sides are engine-controlled, the same live-game player-turn loop continues turn by turn without a separate engine-vs-engine mode.

### 2. Analysis Engine
- A game may have zero or more analysis engines assigned.
- Analysis engines evaluate positions and stream independent results into the analysis panel.
- Multiple analysis engines may run concurrently for the same game.

## Engine Inventory
Configured engines are user-managed profiles stored in settings (`analysis.engineInventory`).

Each engine profile (`IEngineRecord`) contains:

- `id`
- `displayName`
- `clientType`: `uci` or `uciWorker`
- `entryPath`: the executable or worker entry script
- `options`: engine option name/value pairs

Only profile names must be unique.

All other profile fields are user-managed values. The app stores them as entered and uses them when creating copied in-game engine payloads; a profile that cannot run is reported when it is used, not when it is saved. The default inventory contains the bundled Stockfish profile (`id: stockfish`, `uciWorker`).

Profile edits change the reusable engine profile only. They do not mutate already copied player-engine or analysis-engine payloads inside an existing game, or the copies held in game creation defaults.

## Engine Packages
Engine packages are the folders from which worker entry scripts are chosen. `EnginePackageService` lists them and `EnginesStore` exposes them to the engine views.

- The bundled `stockfish` package is part of the app on both targets. It is listed as included and is never copied, installed or removed.
- On the browser target, the user can import a ZIP archive as a named package. The engine name is the folder name: it must be a unique, non-reserved single folder name, compared without case. The archive's paths are validated and its original files are stored atomically, with their relative layout, in IndexedDB (`chessvue-engines`) under `engine-files/<name>`. No manifest is required or generated.
- A profile chooses the actual entry script inside a package explicitly; ChessVue never guesses an entry.
- Stored package scripts load through `WorkerScriptLoader`, which maps the original files to Blob URLs inside a generated worker bootstrap so the entry can load its sibling scripts and WASM; terminating the worker releases them. Nested workers and module workers are not supported.
- An imported package can be removed only when no accepted or draft profile, accepted or draft game default, or open game references an entry inside it. Removal never rewrites profiles or games.
- On desktop there is no package installation. A profile points directly at an executable or at an entry script in an unpacked folder, chosen through the file dialog.

**Why stored scripts load through a Blob bootstrap:** the app may be a static site such as GitHub Pages, so imported engine files cannot be served by the host, and the earlier service-worker mechanism added registration and activation lifetimes. The loader keeps engine files in the browser, preserves their original bytes and names, and ties resource release to normal worker termination. A replacement must not upload engine files or depend on a global serving registration. See the archived [engine package rework](../ArchivedPlans/EngineInstallationReworkPlan.md#stored-script-loading-options) and [external worker loading experiments](../ArchivedPlans/ExternalWorkerLoadingExperiments.md).

## Per-Game Assignment Rules
- Live games require both sides to be assigned, using either a local player or an engine profile.
- Free analysis/setup is used whenever either side is unassigned.
- Analysis engine assignment is per game, not global to the whole app.
- Analysis engines may be assigned when a game is created and may also be added or removed later from that same game's analysis panel. Analysis engine names are unique within one game.
- The same configured engine may be used by more than one game, or by a player seat and an analysis seat, but each copied in-game engine payload keeps its own runtime state.
- Assigning an engine to a side or analysis row captures a copied in-game engine payload (`displayName`, `clientType`, `entryPath`, `options`) with the launch configuration used by that game.
- Editing or deleting the source engine profile later does not rename, retarget, or otherwise mutate an already copied in-game engine participant because the game keeps its own copied engine payload.
- The player-strip player label acts as the explicit player-reassignment affordance. The choices are unassigned, local, a configured engine profile, or keeping the current engine.
- Engine-controlled interaction contracts are written as the baseline implementation of a more general non-local participant boundary so a future remote adapter can reuse the same draw and seat-control surfaces without rewriting gameplay flows.

## Process Lifetime
- Engine processes and workers start on demand when analysis or engine-controlled play needs them.
- If a position changes while analysis is running, the previous search is superseded and the engine is redirected to the new position.
- Removing a copied in-game analysis engine, reassigning an engine seat, or closing the app stops the related engine processes. NW.js awaits that shutdown before exiting; a closing browser tab ends its workers with the page.
- Closing a game tab removes the tab only. The game stays in the running workspace, so its engines are not stopped by the tab close.
- Updating the configuration of a running engine requires a restart before the new options apply.
- After a committed engine-controlled live move, the normal live-state gate decides whether the next side should immediately receive an engine turn; this is the same rule for `local/engine` and `engine/engine` games.
- Profile edits do not force that restart automatically. Updated profile values apply only when a new copied in-game engine payload is created or an existing engine is explicitly unseated and reseated.
- If player reassignment changes a side to unassigned, the previous live game ends, live player-engine sessions stop, and the workspace continues as free analysis while preserving the move tree.
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
- After an engine move in an ongoing game, the runtime may start pondering the engine's expected reply when that reply is legal.
- Premoves do not change engine readiness, delivery, pondering, retries or cancellation. The existing actual-turn request registers its Deferred/handler/controller, then either starts the engine provider or offers one queued raw local head through `attemptPlayerMove`. Analysis/history selection does not gate actual successor requests. See the [implemented call flow](../LowLevel/ProcessFlows/GameplayAndControl.md#scn-move-04---premoves-through-the-existing-turn-request).
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
- Analysis is not started on a rendered live position that ended by checkmate or stalemate, because no legal move exists to search.

Engines may evaluate actual game positions and temporary exploratory positions. The user's recording feature applies only to actual moves played in games; exploratory output must not create or replace those recorded-analysis entries. This does not prevent interactive analysis or change the existing current-seat output contract. Actual-move record review prompts are in [Q-ANALYSIS-001](../questions/analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md) and [Q-ENGINE-001](../questions/engine/Q-ENGINE-001-ComparisonAndPersistence.md), to investigate during journey implementation/testing rather than resolve upfront; exploratory pruning is settled in [Q-ANALYSIS-002](../questions/analysis/Q-ANALYSIS-002-VariationRetention.md).

## Resource Limit Policy
To prevent the implementation from inventing concurrency rules, the high-level policy is:

- up to `4` concurrent analysis engines per game
- one player-engine runtime session per engine-controlled side

Selections beyond four analysis engines are prevented rather than queued: creation forms and the analysis panel show the count and disable adding a fifth engine, and the store rejects a fifth assignment with an explanatory error.

## Search and Streaming Behaviour
- Analysis engines stream incremental results over time.
- The latest valid output from an engine replaces its earlier displayed result for that same position.
- Paused live play blocks suggested-move application but permits Refresh, Retry, Stop, assignment controls, and continued streamed updates. Board editing blocks analysis startup.
- Protocol parsing remains an internal engine-boundary concern owned by `IEngineClient`; upper layers consume app-facing analysis updates and awaited moves rather than raw engine lines.
- If the engine stops unexpectedly, the next attempted runtime operation fails explicitly for that engine. The last valid displayed result remains visible until replaced.

## Failure and Retry Behaviour
- Engine start failure must be isolated to the affected engine and is shown on its analysis section or player strip.
- Unexpected engine stop is detected when the next runtime operation checks or uses that process handle and fails for that engine.
- The explicit initialisation path is `EngineRuntimeService.ensureReady(...)`. Analysis start coordinates that path internally after claiming its cancellable operation; player operations retain their explicit readiness flow.
- If a runtime action finds that a previously stored process handle has gone stale, that action may retry once by re-running the same explicit initialisation path before continuing.
- The user may retry engine start manually.
- Creating a game checks that each required player engine can start, using a temporary option-discovery session, before the game is inserted. Optional analysis engines are not checked in advance.
- Automatic reconnect or backoff retry is not part of the baseline and is deferred to [ideas.md](ideas.md).
- Known gap: a failed live player turn is currently rescheduled by `GamePlayerTurnComposable` every 500 ms (`requestPlayerMoveIfNeeded`), with no limit while the turn remains due, and each attempt respawns the process through `ensureReady`. That is an unbounded automatic retry, which conflicts with the rule above; it is flagged as a code/contract decision, not documented as intended. Analysis seats do not retry automatically.

## Restore Behaviour
- When a saved game is loaded, the restored workspace position becomes the new analysis target.
- Only after that may live analysis restart for available engines, when `analysis.resumeLiveAnalysisAfterRestore` allows it.
- If a copied in-game engine is unavailable, including a desktop executable restored in the browser or an imported package that has been removed, analysis remains empty or unavailable for that engine and the user gets actionable feedback. The profile editor offers relinking for a profile whose interface needs the desktop app.

## Ownership Boundaries
- `EnginesStore` owns access to configured engine profiles for selection flows, caches separately discovered option metadata for profile configuration, and owns the engine package list and its serialised install/remove work.
- `SettingsStore` owns the settings draft that profile edits change, plus user settings and appearance projection.
- `GamesStore` owns copying a selected reusable engine profile into the current game's assigned-engine snapshot, plus assignment on the current game, turn waiting, and analysis coordination for already copied engine participants.
- `GamesStore` persists up to three rendered lines per analysis seat and exposes all seats through the existing readonly accessor. Stop retains accepted results; Refresh/Retry and position changes clear the affected results.
- Actual move commits copy available analysis of the rendered live parent into that move node's optional `recordedAnalysis`. These pre-move snapshots exclude runtime state and remain independent of later engine output; exploratory commits create no records. No output is copied from a different rendered context during a background reply.
- `EngineRuntimeService` owns the layer-2 engine runtime boundary consumed by `GamesStore` and the temporary option-discovery runtime used by `EnginesStore` and creation readiness checks.
- `EngineRuntimeService` obtains the `IProcessManager` and `IEngineClient` bound to the engine's `clientType` from the platform service.
- `EnginePackageService` owns package listing, archive validation, browser package storage and removal checks; it does not start engines.
- `IEngineClient` owns protocol sequencing, engine-output interpretation, move or line parsing, and new-game-boundary decisions behind `EngineRuntimeService`.
- `IProcessManager` owns child-process or worker lifecycle only and is consumed by `EngineRuntimeService`.

See the [engine runtime ownership flows](../LowLevel/ProcessFlows/EngineRuntimeOwnership.md).

## Non-Baseline Exclusions
The following are explicitly out of scope:

- `xboard` or other non-UCI protocols
- remote engines
- automatic crash recovery
- engine package installation on desktop
