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
- A side in a live game may be assigned an engine instead of a human.
- At most one player engine may control each side.
- Player-engine behaviour is part of the live game flow, not the analysis flow.

### 2. Analysis Engine
- A game may have zero or more analysis engines assigned.
- Analysis engines evaluate positions and stream independent results into the analysis panel.
- Multiple analysis engines may run concurrently for the same game.

## Engine Inventory
Configured engines are user-managed records stored through settings.

Each committed engine record must include:

- stable ID
- display name
- executable path
- protocol, which is `UCI` in the baseline
- engine options

Duplicate IDs or invalid executable paths are rejected.

## Per-Game Assignment Rules
- Live games may assign human or engine control to either side.
- Free analysis/setup is created only when neither side is assigned a player.
- Analysis engine assignment is per game, not global to the whole app.
- The same configured engine may be used by more than one game, but each active runtime session must be isolated by game and role.

## Process Lifetime
- Engine processes start on demand when analysis or engine-controlled play needs them.
- If a position changes while analysis is running, the previous search is superseded and the engine is redirected to the new position.
- Removing an assigned engine, deleting a game, or closing the app stops the related engine processes.
- Updating the configuration of a running engine requires a restart before the new options apply.

## Multi-Engine Analysis Contract
- Multiple assigned analysis engines may evaluate the same position concurrently.
- Each engine updates its own row or group in the analysis UI independently.
- The app stores the latest valid result from each engine for a given game and position.
- Each engine group may expose up to `3` visible lines for the active position.
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
- Output parse failures discard only the invalid line or message and do not terminate the engine session on their own.
- If the engine stops unexpectedly, the last valid displayed result remains visible until replaced.

## Failure and Retry Behaviour
- Engine start failure must be isolated to the affected engine.
- Unexpected engine stop marks that engine as unavailable for the current session.
- The user may retry engine start manually.
- Automatic reconnect or backoff retry is not part of the baseline and is deferred to [ideas.md](ideas.md).

## Restore Behaviour
- When a saved game is loaded, the saved analysis snapshot for the visible position is shown first.
- Only after that may live analysis restart for available engines.
- If an assigned engine is unavailable, the saved analysis snapshot remains visible and the user gets actionable feedback.

## Ownership Boundaries
- `SettingsStore` owns configured engine inventory.
- `EnginesStore` owns assignment, availability state, and lifecycle coordination.
- `AnalysisStore` owns streamed evaluation state and saved visible-node analysis snapshots.
- `ProcessManager` owns child-process mechanics.

## Non-Baseline Exclusions
The following are explicitly out of scope for the rewrite baseline:

- `xboard` or other non-UCI protocols
- remote engines
- browser or WASM engines
- autonomous engine-vs-engine gameplay as a dedicated mode
- automatic crash recovery
