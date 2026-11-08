# ChessVue Baseline Architecture

## Purpose
This document defines the committed high-level architecture as implemented.

The baseline is:

- `All Planned`
- `desktop-first` design, implemented for NW.js desktop and browser targets
- `multi-engine now`

`Idea` items are intentionally excluded from this document and are tracked in [ideas.md](ideas.md).

## Architectural Rule
Low-level design and implementation depend only on:

- this document
- [scenarios.md](scenarios.md) for `Current` and `Planned` behaviour
- [state_model.md](state_model.md)
- [persistence_contract.md](persistence_contract.md)
- [engine_runtime.md](engine_runtime.md)
- [settings_contract.md](settings_contract.md)
- [build_settings.md](build_settings.md)
- [user_settings.md](user_settings.md)

Nothing from [ideas.md](ideas.md) is promoted without a separate high-level decision.

## Layer Model
ChessVue uses a layered architecture with acyclic, adjacent dependencies.

For this document, an "upper" layer is the layer with the smaller number.
That means `Layer 4 -> Layer 3` is valid, `Layer 3 -> Layer 2` is valid and `Layer 3 -> Layer 1` is invalid. The documented exceptions are listed under [Dependency Rules](#dependency-rules).

### Layer 1: Platform Abstraction
Purpose: isolate host capabilities behind interfaces that layer-2 services reach through `usePlatformService()`.

Platform contracts live in `src/contracts/platform`:

- `IPlatformService`: the host contract and typed app-event registration surface
- `IStorageAdapter`: generic host storage, file-system and file-dialog operations
- `IProcessManager` and `IProcess`: engine process or worker lifecycle
- `ISystemThemeAdapter`: current OS theme
- `IEngineClient`: engine-protocol conversation over an `IProcess`

Implementations:

| Target | Platform store | Storage | Engine bindings by `EngineClientType` | Theme |
| --- | --- | --- | --- | --- |
| NW.js (`src/platform/nwjs`) | `defineNwjsPlatformServiceStore(nw)` | `NwjsStorageAdapter` (Node file system and NW.js file dialogs) | `Uci`: `NwjsProcessManager` + `NwjsUciEngineClient`; `UciWorker`: a second `NwjsProcessManager` + `BrowserUciEngineClient` | `NwjsSystemThemeAdapter` |
| Browser (`src/platform/browser`) | `useBrowserPlatformService` | `BrowserStorageAdapter` over `BrowserFileSystem` (Web Storage), file input import and download export | `UciWorker`: `BrowserProcessManager` + `BrowserUciEngineClient`; `Uci` only when journey bootstrap injects scripted services | `BrowserSystemThemeAdapter` |

Shared implementation support in `src/platform/base` is `UciEngineClientBase`, which owns UCI sessions, handshake, options, analysis, player turns and pondering, and `WorkerProcessManagerBase`, which owns worker creation, liveness, stop, restart and disposal. Both process managers derive the worker base; both UCI clients derive the client base and supply only process-liveness and exit-detail hooks. Worker processes use the private utilities `BrowserWorkerProcess` (adapts a `Worker` to `IProcess`) and `WorkerScriptLoader` (loads app-served or stored package scripts and their assets into a dedicated worker).

**Why one binding table keyed by `EngineClientType`:** an earlier browser design had the engine client look up a transport inside the process manager's registry, a sibling dependency that violated the platform boundary and returned a raw `Worker` asserted as `IProcess`. Each platform store now builds one table that pairs a client with its matching lifecycle backend, and an assignment's copied `clientType` selects both. The returned `IProcess` is stored on the assignment and passed back to the same pair, so no process registry, transport resolver or independent switch exists. A replacement must keep client and lifecycle selection on the same key and must not reintroduce manager-client lookups. Revisit when a non-UCI protocol or remote transport is introduced. See the archived [browser engine dependency correction](../ArchivedPlans/BrowserEngineDependencyFixPlan.md) and [engine package rework](../ArchivedPlans/EngineInstallationReworkPlan.md#mixed-runtime-and-ui).

This layer does not depend on domain, state, or presentation modules.

### Layer 2: Domain Logic
Purpose: hold chess rules, notation and position identity, persisted-document rules, and the domain-facing service contracts consumed by state management.

Domain modules (`src/domain`):

- `MoveApplicationService`
- `MoveHistoryService`
- `PositionIdentityService`
- `TimeControlService`
- `EngineRuntimeService`
- `EnginePackageService`
- `SavedGameIndexService`
- `SerializationService`
- `PlatformEventService`
- `UserSettingService`

This layer owns legal move handling, move-tree rules, clock calculation rules, canonical saved-game rules, engine package storage, and the layer-2 service boundaries that hide platform details from state stores.

### Layer 3: State Management
Purpose: coordinate app state, route state, and committed workflows by calling layer-2 services.

State stores (`src/state`):

- `GamesStore`
- `SavedGamesStore`
- `EnginesStore`
- `SettingsStore`
- `RecentGameStore`
- `UiStateStore`

`GamesStore` is composed from private game composables in `src/state/game`: `useGamePosition`, `useGameRecord`, `useGamePremove`, `useGameTurnRuntime`, `useGameStatus`, `useGameAnalysis`, `useGameClock`, `useGameMove`, `useGamePlayerTurn`, `useGameBoardEdit` and `useGameWorkspace`. Each composable receives whole lower composable objects; the store root coordinates only the calls whose implementation would otherwise form a cycle (move intake, history rewrite, takeback, navigation and exit wrappers, resume, resignation and draw acceptance) and otherwise returns the composables' methods as aliases.

**Why whole-object composables with store-root coordination:** the earlier single store and its injected callback signatures hid cyclic calls such as player-turn committing through move while move requested the next player turn. The restructuring cut only those edges, giving 11 composables with acyclic whole-object dependencies; the lower `useGameTurnRuntime` owns turn cancellation so the clock no longer depends on the turn driver. A replacement must keep the composable graph acyclic and must not hide cycles behind late setters, callback injection or forwarding objects. See the archived [store dependency restructuring plan](../ArchivedPlans/StoreDependencyRestructuringPlan.md).

This layer depends only on domain logic, with the exception noted under [Dependency Rules](#dependency-rules).

### Layer 4: Presentation
Purpose: render the app shell, views, and interactive UI.

Presentation modules:

- `Router` and `App`
- views: `HomeView`, `GameView`, `SavedGamesView`, `SettingsView`, `EngineProfileView`, `EnginePackageImportView`, `EnginePackageDetailsView`
- feature components: `MenuBar`, `NavigationFrame`, `GameTabs`, `Chessboard`, `PlayerPanel`, `HistoryPanel`, `AnalysisPanel`, `GameControlPanel`, `GamePlayerField`, `GameClockFields`, `AnalysisSnapshotFields`
- common components: `AppIcon`, `ChessPiece`, `ControlButton`, `ExpandableText`
- modals: the shared `ModalDialog` shell plus `AnalysisEngineSelectionModal`, `ConfirmationModal`, `DrawResponseModal`, `GameCreationModal`, `GameResultModal`, `MessageModal`, `NavigationMenuModal`, `PlayerSelectionModal` and `PromotionModal`
- composables and directives: `useModalProvider`/`useModal`, `useModalAction`, `useGameTabActions`, `useQuickGame` and `vFocusScope`

This layer depends on state management. Views and feature components read store state directly and may use small pure local mapping or selector functions for rendering. Feature components read their own game state by `gameId` and call stores for actions they own; `GameView` keeps workflows that own a rendered input context, line playback, historical continuation or Menu interruption. See the archived [component simplification plan](../ArchivedPlans/ComponentSimplificationPlan.md) and the [presentation docs](../LowLevel/Architecture/Presentation/index.md).

## Baseline Route Shape
The route map in `src/router/index.ts` is:

- `/` redirects to `/home`
- `/home`
- `/game/:id`
- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`
- `/settings` redirects to `/settings/session`
- `/settings/:category`, where `category` is `session`, `gameplay`, `appearance` or `engines`
- engine children rendered inside `SettingsView` for the `engines` category:
  - `/settings/engines/profiles/new`
  - `/settings/engines/profiles/:profileId/edit`
  - `/settings/engines/profiles/:profileId/copy`
  - `/settings/engines/packages/import`
  - `/settings/engines/packages/details` (the package is selected by the `packagePath` query)
- any other path redirects to `/home`

Engine profile and package screens are routed children rather than modals so direct links, reload and browser Back/Forward work without opening the overview first; see the archived [engine management UI design](../ArchivedPlans/EngineManagementUiDesign.md). Only the top-level routes are remembered in the game session; see [persistence_contract.md](persistence_contract.md).

Analysis is part of `GameView`. A standalone analysis route or dedicated analysis view is not part of the baseline.

## Module Responsibilities
### Platform Abstraction
- `usePlatformService()` (`src/platform/PlatformService.ts`) selects one platform store through `getPlatformTarget()`. The build-time `CHESSVUE_PLATFORM` value is `auto` by default, which selects NW.js when the NW.js runtime is present and the browser otherwise; `nwjs` and `browser` force a target. See [build_settings.md](build_settings.md).
- `IStorageAdapter` exposes generic host storage, file-system and file-dialog operations only.
- `IProcessManager` starts, restarts, stops, and asserts handle validity for engine processes or workers as defined in [engine_runtime.md](engine_runtime.md).
- `ISystemThemeAdapter` exposes the current OS theme only. App styling does not query or subscribe to it; CSS `color-scheme` and `light-dark()` follow the OS theme, as described in [ui_layout.md](ui_layout.md#styling-ownership).
- `IEngineClient` translates between ChessVue engine structures and UCI and hides raw engine messages from higher layers. It is consumed through `EngineRuntimeService`, not by layer-3 stores directly.
- `IPlatformService` owns the typed app-event registration surface for app close, focus return and system-theme change plus active-registration inspection. NW.js raises close from the window close request and awaits the registered callbacks. The browser raises the same callbacks as a best-effort checkpoint on `pagehide` and when the document becomes hidden, because a tab cannot await asynchronous shutdown.
- Journey bootstrap calls `setBrowserPlatformOptions` before creating stores to supply isolated sessionStorage, a run-specific storage key and scripted UCI services.

### Domain Logic
- `MoveApplicationService` is the store-facing board-position transition boundary. Move application and direct board edits mutate caller-owned positions in place; only position replay through `genPosition` creates a detached result.
- Pure chess rules and notation mapping live in shared `GameRuleUtility` and `MoveNotationUtility` modules.
- `MoveHistoryService` manages the move tree, mainline selection, analysis branches, navigation, and pruning.
- `PositionIdentityService` owns canonical position identity and equality rules. It currently has no production caller (only `src/domain/index.ts` re-exports it and its tests exercise it); analysis, restore and serialisation do not depend on it.
- `TimeControlService` calculates running time, pause/resume behaviour, timeout, and increment rules.
- `EngineRuntimeService` owns the engine runtime boundary used by `GamesStore` for continuous analysis and player-engine turns and by `EnginesStore` for temporary option discovery. It selects the `IProcessManager` and `IEngineClient` for the engine's `clientType` and validates engine results before they reach game state.
- `EnginePackageService` owns browser engine packages: listing the bundled Stockfish folder and imported folders, reading and validating ZIP archives, storing package files and removing unreferenced imported folders. Package storage uses a private `WorkerScriptLoader` instance over IndexedDB; installation and removal are available only on the browser target. It also exposes `browseEngineFile`, which delegates to the storage adapter's open dialog.
- `SavedGameIndexService` owns ChessVue's save-folder conventions, autosave and named-save path composition, and projection of generic directory entries into logical saved-game groups.
- `SerializationService` owns the canonical persisted payload shapes, current-version checks, the future version-dispatch boundary, schema projection that omits runtime fields before write, and the storage-backed file boundary for game-session, UI-layout and saved-game documents, managed-save enumeration, and external import or export picker flows. Version `1` is the first and only current schema; no migration API exists until another schema requires real conversion.
- `PlatformEventService` exposes typed app-level event registration and inspection to state stores without letting layer 3 depend on `IPlatformService` directly.
- `UserSettingService` loads and caches the accepted settings snapshot, validates persisted user settings, applies defaults and coercions, and reads and writes the settings document at the build-config path through the storage adapter. It also exposes `getSystemTheme`, which app styling does not use.
- Layer-2 services are the only public lower-layer contracts consumed by state stores. Platform-backed file, storage, engine, theme, or app-event access reaches state through these boundaries rather than by exposing adapters directly to stores.

### State Management
- `GamesStore` owns live/open games, enforces the interaction rules in [state_model.md](state_model.md), coordinates per-game analysis, premoves and non-local move waiting, stores persisted per-game analysis state, and inserts and hydrates a game into the workspace once a payload is available. It counts committed moves and queues move-count autosaves through `SavedGamesStore.saveGame`; it does not resolve save paths, browse saves or read save documents.
- `SavedGamesStore` owns saved-game browsing data, saved-document read and write execution for autosave, managed saves and external files, targeted startup restore lookup, managed-save deletion, external import/export picker flows and close-trigger autosave registration.
- `EnginesStore` owns access to configured engine profiles, cached discovered-option metadata for profile editing, and the engine package list and its install/remove queue; it does not own live runtime coordination or copied in-game engine assignment.
- `SettingsStore` owns the accepted settings snapshot, the editable settings draft shared across settings categories and engine child views, apply/save/reset coordination, dirty-state detection, and the appearance projection used by `App`; it does not own canonical settings file rules or raw persisted settings access.
- `RecentGameStore` owns on-demand recent-game projection for `HomeView`, deduped by canonical game identity and derived from the latest available save target when the home screen is opened, but it does not own saved-game file workflows.
- `UiStateStore` owns game-session shell state, independently persisted UI-layout state such as panel visibility and fold state, recovery warnings shown by `App`, and the transient navigation-rail expansion preference.

### Presentation
- `App` restores startup state, applies accepted appearance, saves the game session after committed route changes and shows recovery warnings.
- `HomeView` is the neutral landing screen for launch, no-active-game fallback, and recent-game reopening when recent entries exist.
- `GameView` is the main gameplay workspace and hosts board, players, history, analysis, and controls.
- `SavedGamesView` is the route-level save/load/import/export surface for ChessVue-managed saved games.
- `SettingsView` edits user settings, including the engine profile inventory, through the `SettingsStore` draft and shows engine packages through `EnginesStore`; its routed engine children edit profiles in the settings draft, import packages and show package details.
- `MenuBar`, `NavigationFrame` and `GameTabs` provide shell-level actions and navigation. `GameCreationModal` creates games and starts prepared positions.
- `Chessboard`, `PlayerPanel`, `HistoryPanel`, `AnalysisPanel`, and `GameControlPanel` render committed game interactions only.
- Shared visual primitives are global CSS classes with explicit variants (for example menu, text, icon, control and tab buttons and action cards), selected in templates, rather than a family of button components. `ControlButton` is the only button component. See [ui_layout.md](ui_layout.md#styling-ownership).

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
- Same-layer store calls are forbidden. The one existing exception is autosave: `useGameRecord` lazily calls `useSavedGamesStore().saveGame` inside its queued autosave. The [store dependency restructuring](../ArchivedPlans/StoreDependencyRestructuringPlan.md#outbound-dependencies) retained this call unchanged; the rationale for keeping it in a game composable rather than in a layer-2 boundary is not recorded.
- Domain services do not call each other's storage, runtime or platform-backed operations. `EngineRuntimeService` does use `MoveApplicationService` position replay for its engine-result legality and pondering checks; the rationale for that same-layer call rather than the shared chess utilities is not recorded.
- Shared private utilities may be imported like an external library, but they remain private implementation only and do not relax adjacency or create new public dependencies.
- Domain logic remains UI-free and owns the lower-layer service contracts consumed by state stores.
- Presentation must not implement business rules that belong to the four contracts.
- State stores are the coordination boundary for UI-triggered game mutations, but they do that work only through layer-2 services. Stores do not resolve platform adapters directly.
- `GamesStore` must not own saved-game browsing surfaces, grouped save-list state, or route and file-picker selection workflows; those belong to `SavedGamesStore`.
- Views and feature components consume store state directly and may shape it with pure local selectors only.
- Narrow authoritative domain reads remain allowed when the composing view needs them: `GameView`, `SavedGamesView` and `GameControlPanel` replay positions through `MoveApplicationService.genPosition` and `MoveHistoryService.getMoveSequence`, `GameView` reads `TimeControlService.getRemainingTime`, and `SavedGamesView` reads `SavedGameIndexService.getLatestSaveEntry`. They do not form a separate presentation-helper layer.
- `GameView` creates its own `useGamePosition()` instance to project queued premoves onto the displayed board (`getPremoveProjection`). The archived [premove plan](../ArchivedPlans/PreMovePlan%28ToDo%29.md) chose this as a pure detached query with no queue mutation; it bypasses the `useGamesStore` façade and is not a pattern to copy.
- Quick game (`useQuickGame`) and `GameCreationModal` call `EngineRuntimeService.getOptions` directly to check that required player engines can start before a game is created. The archived [modal component design](../ArchivedPlans/ModalComponentDesign.md) retained this existing check and the [quick game defaults design](../ArchivedPlans/QuickGameDefaultsDesign.md) reused it. It is an open exception: it starts a temporary engine runtime rather than performing a narrow read, and `EnginesStore` is the adjacent layer-3 owner of option discovery.
- Async work has an explicit owner that prevents duplicate starts and cancels or settles superseded work at its action or lifecycle boundary. Watchers, `watchEffect` and generation, epoch or sequence counters are not used; effects run from explicit actions, component events, lifecycle hooks or router hooks. `npm run check:code` enforces this. See the archived [code cleanup plan](../ArchivedPlans/CodeCleanupPlan.md) and [workspace revision removal plan](../ArchivedPlans/WorkspaceRevisionRemovalPlan.md).

## Baseline Behaviour Ownership
The high-level contracts divide behaviour ownership as follows:

- [state_model.md](state_model.md): game contexts, allowed actions, and transitions
- [persistence_contract.md](persistence_contract.md): saved artefacts, schema expectations, restore guarantees
- [engine_runtime.md](engine_runtime.md): UCI runtime for desktop processes and browser workers, engine packages, multi-engine rules
- [settings_contract.md](settings_contract.md): authoritative user-editable settings

## Representative Data Flows
### Live Move
1. `Chessboard` emits a move attempt.
2. `GameView` checks its rendered input context and forwards the attempt to `GamesStore.makeMove`.
3. `GamesStore` validates the action against the active state context. A move by the local side while an engine is to move is queued as a premove instead.
4. Layer-2 game services update move tree, board state, notation, position identity, and clocks.
5. When the committed workflow needs engine refresh or an engine-controlled live turn, the responsible state workflow reaches that lower-layer engine path through layer-2 services only.
6. Autosave writes only the dedicated internal autosave entry when the configured ply threshold or close trigger fires; settings, session state, and layout state remain separate persisted artefacts.

### Analysis Refresh
1. A committed move or explicit analysis action requests evaluation.
2. `GamesStore` decides whether the current game context should start, stop, or refresh analysis.
3. `EngineRuntimeService` starts or reuses the required runtime session through the `IProcessManager` and `IEngineClient` bound to the engine's `clientType`, keeping process lifecycle and protocol conversation on separate layer-1 boundaries.
4. `GamesStore` keeps the latest valid result for each persisted copied in-game analysis engine independently on the active game.
5. `AnalysisPanel` renders the newest per-engine results without waiting for synchronised depth; score-only versus move-list rendering follows the game context and its persisted `showLiveAnalysisMoves` preference.

### Save and Restore
1. `GamesStore`, `SavedGamesStore`, `RecentGameStore`, and `UiStateStore` own their separate state responsibilities within the persistence flows.
2. `SavedGamesStore` resolves managed-save, recent-entry, and external-file selections into the concrete file paths or destinations needed by the active flow and performs the read or write.
3. `GamesStore` supplies the current workspace game to save flows and reconstructs a live workspace from a loaded payload through `insertGame`, but it does not decide save-list grouping or picker behaviour.
4. Layer-2 persistence services move typed persisted artefacts between state stores and platform storage or file dialogs; state stores do not resolve those adapters directly.
5. `SavedGameIndexService` converts configured save-root rules plus generic directory entries into ChessVue save groups, latest-save targets, and canonical target file paths.
6. `SerializationService` reads or writes session, layout, and saved-game artefacts through caller-supplied paths, enumerates managed-save entries, opens external import or export pickers, and converts persisted documents through the canonical version-check and validation path. `UserSettingService` does the same for the settings document.
7. `RecentGameStore` derives at most one recent entry per canonical `gameId`, pointing to the newest autosave or saved-file target when `HomeView` requests the list.
8. Startup may restore UI-layout state even when settings disable reopening the previous game session. When a game is restored, `App` inserts the persisted workspace, then live analysis resumes if the setting allows it and engines are available.

## Explicitly Deferred
The following concepts are not part of the baseline architecture and are tracked in [ideas.md](ideas.md):

- remote engine services and additional host shells or mobile packaging
- standalone analysis routes or views
- extra chess variants
- bookmarks and batch workflows
- other speculative study extensions
