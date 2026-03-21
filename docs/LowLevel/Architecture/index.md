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
- [StorageAdapter](PlatformAbstraction/StorageAdapter.md)
- [FileIoAdapter](PlatformAbstraction/FileIoAdapter.md)
- [ProcessManager](PlatformAbstraction/ProcessManager.md)

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
- [UiStateStore](StateManagement/UiStateStore.md)

### 4. Presentation
- [Router](Presentation/Router.md)
- [Interaction Map](Presentation/InteractionMap.md)
- [Views](Presentation/Views/index.md)
- [Components](Presentation/Components/index.md)

### Shared Data Interfaces
- [DataInterface Index](DataInterface/index.md)

## Dependency Rules
The dependency direction is fixed:

```text
Platform Abstraction
Domain Logic
State Management -> Domain Logic + Platform Abstraction
Presentation -> State Management + presentation-safe read helpers
```

Additional rules:

- Presentation components do not own game rules, move-tree mutation, persistence, or engine-process control.
- State stores are the coordination boundary for UI-triggered mutations.
- Domain logic remains serialisable and platform-independent.
- Platform abstraction owns desktop capabilities only; it does not define chess rules or UI state.
- Presentation should prefer shallow composition through well-named self-contained components over deep nested HTML inside views.

## Baseline Route Shape
The low-level design assumes only these routes:

- `/home`
- `/game/:id`
- `/settings`

`GameView` hosts board, players, history, analysis, and game controls. A standalone analysis route or view is out of scope.

## Baseline Data Contracts
The data-interface section defines the shared low-level types for:

- board and move-tree state
- game workspace state axes
- time control and clock snapshots
- engine inventory, assignment, and runtime sessions
- analysis snapshots
- persisted artefacts:
  - settings snapshot
  - session snapshot
  - canonical game document

## Scenario Ownership Summary
- `GamesStore`, `MoveUpdateService`, and `GameRuleService` own move, history, setup, control, and lifecycle scenarios.
- `TimeControlService` and `GamesStore` own timed-game pause, resume, and expiry scenarios.
- `AnalysisStore`, `EnginesStore`, and `ProcessManager` own analysis and engine-runtime scenarios.
- `SettingsStore`, `UiStateStore`, `StorageAdapter`, `FileIoAdapter`, and `SerializationService` own persistence, restore, load, and settings scenarios.
- `Router`, `HomeView`, `GameView`, `SettingsView`, and shell components own route and screen composition only.

## Explicit Non-Baseline Exclusions
The low-level docs do not introduce:

- remote players
- non-UCI protocols
- browser, WASM, or remote engine transports
- standalone analysis views
- engine-vs-engine dedicated modes
- extra chess variants
- dark mode, sound settings, recent-game settings, or mobile layout settings

## Review Checklist
The doc set is aligned only when all of the following are true:

- every `Current` and `Planned` scenario has an owning module
- persisted artefacts match the exact-screen restore contract
- multi-engine analysis is baseline, capped at four concurrent analysis engines per game
- terminology for routes, state axes, result states, and persistence artefacts matches the high-level docs
