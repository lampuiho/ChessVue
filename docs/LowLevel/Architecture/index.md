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
- [ProcessManager](PlatformAbstraction/ProcessManager.md)
- [SystemThemeAdapter](PlatformAbstraction/SystemThemeAdapter.md)
- [EngineClient](PlatformAbstraction/EngineClient.md)

### 2. Domain Logic
- [MoveApplicationService](DomainLogic/MoveApplicationService.md)
- [MoveHistoryService](DomainLogic/MoveHistoryService.md)
- [PositionIdentityService](DomainLogic/PositionIdentityService.md)
- [TimeControlService](DomainLogic/TimeControlService.md)
- [EngineRuntimeService](DomainLogic/EngineRuntimeService.md)
- [SavedGameIndexService](DomainLogic/SavedGameIndexService.md)
- [SerializationService](DomainLogic/SerializationService.md)
- [PlatformEventService](DomainLogic/PlatformEventService.md)
- [UserSettingService](DomainLogic/UserSettingService.md)

### 3. State Management
- [GamesStore](StateManagement/GamesStore.md)
- [SavedGamesStore](StateManagement/SavedGamesStore.md)
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
- [Utility Index](UtilityIndex.md)

## Dependency Rules
The dependency direction is fixed:

```text
Layer 1 Platform Abstraction
Layer 2 Domain Logic -> Layer 1 Platform Abstraction
Layer 3 State Management -> Layer 2 Domain Logic
Layer 4 Presentation -> Layer 3 State Management
```

Additional rules:

- In this doc set, the upper layer is the smaller-numbered layer.
- Each layer may call only the immediately upper layer by number.
- `Layer 4` may coordinate multiple `Layer 3` stores in a single top-level user or route flow.
- Same-layer store calls are forbidden.
- Shared private utilities may be imported like an external library, but they remain invisible in flow ownership, are not public modules, and do not relax adjacency.
- Presentation components do not own game rules, move-tree mutation, persistence, or engine-process control.
- State stores are the coordination boundary for UI-triggered mutations, but they call layer-2 services only.
- State stores do not resolve `IPlatformService`, `StorageAdapter`, `ProcessManager`, `SystemThemeAdapter`, or `EngineClient` directly.
- `GamesStore` owns live/open game behaviour plus active-workspace insertion and hydration; `SavedGamesStore` owns saved-game browsing, saved-document read and write execution, restore lookup, close-trigger autosave registration, and route or dialog target selection.
- Domain logic owns persisted payload rules, document interpretation, notation rules, position identity rules, and the lower-layer service boundaries exposed to layer 3.
- Platform abstraction owns desktop capabilities only; it does not define chess rules or UI state.
- Bootstrap selects one `IPlatformService` implementation and wires it into layer-2 services.
- The rewrite-phase concrete host behaves like mocked `NW.js` services behind `StorageAdapter`, `ProcessManager`, `SystemThemeAdapter`, and `EngineClient`.
- `EngineRuntimeService` owns the game-facing engine runtime boundary, composing `ProcessManager` for process lifecycle and `EngineClient` for protocol translation and parsing. Higher layers do not compose raw UCI strings directly.
- Presentation reads store state directly. Local pure mapping or selector functions may adapt that state for rendering, but there is no separate read-helper subsystem in the baseline.
- Shared imported private utilities that touch committed contract models are documented only in [UtilityIndex.md](UtilityIndex.md) plus the owning module docs that delegate to them. They do not appear as flow-level owners.
- Narrow authoritative reads such as `TimeControlService.getRemainingTime` remain domain calls used by the owning view or store when required by a committed flow.
- Process-flow tables must begin with a concrete callable owner such as a view handler, component handler, router guard, bootstrap function, store public function, or domain-service public function.
- Presentation should prefer shallow composition through well-named self-contained components over deep nested HTML inside views.
- Only common presentation components may own HTML or template markup. Views and feature components are template-free coordinators that connect state, events, and common render building blocks.

## Baseline Route Shape
The low-level design assumes only these routes:

- `/home`
- `/game/:id`
- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`
- `/settings`
- `/settings/:category`

`GameView` hosts board, players, history, analysis, and game controls. `SavedGamesView` hosts the route-level internal save/load surface. A standalone analysis route or view is out of scope.

## Baseline Data Contracts
The data-interface section defines the shared low-level types for:

- board and move-tree state
- game state and result state
- time control and clock snapshots
- engine inventory, assignment, and runtime sessions
- analysis snapshots
- transient modal state
- appearance projection and semantic app-theme variables
- active platform event-registration snapshots
- shared platform failure contracts
- persisted artefacts:
  - settings snapshot
  - game-session snapshot
  - UI-layout state
  - canonical saved-game payload based on `IGame`

## Nullability Convention
- Prefer optional properties over `| null` when the only meaning is "not present". Allowing both `undefined` and `null` for the same absence creates two wire and runtime representations, multiplies branches and compatibility cases, and makes producer mistakes appear valid.
- Prefer `undefined` over `null` for object, array, and lookup-return absence unless the contract needs to distinguish both values explicitly.
- Presence checks for object-like values should normally be truthy or falsy checks rather than explicit `=== null` or `=== undefined` comparisons.
- `nullable().optional()` is not harmless extra tolerance when both values mean the same thing; canonical schemas should output one absence representation. Introduce `null` only when it carries a domain meaning distinct from omission, and document that meaning on the owning contract.

## Decision Documentation Standard
Behaviour alone is not enough for a non-obvious architectural decision. Reasoning must appear immediately beside the contract, rule, mutation flow, or ownership statement it protects—not in a separate rationale document or a distant rationale section. The local explanation must preserve:

- the problem or failure mode that forced the decision
- why the chosen owner and boundary solve that problem
- the plausible alternative that was rejected and how it fails
- the invariant that a replacement must preserve
- any known condition that would justify revisiting the mechanism

This keeps the reasoning in the path of anyone learning or changing the design and prevents a locally attractive refactor from silently reintroducing a system-level bug. A mechanism is not permanent merely because it is documented; a replacement is valid when it addresses the original failure mode and preserves the stated invariant.

## Copy And Identity Policy
- Production copies are justified only at an ownership or trust boundary, to preserve immutable history, to detach a simulation or divergent position, or to stabilise iteration/sorting against caller mutation. A new copy must identify which of those guarantees it provides.
- Defensive cloning by default is rejected because it hides ownership, breaks useful object identity, copies runtime state that may contain callbacks or host objects, and makes mutation costs unpredictable. `structuredClone` is especially unsuitable for canonical game objects with runtime `$` values and purpose-specific class instances.
- Immutable values such as chess-piece identities and timestamp instants may be shared. Mutable containers are copied only when the recipient must be able to mutate independently.
- The invariant is behavioural isolation, not "no copies" or "always copy". Removing a copy is safe only when ownership is already exclusive; adding one is safe only when the new identity does not participate in rendering, runtime lookup, or history-reference semantics.

## Scenario Ownership Summary
- `GamesStore`, `MoveHistoryService`, `MoveApplicationService`, `PositionIdentityService`, and the chess utilities own move, history, setup, control, and lifecycle scenarios.
- `TimeControlService` and `GamesStore` own timed-game pause, resume, and expiry scenarios.
- `GamesStore` owns move timing, non-local turn waiting, analysis coordination, persisted analysis snapshots at layer 3, and copying selected reusable engine profiles into assigned-engine snapshots, `EnginesStore` exposes configured engine profiles for selection flows, and `EngineRuntimeService` owns the lower-layer game-facing engine runtime path by composing `ProcessManager` and `EngineClient`.
- `GamesStore`, `SettingsStore`, `RecentGameStore`, `UiStateStore`, `SavedGamesStore`, `SavedGameIndexService`, `SerializationService`, and `UserSettingService` own persistence, restore, load, home recent-history, and settings scenarios, with `GamesStore` limited to active-workspace insertion, duplicate-id repair, hydration, and gameplay mutation after a payload is already available, `SavedGamesStore` owning saved-document save or load execution plus restore, browse, managed-save deletion, external picker, and close-trigger autosave workflows, `SavedGameIndexService` owning save-folder rules and latest-save selection, `SerializationService` owning canonical payload conversion plus storage-backed persistence I/O and picker boundaries, `UiStateStore` owning session and layout persistence through build-config paths, and `UserSettingService` owning accepted settings validation, caching, persistence, and initial system-theme reads behind the layer-2 boundary.
- `Router`, `HomeView`, `GameView`, `SavedGamesView`, `SettingsView`, and shell components own route and screen composition only.

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
- terminology for routes, game states, result states, and persistence artefacts matches the high-level docs
- no doc describes same-layer store calls or `Layer 3 -> Layer 1` calls
- every process-flow table starts with a concrete callable owner
- shared contract-aware private utilities are inventoried in [UtilityIndex.md](UtilityIndex.md) and remain invisible in process-flow ownership
