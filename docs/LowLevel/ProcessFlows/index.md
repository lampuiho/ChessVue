# ChessVue Process Flows

## Purpose
This folder turns the committed low-level architecture into scenario-level execution flows.

It answers three questions for every committed scenario:

- which base call starts the flow
- which public functions are reached from that base call
- which further calls each public function makes when expanded recursively

Only `Current` and `Planned` scenarios from [../../HighLevel/scenarios.md](../../HighLevel/scenarios.md) are in scope here. `Idea` scenarios remain out of baseline scope.

## Conventions
- Every flow is documented as a stack of single-column tables rather than one wide table.
- The first table header is the base call for the flow, and the rows below it list the calls reached directly from that base call in reading order.
- Every public function reached from that first table gets its own single-column table.
- Each follow-on table uses the public function as its header and lists the calls made by that function.
- Read the tables recursively: base call table first, then the table for each public function that appears in it, then the tables for any further public functions reached from there.
- Private helpers use an underscore prefix, for example `_hydrateWorkspace`.
- When a private helper is part of the committed cross-layer call chain, it gets its own follow-on single-column table so the delegated call it makes is explicit.
- Branches are split into separate flow tables instead of being merged into one branching flow.
- Verification uses `Pass` when the documented public surface can satisfy the scenario without presentation code reaching directly into domain or platform layers.

## Folder Summary
- [StartupAndNavigation.md](StartupAndNavigation.md): startup, restore, game creation, tabbing, and route flows.
- [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md): engine-runtime ownership, state mutation, and layer-1/layer-2 runtime boundaries.
- [GameplayAndControl.md](GameplayAndControl.md): move input, history, clocks, control-panel flows, and engine-controlled live turns.
- [AnalysisAndSetup.md](AnalysisAndSetup.md): free analysis/setup, board editing, engine analysis, and analysis-panel move selection policy.
- [PersistenceAndAdministration.md](PersistenceAndAdministration.md): autosave, import/export, settings, engine inventory, and deletion flows.

## Reading Order
1. Read [StartupAndNavigation.md](StartupAndNavigation.md) first.
2. Read [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for engine-runtime ownership and state mutation before reading gameplay or analysis flows.
3. Continue with [GameplayAndControl.md](GameplayAndControl.md) for the core move loop and player-engine turn flow.
4. Read [AnalysisAndSetup.md](AnalysisAndSetup.md) for engine analysis and setup-specific flows.
5. Finish with [PersistenceAndAdministration.md](PersistenceAndAdministration.md) for save/load and maintenance workflows.
