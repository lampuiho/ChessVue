# ChessVue Low-Level Architecture

## Purpose
This folder defines the committed low-level design for the ChessVue rewrite baseline.

It derives only from the high-level baseline documents in `docs/HighLevel`:

- `plan.md`
- `architecture.md`
- `scenarios.md` for `Current` and `Planned` only
- `state_model.md`
- `persistence_contract.md`
- `engine_runtime.md`
- `settings_contract.md`
- `build_settings.md`
- `user_settings.md`

`ideas.md` is not a low-level input.

## Layer Map
### 1. Platform Abstraction
- [PlatformServices](PlatformAbstraction/PlatformServices.md)
- [StorageAdapter](PlatformAbstraction/StorageAdapter.md)
- [FileIoAdapter](PlatformAbstraction/FileIoAdapter.md)
- [ProcessManager](PlatformAbstraction/ProcessManager.md)
- [SystemThemeAdapter](PlatformAbstraction/SystemThemeAdapter.md)
- [EngineClient](PlatformAbstraction/EngineClient.md)

### 2. Domain Logic
- [GameRuleService](DomainLogic/GameRuleService.md)
- [MoveUpdateService](DomainLogic/MoveUpdateService.md)
- [TimeControlService](DomainLogic/TimeControlService.md)
- [SerializationService](DomainLogic/SerializationService.md)

### 3. State Management
- [GamesStore](StateManagement/GamesStore.md)
- [AnalysisStore](StateManagement/AnalysisStore.md)
- [EnginesStore](StateManagement/EnginesStore.md)
- [SettingsStore](StateManagement/SettingsStore.md)
- [RecentGameStore](StateManagement/RecentGameStore.md)
- [UiStateStore](StateManagement/UiStateStore.md)

### 4. Presentation
- [Router](Presentation/Router.md)
- [Interaction Map](Presentation/InteractionMap.md)
- [Views](Presentation/Views/index.md)
- [Components](Presentation/Components/index.md)

### 5. Process Flows
- [Process Flow Index](../ProcessFlows/index.md)

### Shared Data Interfaces
- [DataInterface Index](DataInterface/index.md)

## Dependency Rules
The dependency direction is fixed:

```text
Platform Abstraction
Domain Logic
State Management -> Domain Logic + Platform Abstraction
Presentation -> State Management
```

Additional rules:

- Presentation components do not own game rules, move-tree mutation, persistence, or engine-process control.
- State stores are the coordination boundary for UI-triggered mutations.
- Domain logic remains serialisable and platform-independent.
- Platform abstraction owns desktop capabilities only; it does not define chess rules or UI state.
- `usePlatformServicesStore()` is the only baseline bootstrap seam for injecting concrete platform adapters into the app.
- The rewrite-phase concrete host behaves like mocked `NW.js` services behind `StorageAdapter`, `FileIoAdapter`, and `ProcessManager`.
- The StateManagement layer obtains platform interfaces from `PlatformServices` rather than constructing them directly.
- `EngineClient` owns protocol translation and engine-session messaging on top of `ProcessManager`; stores do not compose raw UCI strings themselves.
- Presentation reads store state directly. Local pure mapping or selector functions may adapt that state for rendering, but there is no separate read-helper subsystem in the baseline.
- Narrow authoritative reads such as `TimeControlService.getRemainingTime` remain domain calls used by the owning view or store when required by a committed flow.
- Presentation should prefer shallow composition through well-named self-contained components over deep nested HTML inside views.
- Only common presentation components may own HTML or template markup. Views and feature components are template-free coordinators that connect state, events, and common render building blocks.

## Baseline Route Shape
The low-level design assumes only these routes:

- `/home`
- `/game/:id`
- `/settings`
- `/settings/:category`

`GameView` hosts board, players, history, analysis, and game controls. A standalone analysis route or view is out of scope.

## Baseline Data Contracts
The data-interface section defines the shared low-level types for:

- board and move-tree state
- game workspace state axes
- time control and clock snapshots
- engine inventory, assignment, and runtime sessions
- analysis snapshots
- transient modal state
- appearance projection and semantic app-theme variables
- shared platform failure contracts
- persisted artefacts:
  - settings snapshot
  - game-session snapshot
  - UI-layout state
  - recent-games snapshot
  - canonical saved-game payload based on `IGameWorkspace`

## Scenario Ownership Summary
- `GamesStore`, `MoveUpdateService`, and `GameRuleService` own move, history, setup, control, and lifecycle scenarios.
- `TimeControlService` and `GamesStore` own timed-game pause, resume, and expiry scenarios.
- `AnalysisStore` owns streamed evaluation state and visible analysis snapshots.
- `EnginesStore` and `EngineClient` own analysis and player-engine runtime control, while `ProcessManager` owns raw process lifecycle and I/O.
- `SettingsStore`, `RecentGameStore`, `UiStateStore`, `StorageAdapter`, `FileIoAdapter`, and `SerializationService` own persistence, restore, load, home recent-history, and settings scenarios.
- `Router`, `HomeView`, `GameView`, `SettingsView`, and shell components own route and screen composition only.

## Explicit Non-Baseline Exclusions
The low-level docs do not introduce:

- remote players
- non-UCI protocols
- browser, WASM, or remote engine transports
- standalone analysis views
- extra chess variants
- user-created custom themes, sound settings, recent-game settings, or mobile layout settings

## Review Checklist
The doc set is aligned only when all of the following are true:

- every `Current` and `Planned` scenario has an owning module
- persisted artefacts match the saved-game and settings ownership contracts
- multi-engine analysis is baseline, capped at four concurrent analysis engines per game
- terminology for routes, state axes, result states, and persistence artefacts matches the high-level docs
