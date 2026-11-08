# ChessVue Process Flows

## Purpose
This folder turns the implemented low-level architecture into scenario-level execution flows traced from the current code in `src/`.

It answers three questions for every committed scenario:

- which base call starts the flow
- which public functions are reached from that base call
- which further calls each public function makes when expanded recursively

`Current` and `Planned` scenarios from [../../HighLevel/scenarios.md](../../HighLevel/scenarios.md) are in scope; `Idea` scenarios remain out of baseline scope. Implemented behaviour that has no scenario ID yet, such as browser engine package management, may be documented here when it is clearly marked as having no scenario ID. Intent that is not implemented must be marked `Planned`.

## Conventions
- Every flow is documented as a stack of single-column tables rather than one wide table.
- The first table header is the base call for the flow: a concrete callable owner such as the `main.ts` bootstrap, an `App` lifecycle or router callback, a view or component handler, a composable member, a store public function or a domain-service public function. The rows below it list the calls reached directly from that base call in reading order.
- Every public function reached from that first table gets its own single-column table.
- Each follow-on table uses the public function as its header and lists the calls made by that function.
- Read the tables recursively: base call table first, then the table for each public function that appears in it, then the tables for any further public functions reached from there.
- Owner names match the code. View and component handlers use their private names, for example `SavedGamesView._loadGame`; framework entry points name the owner and hook, for example `GameView` `onBeforeRouteUpdate`; composable members use the composable function, for example `useQuickGame.start`. A `GamesStore` member that aliases a `src/state/game/*Composable.ts` function is expanded to that composable owner, for example `GamesStore.createGame` to `GameWorkspaceComposable.createGame`.
- Private helpers use an underscore prefix qualified by their defining module, for example `GameWorkspaceComposable._hydrateAndInsertGame`.
- When a private helper is part of the committed cross-layer call chain, it gets its own follow-on single-column table so the delegated call it makes is explicit.
- Shared utilities from `src/utility` stay out of the tables unless they are the actual storage or ownership boundary of the flow; the flow notes name them instead.
- Platform calls are written against the `IStorageAdapter` and `IPlatformService` surface. Where the NW.js and browser targets diverge, the target-specific expansion is tabled once in [Platform Storage Branches](PersistenceAndAdministration.md#platform-storage-branches) and referenced from the flows.
- Branches are split into separate flow tables instead of being merged into one branching flow.
- Verification uses `Pass` when the documented public surface can satisfy the scenario without presentation code reaching directly into domain or platform layers and without a same-layer store call. When the scenario is satisfied only through a deliberate, recorded layer exception, verification states `Pass (layer exception)` and names the call and where its rationale lives.

## Folder Summary
- [StartupAndNavigation.md](StartupAndNavigation.md): bootstrap and platform selection, application startup, session route checkpoint, navigation frame and game-menu interruption; fresh launch, session restore and corrupt-data recovery; quick and custom game creation with random colours; tab selection and closing; settings entry and return; invalid game routes; and recent-game reopen.
- [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md): engine-runtime ownership and mutable state, NW.js and browser platform composition, option metadata discovery, readiness and process start, analysis and player-turn runtimes, the UCI session state machine, stop/restart/failure handling, and platform disposal.
- [GameplayAndControl.md](GameplayAndControl.md): move execution, premoves, engine-controlled live turns and player reassignment, history and branching, time control including menu auto-pause, game controls, and game end.
- [AnalysisAndSetup.md](AnalysisAndSetup.md): free analysis and setup, board editing, starting a real game from setup, engine analysis, analysis-panel move selection and seat management, analysis after a game ends, and analysis recorded on actual moves.
- [PersistenceAndAdministration.md](PersistenceAndAdministration.md): NW.js and browser storage, picker and app-close branches; autosave; save, load and saved-game previews; import and export; settings apply, save and reset; engine profiles and browser engine packages; panel-layout persistence; and managed-save and saved-game deletion.

## Reading Order
1. Read [StartupAndNavigation.md](StartupAndNavigation.md) first.
2. Read [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for engine-runtime ownership and state mutation before reading gameplay or analysis flows.
3. Continue with [GameplayAndControl.md](GameplayAndControl.md) for the core move loop and player-engine turn flow.
4. Read [AnalysisAndSetup.md](AnalysisAndSetup.md) for engine analysis and setup-specific flows.
5. Finish with [PersistenceAndAdministration.md](PersistenceAndAdministration.md) for storage, save/load, settings and engine-administration workflows.
