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
ChessVue uses a layered architecture with acyclic, strictly adjacent dependencies.

For this document, an "upper" layer is the layer with the smaller number.
That means `Layer 4 -> Layer 3` is valid, `Layer 3 -> Layer 2` is valid, `Layer 3 -> Layer 1` is invalid, and same-layer calls are forbidden.

### Layer 1: Platform Abstraction
Purpose: isolate desktop-specific capabilities behind interfaces that are wired into the layer-2 service graph.

Committed platform modules:

- `usePlatformServicesStore` as the bootstrap seam for concrete platform adapters
- `StorageAdapter` for app-local settings, recent-games, game-session, and UI-layout persistence
- `FileIoAdapter` for generic file-system and file-dialog operations
- `ProcessManager` for local child-process lifecycle and raw stdin/stdout transport
- `SystemThemeAdapter` for OS theme detection and change notifications
- `EngineClient` for concrete engine-protocol transport

During the rewrite phase, these adapters are backed by mocked `NW.js`-style host services rather than final real host bindings.

This layer does not depend on domain, state, or presentation modules.

### Layer 2: Domain Logic
Purpose: hold chess rules, notation and position identity, persisted-document rules, and the domain-facing service contracts consumed by state management.

Committed domain modules:

- `GameRuleService`
- `MoveNotationService`
- `MoveUpdateService`
- `PositionIdentityService`
- `TimeControlService`
- `SavedGameIndexService`
- `SerializationService`

This layer owns legal move handling, move-tree rules, clock calculation rules, canonical saved-game rules, and the layer-2 service boundaries that hide platform details from state stores.

### Layer 3: State Management
Purpose: coordinate app state, route state, and committed workflows by calling layer-2 services only.

Committed state modules:

- `GamesStore`
- `SavedGamesStore`
- `AnalysisStore`
- `EnginesStore`
- `SettingsStore`
- `RecentGameStore`
- `UiStateStore`

This layer depends only on domain logic.

### Layer 4: Presentation
Purpose: render the app shell, views, and interactive UI.

Committed presentation modules:

- `Router`
- `HomeView`
- `GameView`
- `SavedGamesView`
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
- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`
- `/settings`
- `/settings/:category`

Analysis is part of `GameView` in the baseline architecture. A standalone analysis route or dedicated analysis view is not part of the rewrite baseline.

## Module Responsibilities
### Platform Abstraction
- `usePlatformServicesStore` is the bootstrap-only seam for wiring concrete platform adapters into the app and then into the layer-2 service graph.
- `StorageAdapter` persists settings, recent-game history, game-session state, and UI-layout state only.
- `FileIoAdapter` exposes generic file-system and file-dialog operations only.
- `ProcessManager` starts, writes to, reads from, and stops local child processes as defined in [engine_runtime.md](engine_runtime.md).
- `SystemThemeAdapter` exposes the current OS theme and change notifications only.
- `EngineClient` translates ChessVue engine-session operations into the active protocol and hides raw engine message formats from higher layers.
- The first implementation uses mocked `NW.js`-style services behind those adapters so the rewrite can proceed before final desktop host wiring exists.

### Domain Logic
- `GameRuleService` validates and applies moves, resolves promotion choices, and detects terminal game results.
- `MoveNotationService` owns notation mapping needed by committed gameplay, history, and engine-facing workflows.
- `MoveUpdateService` manages the move tree, mainline selection, analysis branches, navigation, and pruning.
- `PositionIdentityService` owns canonical position identity and equality rules used by analysis, restore, and serialisation workflows.
- `TimeControlService` calculates running time, pause/resume behaviour, timeout, and increment rules.
- `SavedGameIndexService` owns ChessVue's save-folder conventions, autosave and named-save path composition, and projection of generic directory entries into logical saved-game groups.
- `SerializationService` owns the canonical saved-game payload shape, schema versioning hooks, migration entry points, settings and session serialisation, and saved-game document interpretation for internal save/load plus external import/export flows.
- Layer-2 services are the only public lower-layer contracts consumed by state stores. Any platform-backed file, storage, engine, or theme access reaches state through these layer-2 boundaries rather than by exposing adapters directly to stores.

### State Management
- `GamesStore` owns only live/open game workspaces and enforces the interaction rules in [state_model.md](state_model.md).
- `SavedGamesStore` owns autosave, route-level internal save/load browsing, external import/export, and saved-game restore orchestration.
- `AnalysisStore` manages per-game, per-engine analysis snapshots keyed by engine and position.
- `EnginesStore` owns per-game engine assignment, runtime availability state, and engine-session lifecycle coordination.
- `SettingsStore` owns persisted user settings defined in [settings_contract.md](settings_contract.md).
- `RecentGameStore` owns persisted recent-game metadata for `HomeView`, deduped by canonical game identity and refreshed by the latest autosave or saved-file target, but it does not own saved-game file workflows.
- `UiStateStore` owns game-session shell state plus independently persisted UI-layout state such as panel visibility and foldable-section state.
- State stores call only layer-2 services. They do not resolve platform adapters directly, and they do not invoke sibling stores directly.

### Presentation
- `HomeView` is the neutral landing screen for launch, no-active-game fallback, and recent-game reopening when recent entries exist.
- `GameView` is the main gameplay workspace and hosts board, players, history, analysis, and controls.
- `SavedGamesView` is the route-level save/load surface for ChessVue-managed saved games.
- `SettingsView` edits committed user settings and engine inventory.
- `MenuBar`, `GameTabs`, and `NewGameModal` provide shell-level actions and navigation.
- `Chessboard`, `PlayerPanel`, `HistoryPanel`, `AnalysisPanel`, and `GameControlPanel` render committed game interactions only.
- Presentation may use specialised button families matched to their screen context rather than a single generic button primitive. Baseline contexts include menu toolbar, dialog, home menu, side panel, tab, settings action, and piece-choice buttons.

## Dependency Rules
The dependency direction is fixed:

```text
Layer 1 Platform Abstraction
Layer 2 Domain Logic -> Layer 1 Platform Abstraction
Layer 3 State Management -> Layer 2 Domain Logic
Layer 4 Presentation -> Layer 3 State Management
```

Additional rules:

- Each layer may call only the immediately upper layer by number.
- Same-layer calls are forbidden.
- Shared private utilities may be imported like an external library, but they remain private implementation only and do not relax adjacency or create new public dependencies.
- Domain logic remains UI-free and owns the lower-layer service contracts consumed by state stores.
- Presentation must not implement business rules that belong to the four contracts.
- State stores are the coordination boundary for UI-triggered game mutations, but they do that work only through layer-2 services.
- `GamesStore` must not own saved-game browsing, save-folder interpretation, or import/export orchestration; those belong to `SavedGamesStore`.
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
4. Layer-2 game services update move tree, board state, notation, position identity, and clocks.
5. When the committed workflow needs engine refresh or an engine-controlled live turn, the responsible state workflow reaches that lower-layer engine path through layer-2 services only.
6. Autosave updates only the dedicated internal autosave entry when the configured ply threshold or close trigger fires; settings, session state, and layout state remain separate persisted artefacts.

### Analysis Refresh
1. A committed move or explicit analysis action requests evaluation.
2. `EnginesStore` ensures assigned engines are available.
3. The layer-2 engine-facing path translates the selected position into the active engine protocol and uses platform process transport.
4. `AnalysisStore` keeps the latest valid result for each engine independently.
5. `AnalysisPanel` renders the newest per-engine results without waiting for synchronised depth, while score-only versus move-list rendering still follows the current workspace context and the game's persisted `showLiveAnalysisMoves` preference.

### Save and Restore
1. `SavedGamesStore`, `RecentGameStore`, and `UiStateStore` own their separate state responsibilities within the committed persistence flows.
2. `GamesStore` supplies or accepts live/open game workspaces, but it does not decide save-folder structure or file workflows.
3. Layer-2 persistence services serialise, locate, and interpret saved documents, then use platform storage or file adapters as needed; state stores do not resolve those adapters directly.
4. `SavedGameIndexService` converts configured save-root rules plus generic directory entries into ChessVue save groups, latest-save targets, and canonical target file paths.
5. `SerializationService` converts between raw save-file documents and canonical game payloads, including format detection and migration.
6. `RecentGameStore` keeps at most one recent entry per canonical `gameId`, pointing to the newest autosave or saved-file target.
7. Startup may restore UI-layout state even when settings disable reopening the previous game session. When a game is restored, the app rebuilds the persisted workspace state, then resumes live analysis if engines are available.

## Explicitly Deferred
The following concepts are not part of the baseline architecture and are tracked in [ideas.md](ideas.md):

- browser, mobile, and remote runtime targets
- standalone analysis routes or views
- extra chess variants
- bookmarks and batch workflows
- other speculative study extensions
