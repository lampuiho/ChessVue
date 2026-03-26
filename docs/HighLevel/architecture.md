# ChessVue Baseline Architecture

## Purpose
This document defines the committed high-level architecture for the next implementation wave.

The rewrite baseline is:

- `All Planned`
- `desktop-first`
- `multi-engine now`

`Idea` items are intentionally excluded from this document and are tracked in [ideas.md](ideas.md).

## Architectural Rule
The low-level rewrite may depend only on:

- this document
- [scenarios.md](scenarios.md) for `Current` and `Planned` behaviour
- [state_model.md](state_model.md)
- [persistence_contract.md](persistence_contract.md)
- [engine_runtime.md](engine_runtime.md)
- [settings_contract.md](settings_contract.md)
- [build_settings.md](build_settings.md)
- [user_settings.md](user_settings.md)

The low-level rewrite must not promote anything from [ideas.md](ideas.md) without a separate high-level decision.

## Layer Model
ChessVue uses a layered architecture with acyclic dependencies.

### Layer 1: Platform Abstraction
Purpose: isolate desktop-specific capabilities behind interfaces.

Committed platform modules:

- `usePlatformServicesStore` as the bootstrap seam for concrete platform adapters
- `StorageAdapter` for app-local persistence
- `FileIoAdapter` for save/load file workflows
- `ProcessManager` for local child-process lifecycle and raw stdin/stdout transport
- `EngineClient` for UCI protocol session management on top of `ProcessManager`

During the rewrite phase, these adapters are backed by mocked `NW.js`-style host services rather than final real host bindings.

This layer does not depend on domain, state, or presentation modules.

### Layer 2: Domain Logic
Purpose: hold chess rules and serialisable game logic with no UI or platform assumptions.

Committed domain modules:

- `GameRuleService`
- `MoveUpdateService`
- `TimeControlService`
- `SerializationService`

This layer owns legal move handling, move-tree rules, clock calculation rules, and serialisation rules.

### Layer 3: State Management
Purpose: coordinate app state, domain logic, persistence, and engine runtime.

Committed state modules:

- `GamesStore`
- `AnalysisStore`
- `EnginesStore`
- `SettingsStore`
- `RecentGameStore`
- `UiStateStore`

This layer depends on domain logic and platform abstractions.

### Layer 4: Presentation
Purpose: render the app shell, views, and interactive UI.

Committed presentation modules:

- `Router`
- `HomeView`
- `GameView`
- `SettingsView`
- `MenuBar`
- `GameTabs`
- `NewGameModal`
- `Chessboard`
- `PlayerPanel`
- `HistoryPanel`
- `AnalysisPanel`
- `GameControlPanel`

This layer depends on state management. Views and feature components read store state directly and may use small pure local mapping or selector functions for rendering.

## Baseline Route Shape
The committed baseline route map is:

- `/home`
- `/game/:id`
- `/settings`
- `/settings/:category`

Analysis is part of `GameView` in the baseline architecture. A standalone analysis route or dedicated analysis view is not part of the rewrite baseline.

## Module Responsibilities
### Platform Abstraction
- `usePlatformServicesStore` is the only baseline bootstrap seam for wiring concrete platform adapters into the app.
- `StorageAdapter` persists settings, recent-game history, game-session state, UI-layout state, and autosaved saved-game payloads.
- `FileIoAdapter` imports, exports, and reopens raw saved-game documents for the canonical payload defined in [persistence_contract.md](persistence_contract.md).
- `ProcessManager` starts, writes to, reads from, and stops local child processes as defined in [engine_runtime.md](engine_runtime.md).
- `EngineClient` translates ChessVue engine-session operations into the active protocol and uses `ProcessManager` for raw process I/O.
- The first implementation uses mocked `NW.js`-style services behind those adapters so the rewrite can proceed before final desktop host wiring exists.

### Domain Logic
- `GameRuleService` validates and applies moves, resolves promotion choices, and detects terminal game results.
- `MoveUpdateService` manages the move tree, mainline selection, analysis branches, navigation, and pruning.
- `TimeControlService` calculates running time, pause/resume behaviour, timeout, and increment rules.
- `SerializationService` owns the canonical saved game payload shape, schema versioning hooks, and migration entry points.

### State Management
- `GamesStore` owns live game instances and enforces the interaction rules in [state_model.md](state_model.md).
- `AnalysisStore` manages per-game, per-engine analysis snapshots keyed by engine and position.
- `EnginesStore` owns per-game engine assignment, runtime availability state, and engine-session lifecycle coordination.
- `SettingsStore` owns persisted user settings defined in [settings_contract.md](settings_contract.md).
- `RecentGameStore` owns persisted recent-game metadata for `HomeView`, deduped by canonical game identity and refreshed by the latest autosave or manual save target.
- `UiStateStore` owns game-session shell state plus independently persisted UI-layout state such as panel visibility and foldable-section state.
- State stores use `SerializationService` for canonical parse, migration, and serialisation before or after calling storage or file adapters.
- State stores obtain platform interfaces from `usePlatformServicesStore` rather than constructing platform objects directly.

### Presentation
- `HomeView` is the neutral landing screen for launch, no-active-game fallback, and recent-game reopening when recent entries exist.
- `GameView` is the main gameplay workspace and hosts board, players, history, analysis, and controls.
- `SettingsView` edits committed user settings and engine inventory.
- `MenuBar`, `GameTabs`, and `NewGameModal` provide shell-level actions and navigation.
- `Chessboard`, `PlayerPanel`, `HistoryPanel`, `AnalysisPanel`, and `GameControlPanel` render committed game interactions only.
- Presentation may use specialised button families matched to their screen context rather than a single generic button primitive. Baseline contexts include menu toolbar, dialog, home menu, side panel, tab, settings action, and piece-choice buttons.

## Dependency Rules
The dependency direction is fixed:

```text
Platform Abstraction
Domain Logic
State Management -> Domain Logic + Platform Abstraction
Presentation -> State Management
```

Additional rules:

- Domain logic must remain serialisable and testable without desktop APIs.
- Presentation must not implement business rules that belong to the four contracts.
- State stores are the coordination boundary for persistence, engine runtime, and UI-triggered game mutations.
- Views and feature adapters consume store state directly and may shape it with pure local selectors only.
- Narrow domain reads such as `TimeControlService.getRemainingTime` remain allowed when the composing view or store needs an authoritative calculation, but they do not form a separate presentation-helper layer.

## Baseline Behaviour Ownership
The high-level contracts divide behaviour ownership as follows:

- [state_model.md](state_model.md): game contexts, allowed actions, and transitions
- [persistence_contract.md](persistence_contract.md): saved artefacts, schema expectations, restore guarantees
- [engine_runtime.md](engine_runtime.md): desktop UCI runtime, process lifetime, multi-engine rules
- [settings_contract.md](settings_contract.md): authoritative user-editable settings

## Representative Data Flows
### Live Move
1. `Chessboard` emits a move attempt.
2. `GameView` forwards the attempt to `GamesStore`.
3. `GamesStore` validates the action against the active state context.
4. Domain services update move tree, board state, and clocks.
5. `EnginesStore` and `EngineClient` refresh assigned analysis engines when required, and `GamesStore` may request the next engine-controlled live turn when the side to move is assigned to an engine.
6. Autosave persists the updated game workspace, relevant session state, and refreshed recent-game metadata when the saved target for that game changed.

### Analysis Refresh
1. A committed move or explicit analysis action requests evaluation.
2. `EnginesStore` ensures assigned engines are available.
3. `EngineClient` translates the selected position into the active engine protocol and uses `ProcessManager` for raw process I/O.
4. `AnalysisStore` keeps the latest valid result for each engine independently.
5. `AnalysisPanel` renders the newest per-engine results without waiting for synchronised depth, while score-only versus move-list rendering still follows the current workspace context and the game's persisted `showLiveAnalysisMoves` preference.

### Save and Restore
1. `GamesStore`, `RecentGameStore`, and `UiStateStore` produce a canonical saved game payload, recent-games snapshot entry, game-session snapshot, and UI-layout state.
2. `StorageAdapter` persists autosaved state, recent-game metadata, game-session state, and UI-layout state, while `FileIoAdapter` imports, exports, or reopens the same canonical game payload for manual-file flows.
3. `RecentGameStore` keeps at most one recent entry per canonical `gameId`, pointing to the newest autosave or manual-file target.
4. Startup may restore UI-layout state even when settings disable reopening the previous game session. When a game is restored, the app rebuilds the persisted workspace state, then resumes live analysis if engines are available.

## Explicitly Deferred
The following concepts are not part of the baseline architecture and are tracked in [ideas.md](ideas.md):

- browser, mobile, and remote runtime targets
- standalone analysis routes or views
- extra chess variants
- bookmarks and batch workflows
- other speculative study extensions

