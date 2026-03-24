# ChessVue Process Flows

## Purpose
This folder turns the committed low-level architecture into scenario-level execution flows.

It answers three questions for every committed scenario:

- which base call starts the flow
- which public functions are reached from that base call
- which private helper calls sit behind each public function

Only `Current` and `Planned` scenarios from [../../HighLevel/scenarios.md](../../HighLevel/scenarios.md) are in scope here. `Idea` scenarios remain out of baseline scope.

## Conventions
- Every flow is documented as a table.
- The first column is the base call for the flow and lists the full straight-line call sequence for that flow.
- Every public function that appears in the first column gets its own expansion column.
- Private helpers stay in the column of the public function that owns them and use an underscore prefix, for example `_hydrateWorkspace`.
- Branches are split into separate flow tables instead of being merged into one branching flow.
- Verification uses `Pass` when the documented public surface can satisfy the scenario without presentation code reaching directly into domain or platform layers.

## Folder Summary
- [StartupAndNavigation.md](StartupAndNavigation.md): startup, restore, game creation, tabbing, and route flows.
- [GameplayAndControl.md](GameplayAndControl.md): move input, history, clocks, control-panel flows, and engine-controlled live turns.
- [AnalysisAndSetup.md](AnalysisAndSetup.md): free analysis/setup, board editing, engine analysis, and analysis-panel move selection policy.
- [PersistenceAndAdministration.md](PersistenceAndAdministration.md): autosave, import/export, settings, engine inventory, and deletion flows.

## Reading Order
1. Read [StartupAndNavigation.md](StartupAndNavigation.md) first.
2. Continue with [GameplayAndControl.md](GameplayAndControl.md) for the core move loop and player-engine turn flow.
3. Read [AnalysisAndSetup.md](AnalysisAndSetup.md) for engine analysis and setup-specific flows.
4. Finish with [PersistenceAndAdministration.md](PersistenceAndAdministration.md) for save/load and maintenance workflows.
