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

- `IPlatformService` as the bootstrap-selected host contract
- `StorageAdapter` for generic host storage, file-system, and file-dialog operations
- `ProcessManager` for local child-process lifecycle
- `SystemThemeAdapter` for current OS theme detection
- `EngineClient` for concrete engine-protocol transport

Desktop-first governs the design and implementation contracts. NW.js provides desktop capabilities; browser adapters adapt the same contracts for early browser testing. The ordinary browser app uses persistent browser storage and real file import/download; journey runs inject scripted engine transport.

This layer does not depend on domain, state, or presentation modules.

### Layer 2: Domain Logic
Purpose: hold chess rules, notation and position identity, persisted-document rules, and the domain-facing service contracts consumed by state management.

Committed domain modules:

- `MoveApplicationService`
- `MoveHistoryService`
- `PositionIdentityService`
- `TimeControlService`
- `EngineRuntimeService`
- `SavedGameIndexService`
- `SerializationService`
- `PlatformEventService`
- `UserSettingService`

This layer owns legal move handling, move-tree rules, clock calculation rules, canonical saved-game rules, and the layer-2 service boundaries that hide platform details from state stores.

### Layer 3: State Management
Purpose: coordinate app state, route state, and committed workflows by calling layer-2 services only.

Committed state modules:

- `GamesStore`
- `SavedGamesStore`
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
- Bootstrap selects one `IPlatformService` implementation for the active platform and injects it into the layer-2 service graph.
- `StorageAdapter` exposes generic host storage, file-system, and file-dialog operations only.
- `ProcessManager` starts, restarts, stops, and asserts handle validity for local child processes as defined in [engine_runtime.md](engine_runtime.md).
- `SystemThemeAdapter` exposes the current OS theme only.
- `EngineClient` translates between ChessVue engine structures and the active engine protocol and hides raw engine message formats from higher layers.
  It is consumed through `EngineRuntimeService`, not by layer-3 stores directly.
- `IPlatformService` also owns the small typed app-event registration surface for app close, focus return, and system-theme change notifications plus active-registration inspection.
- Bootstrap defaults to automatic NW.js detection and otherwise selects the browser implementation. An explicit build target may force either host. Browser UCI engines run in dedicated workers, including the bundled Stockfish.js engine, while native executables remain desktop-only. Both hosts share the UCI protocol implementation; scripted engines are injected only by journey bootstrap.

### Domain Logic
- `MoveApplicationService` is the store-facing board-position transition boundary. Move application and direct board edits mutate caller-owned positions in place; only position replay through `genPosition` creates a detached result.
- Pure chess rules and notation mapping live in shared `GameRuleUtility` and `MoveNotationUtility` modules.
- `MoveHistoryService` manages the move tree, mainline selection, analysis branches, navigation, and pruning.
- `PositionIdentityService` owns canonical position identity and equality rules used by analysis, restore, and serialisation workflows.
- `TimeControlService` calculates running time, pause/resume behaviour, timeout, and increment rules.
- `EngineRuntimeService` owns the layer-2 engine runtime boundary used by `GamesStore` for continuous analysis and player-engine turns, composing `ProcessManager` for process lifecycle and `EngineClient` for protocol conversation without same-layer platform calls.
- `SavedGameIndexService` owns ChessVue's save-folder conventions, autosave and named-save path composition, and projection of generic directory entries into logical saved-game groups.
- `SerializationService` owns the canonical persisted payload shapes, current-version checks, the future version-dispatch boundary, schema projection that omits runtime fields before write, and the storage-backed file boundary for settings, session, layout, saved-game read or write, managed-save enumeration, and external import or export picker flows. Version `1` is the first and only current schema; no migration API exists until another schema requires real conversion.
- `PlatformEventService` exposes typed app-level event registration and inspection to state stores without letting layer 3 depend on `IPlatformService` directly.
- `UserSettingService` loads and caches the accepted settings snapshot, validates persisted user settings, applies defaults when recovery is required, exposes the current system theme, and persists accepted settings through `SerializationService` without exposing platform storage directly to layer 3.
- Layer-2 services are the only public lower-layer contracts consumed by state stores. Any platform-backed file, storage, engine, theme, or app-event access reaches state through these layer-2 boundaries rather than by exposing adapters directly to stores.

### State Management
- `GamesStore` owns live/open games, enforces the interaction rules in [state_model.md](state_model.md), coordinates per-game analysis timing and non-local move waiting, stores persisted per-game analysis state, and is the store that saves the current game or loads a saved game into the running session once a concrete target has been chosen.
- `SavedGamesStore` owns saved games for rendering the saved-game menus, route-level internal save/load browsing, external import/export target selection, and saved-game lookup information such as resolving the full file path for a selected managed save or recent target.
- `EnginesStore` owns configured engine profiles and cached discovered-option metadata for profile editing and selection flows; it does not own live runtime coordination or copied in-game engine assignment.
- `SettingsStore` owns user-settings view state, editable user-setting drafts, apply or save coordination, and the presentation-safe appearance projection used by `SettingsView` and shared app chrome; it does not own engine-profile configuration, canonical settings file rules, or raw persisted settings access.
- `RecentGameStore` owns on-demand recent-game projection for `HomeView`, deduped by canonical game identity and derived from the latest available save target when the home screen is opened, but it does not own saved-game file workflows.
- `UiStateStore` owns game-session shell state plus independently persisted UI-layout state such as panel visibility and foldable-section state.
- State stores call only layer-2 services. They do not resolve platform adapters directly, and they do not invoke sibling stores directly.

### Presentation
- `HomeView` is the neutral landing screen for launch, no-active-game fallback, and recent-game reopening when recent entries exist.
- `GameView` is the main gameplay workspace and hosts board, players, history, analysis, and controls.
- `SavedGamesView` is the route-level save/load surface for ChessVue-managed saved games.
- `SettingsView` edits committed user settings through `SettingsStore` and engine profiles through `EnginesStore`.
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
- `GamesStore` must not own saved-game browsing surfaces, grouped save-list state, or route and file-picker selection workflows; those belong to `SavedGamesStore`.
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
2. `GamesStore` decides whether the current game context should start, stop, or refresh analysis.
3. `EngineRuntimeService` starts or reuses the required runtime session through `ProcessManager` and `EngineClient`, with process lifecycle and protocol conversation kept on separate layer-1 boundaries.
4. `GamesStore` keeps the latest valid result for each persisted copied in-game analysis engine independently on the active game.
5. `AnalysisPanel` renders the newest per-engine results without waiting for synchronised depth, while score-only versus move-list rendering still follows the current workspace context and the game's persisted `showLiveAnalysisMoves` preference.

### Save and Restore
1. `GamesStore`, `SavedGamesStore`, `RecentGameStore`, and `UiStateStore` own their separate state responsibilities within the committed persistence flows.
2. `SavedGamesStore` resolves managed-save, recent-entry, and external-file selections into the concrete file paths or destinations needed by the active flow.
3. `GamesStore` supplies the current workspace to save flows and reconstructs a live workspace during load flows, but it does not decide save-list grouping or picker behaviour.
4. Layer-2 persistence services move typed persisted artefacts between state stores and platform storage or file dialogs; state stores do not resolve those adapters directly.
5. `SavedGameIndexService` converts configured save-root rules plus generic directory entries into ChessVue save groups, latest-save targets, and canonical target file paths.
6. `SerializationService` reads or writes settings, session, layout, and saved-game artefacts through caller-supplied paths, enumerates managed-save entries, opens external import or export pickers, and converts persisted documents through the canonical version-check and validation path.
8. `RecentGameStore` derives at most one recent entry per canonical `gameId`, pointing to the newest autosave or saved-file target when `HomeView` requests the list.
9. Startup may restore UI-layout state even when settings disable reopening the previous game session. When a game is restored, the app rebuilds the persisted workspace state, then resumes live analysis if engines are available.

## Explicitly Deferred
The following concepts are not part of the baseline architecture and are tracked in [ideas.md](ideas.md):

- mobile and remote runtime targets
- standalone analysis routes or views
- extra chess variants
- bookmarks and batch workflows
- other speculative study extensions
