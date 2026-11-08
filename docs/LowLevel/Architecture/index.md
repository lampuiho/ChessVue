# ChessVue Low-Level Architecture

## Purpose
This folder defines the committed low-level design for ChessVue as implemented.

It derives from the high-level baseline documents in `docs/HighLevel`:

- `plan.md`
- `architecture.md`
- `ui_layout.md`
- `scenarios.md` for `Current` and `Planned` only
- `state_model.md`
- `persistence_contract.md`
- `engine_runtime.md`
- `settings_contract.md`
- `build_settings.md`
- `user_settings.md`

`ideas.md` is not a low-level input. `docs/ArchivedPlans` are historical implementation records, not inputs; module docs link to them where the detailed rationale for an implemented change lives.

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
- [EnginePackageService](DomainLogic/EnginePackageService.md)
- [SavedGameIndexService](DomainLogic/SavedGameIndexService.md)
- [SerializationService](DomainLogic/SerializationService.md)
- [PlatformEventService](DomainLogic/PlatformEventService.md)
- [UserSettingService](DomainLogic/UserSettingService.md)

### 3. State Management
- [GamesStore](StateManagement/GamesStore.md), a façade over the private composables in `src/state/game/*Composable.ts`
- [SavedGamesStore](StateManagement/SavedGamesStore.md)
- [EnginesStore](StateManagement/EnginesStore.md)
- [SettingsStore](StateManagement/SettingsStore.md)
- [RecentGameStore](StateManagement/RecentGameStore.md)
- [UiStateStore](StateManagement/UiStateStore.md)

### 4. Presentation
- [Presentation overview](Presentation/index.md)
- [Router](Presentation/Router.md)
- [Interaction Map](Presentation/InteractionMap.md)
- [Shared Dialog Flows](Presentation/SharedDialogFlows.md)
- [Composables](Presentation/Composables.md)
- [Views](Presentation/Views/index.md)
- [Components](Presentation/Components/index.md)
- [Common components](Presentation/Components/Common/index.md)
- [Modal components](Presentation/Components/Modals/index.md)

### 5. Process Flows
- [Process Flow Index](../ProcessFlows/index.md)

### Shared Data Interfaces
- [DataInterface Index](DataInterface/index.md)
- [Utility Index](UtilityIndex.md)

### Source Layout
| Layer | Source |
| --- | --- |
| Contracts | `src/contracts` (shared types and Zod schemas, including `platform`, `domain`, `errors` and `state` subfolders) |
| Platform abstraction | `src/platform` (`PlatformService.ts`, `base`, `browser`, `nwjs`) |
| Domain logic | `src/domain` |
| State management | `src/state`, with `GamesStore` composables in `src/state/game` |
| Presentation | `src/router`, `src/views`, `src/components` (`.vue` files only, with `common` and `modals` subfolders), `src/composables`, `src/directives`, `src/App.vue` and global CSS under `src/assets` |
| Shared private utilities | `src/utility` |
| Configuration | `src/config` (`BuildConfig`, `EnginePackageConfig`, `StockfishConfig`, `AppearanceConfig`, `IconConfig`) |

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
- Each layer may call only the immediately upper layer by number. The recorded departures are listed under [Current Exceptions](#current-exceptions); they are not precedent.
- `Layer 4` may coordinate multiple `Layer 3` stores in a single top-level user or route flow.
- Same-layer store calls are forbidden.
- Layer-1 modules do not call one another. Concrete implementations within layer 1 do not import sibling implementations; shared host mechanics live in private base classes under `src/platform/base` or in `src/utility`.
- Shared private utilities may be imported like an external library, but they remain invisible in flow ownership, are not public modules, and do not relax adjacency.
- Presentation components do not own game rules, move-tree mutation, persistence or engine-process control.
- State stores are the coordination boundary for UI-triggered mutations, but they call layer-2 services only.
- State stores do not resolve `IPlatformService`, `IStorageAdapter`, `IProcessManager`, `ISystemThemeAdapter` or `IEngineClient` directly.
- `GamesStore` is the one public mutation authority for live and open games, including active-workspace insertion and hydration. Its private composables are implementation details; presentation and sibling stores depend on the `useGamesStore` façade. `SavedGamesStore` owns saved-game browsing, saved-document read and write execution, restore lookup, close-trigger autosave registration, and route or dialog target selection.
- Domain logic owns persisted payload rules, document interpretation, notation rules, position identity rules, engine-package rules and the lower-layer service boundaries exposed to layer 3.
- Platform abstraction owns host capabilities for the NW.js desktop and the browser. It does not define chess rules or UI state.
- `src/platform/PlatformService.ts` selects one platform store definition once, from `getPlatformTarget()`: NW.js when its runtime is detected or forced, otherwise the browser. Layer-2 services resolve it lazily through `usePlatformService()`. Journey bootstrap injects browser storage and scripted engines through `setBrowserPlatformOptions(...)` before any store is created. See [PlatformServices](PlatformAbstraction/PlatformServices.md#host-selection).
- `EngineRuntimeService` owns the game-facing engine runtime boundary, composing the `ProcessManager` and `EngineClient` paired with the assignment's `EngineClientType`. Higher layers do not compose raw UCI strings directly.
- Presentation reads store state directly. Local pure mapping or selector functions may adapt that state for rendering, but there is no separate read-helper subsystem.
- Shared imported private utilities that touch committed contract models are documented only in [UtilityIndex.md](UtilityIndex.md) plus the owning module docs that delegate to them. They do not appear as flow-level owners.
- Narrow authoritative reads such as `TimeControlService.getRemainingTime` remain domain calls used by the owning view or store when required by a committed flow. Pure detached projections, such as replaying `MoveHistoryService.getMoveSequence(...)` through `MoveApplicationService.genPosition(...)` for a preview board, are narrow reads; presentation must not mutate canonical state or start engine runtimes through layer 2.
- Process-flow tables must begin with a concrete callable owner such as a view handler, component handler, router guard, bootstrap function, store public function or domain-service public function.

### Asynchronous Ownership And Effects
- Effects run at explicit actions, component events, lifecycle hooks or router hooks; derived state uses computed values. Watchers, `watchEffect` and equivalent reactive subscriptions are not used. **Why:** observer-driven effects hid which action owned a side effect and when it ran; each removed watcher now has a named action or lifecycle owner. See [CodeCleanupPlan](../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition).
- Superseded asynchronous work is cancelled and settled by an explicit owner at its action or lifecycle boundary, for example `OperationOwner`, an `AbortController` held by the owning runtime, or a protocol session's state-owned `Deferred`. Generation, epoch or sequence counters are not used to invalidate stale results. **Why:** a counter only discards a late result after the fact; it does not stop the work, settle its promise or prevent duplicate starts. See [CodeCleanupPlan](../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions).
- `npm run check:code` (`scripts/CodeAudit.mjs`) enforces these rules, redundant implementation return annotations and the styling boundary during every build.

### Presentation Composition
- Views own route-level templates and the workflows bound to a route: rendered input context, playback, historical continuation, Menu interruption and route activation.
- Feature components in `src/components` own their own templates. They receive a target such as `gameId`, read their feature state from stores and call existing store actions for independent flows. They emit events only where the receiver owns a resource the component cannot reconstruct, such as `GameView`'s captured input context. **Why:** forwarding state and relay events through views duplicated sources of truth without adding an owner. See [ComponentSimplificationPlan](../../ArchivedPlans/ComponentSimplificationPlan.md).
- Common components in `src/components/common` (`AppIcon`, `ChessPiece`, `ControlButton`, `ExpandableText`) are generic rendering primitives with no store access.
- Modal components in `src/components/modals` are mounted through `useModal()` from `src/composables/ModalComposable.ts`, with `useModalProvider()` installed by `App.vue`. Each opening mounts a fresh component with its own abort signal and settles once on dismissal.
- Composables (`useModal`, `useModalProvider`, `useModalAction`, `useQuickGame`, `useGameTabActions`) live in `src/composables` and the `vFocusScope` directive in `src/directives`; production files under `src/components` are `.vue` files.
- Presentation should prefer shallow composition through well-named self-contained components over deep nested markup inside views.
- Styling uses global CSS only, imported through `src/assets/main.css`. Vue files have no `<style>` blocks or scope-escaping selectors, and runtime style bindings supply CSS custom-property values only.

### Current Exceptions
These departures from the dependency rules exist in the implementation. They are recorded so that they are visible, not as patterns to copy.

| Departure | Where | Status |
| --- | --- | --- |
| Presentation reads layer 2 directly for detached projections and clock rendering | `GameView` (`TimeControlService.getRemainingTime`, `MoveHistoryService.getMoveSequence`, `MoveApplicationService.genPosition` and `applyMove` on its own preview copy), `GameControlPanel` and `SavedGamesView` (`genPosition` with `getMoveSequence`), `SavedGamesView` (`SavedGameIndexService.getLatestSaveEntry`) | Within the narrow-read rule above. None mutates canonical state. |
| Presentation instantiates a `GamesStore` composable | `GameView` calls `useGamePosition()` for the pure `getPremoveProjection(...)` query, as chosen by the [premove plan](../../ArchivedPlans/PreMovePlan%28ToDo%29.md) | Pure detached query that bypasses the `useGamesStore` façade. |
| Presentation starts a temporary engine runtime | `GameCreationModal` and `useQuickGame` call `EngineRuntimeService.getOptions(...)` to check required engine seats before creating a game, as chosen by the [modal design](../../ArchivedPlans/ModalComponentDesign.md) and [quick-game defaults design](../../ArchivedPlans/QuickGameDefaultsDesign.md) | Open exception: a runtime action rather than a narrow read. `EnginesStore` is the adjacent layer-3 owner of option discovery. |
| Same-layer store call | `GameRecordComposable` (inside `GamesStore`) lazily calls `useSavedGamesStore().saveGame(...)` for move-count autosave, retained unchanged by the [store dependency restructuring](../../ArchivedPlans/StoreDependencyRestructuringPlan.md) | Open exception to the same-layer rule. |

## Baseline Route Shape
The router (`src/router/index.ts`) uses `createWebHistory(import.meta.env.BASE_URL)` and lazy-loaded views:

- `/` redirects to `/home`
- `/home`
- `/game/:id`
- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`
- `/settings` redirects to `/settings/session`
- `/settings/:category`, where `category` is `session`, `gameplay`, `appearance` or `engines`
- engine child routes of `/settings/engines`, rendered by `SettingsView`'s nested `RouterView`:
  - `/settings/engines/profiles/new` (`engine-profile-new`)
  - `/settings/engines/profiles/:profileId/edit` (`engine-profile-edit`)
  - `/settings/engines/profiles/:profileId/copy` (`engine-profile-copy`)
  - `/settings/engines/packages/import` (`engine-package-import`)
  - `/settings/engines/packages/details?packagePath=...` (`engine-package-details`)
- any other path redirects to `/home`

`GameView` hosts board, players, history, analysis and game controls. `SavedGamesView` hosts the route-level internal save and load surface. `SettingsView` hosts the settings shell; `EngineProfileView`, `EnginePackageImportView` and `EnginePackageDetailsView` are its engine child views. The persisted session `activeRoute` accepts only the top-level routes, so `App.vue`'s route checkpoint does not record engine child routes; the last committed top-level route is kept. A standalone analysis route or view is out of scope.

## Baseline Data Contracts
The data-interface section defines the shared low-level types for:

- board and move-tree state, including raw, candidate and detailed moves
- game state, result state and pause reasons
- premove queues
- time control and clock snapshots
- engine profiles, launch data, assignment and runtime sessions
- engine packages and transient archive inputs
- analysis seats and recorded analysis
- appearance projection and semantic app-theme variables
- the platform process subset (`IProcess`) and file-system entries
- active platform event-registration snapshots
- shared platform failure and serialisation error contracts
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
- Host values keep the host's own absence representation where it carries meaning, for example native process `exitCode`/`signalCode` and the `(code, signal)` exit-listener arguments of `IProcess`.

## Decision Documentation Standard
Behaviour alone is not enough for a non-obvious architectural decision. Reasoning must appear immediately beside the contract, rule, mutation flow, or ownership statement it protects—not in a separate rationale document or a distant rationale section. The local explanation must preserve:

- the problem or failure mode that forced the decision
- why the chosen owner and boundary solve that problem
- the plausible alternative that was rejected and how it fails
- the invariant that a replacement must preserve
- any known condition that would justify revisiting the mechanism

This keeps the reasoning in the path of anyone learning or changing the design and prevents a locally attractive refactor from silently reintroducing a system-level bug. A mechanism is not permanent merely because it is documented; a replacement is valid when it addresses the original failure mode and preserves the stated invariant. Where an archived plan holds the full investigation, the local explanation summarises it and links to that plan.

## Copy And Identity Policy
- Production copies are justified only at an ownership or trust boundary, to preserve immutable history, to detach a simulation or divergent position, or to stabilise iteration/sorting against caller mutation. A new copy must identify which of those guarantees it provides.
- Defensive cloning by default is rejected because it hides ownership, breaks useful object identity, copies runtime state that may contain callbacks or host objects, and makes mutation costs unpredictable. `structuredClone` is especially unsuitable for canonical game objects with runtime `$` values and purpose-specific class instances.
- Immutable values such as chess-piece identities and timestamp instants may be shared. Mutable containers are copied only when the recipient must be able to mutate independently.
- Host resources such as process objects, engine clients and process managers are marked raw and shared by identity, never copied. Process objects in particular are compared by reference across the runtime, the client session and the manager's disposal set, so a reactive proxy or copy would break that comparison.
- The invariant is behavioural isolation, not "no copies" or "always copy". Removing a copy is safe only when ownership is already exclusive; adding one is safe only when the new identity does not participate in rendering, runtime lookup, or history-reference semantics.

## Scenario Ownership Summary
- `GamesStore` (through its `src/state/game` composables), `MoveHistoryService`, `MoveApplicationService` and the chess utilities own move, premove, history, setup, control and lifecycle scenarios, including game-end result finalisation.
- `TimeControlService` and `GamesStore` own timed-game pause, resume, focus-return synchronisation and expiry scenarios.
- `GamesStore` owns move timing, non-local turn waiting, analysis coordination, persisted analysis seats at layer 3, and copying selected reusable engine profiles into assigned-engine snapshots. `EnginesStore` owns configured engine profiles read from accepted settings, cached option metadata, and the transient engine-package list with queued discovery, import and removal. `EnginePackageService` owns package storage rules. `EngineRuntimeService` owns temporary option discovery and the lower-layer game-facing runtime path by composing `ProcessManager` and `EngineClient`.
- `GamesStore`, `SettingsStore`, `RecentGameStore`, `UiStateStore`, `SavedGamesStore`, `SavedGameIndexService`, `SerializationService` and `UserSettingService` own persistence, restore, load, home recent-history and settings scenarios. `GamesStore` is limited to active-workspace insertion, duplicate-id repair, hydration and gameplay mutation after a payload is available. `SavedGamesStore` owns saved-document save or load execution plus restore, browse, managed-save deletion, external picker and close-trigger autosave workflows. `SavedGameIndexService` owns save-folder rules and latest-save selection. `SerializationService` owns canonical payload conversion plus storage-backed session, layout and saved-game I/O and picker boundaries. `UiStateStore` owns session and layout persistence through build-config paths. `UserSettingService` owns accepted settings validation, caching, defaults and persistence.
- `Router`, `HomeView`, `GameView`, `SavedGamesView`, `SettingsView`, the engine child views, feature components and modal components own route and screen composition, plus the independent UI flows described in the presentation docs.

## Explicit Non-Baseline Exclusions
The low-level docs do not introduce:

- remote players
- remote engine runtimes or engine services
- non-UCI protocols, and Worker engines whose interface is not plain string UCI messages (module APIs such as those of Fairy-Stockfish WASM or Lichess stockfish-web need their own `EngineClientType` and client first)
- module Workers, nested Workers or multithreaded engine builds inside the Worker loader
- a desktop engine installation, catalogue or managed engine folder; desktop profiles point at executables or scripts directly
- standalone analysis views
- extra chess variants
- user-created custom themes, sound settings, recent-game settings or mobile layout settings

Worker engines are part of the baseline: classic single-Worker UCI scripts run through `EngineClientType.UciWorker` on both hosts, whether app-served (including the bundled Stockfish 19 lite single-threaded WASM build), imported into browser storage, or selected as a local file on the desktop. Native executables run through `EngineClientType.Uci` on the desktop only.

## Review Checklist
The doc set is aligned only when all of the following are true:

- every `Current` and `Planned` scenario has an owning module
- persisted artefacts match the saved-game and settings ownership contracts
- multi-engine analysis is baseline, capped at four concurrent analysis engines per game
- terminology for routes, game states, result states, and persistence artefacts matches the high-level docs
- no doc describes same-layer store calls or `Layer 3 -> Layer 1` calls other than the recorded [current exceptions](#current-exceptions)
- every process-flow table starts with a concrete callable owner
- shared contract-aware private utilities are inventoried in [UtilityIndex.md](UtilityIndex.md) and remain invisible in process-flow ownership
- every function, route, type and file named in a doc exists in the current source
