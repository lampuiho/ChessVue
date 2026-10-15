# ChessVue High-Level Rewrite Plan

## Purpose
This document defines the rewrite baseline that the next low-level design pass must follow.

## Rewrite Baseline
The baseline is:

- `All Planned`
- `desktop-first`
- `multi-engine now`

This means:

- every scenario marked `Current` or `Planned` is rewrite input
- every scenario marked `Idea` is not rewrite input
- the low-level rewrite must not invent behaviour outside the committed high-level documents

## Authoritative Inputs
The low-level rewrite may depend on:

- [architecture.md](architecture.md)
- [scenarios.md](scenarios.md) for `Current` and `Planned`
- [state_model.md](state_model.md)
- [persistence_contract.md](persistence_contract.md)
- [engine_runtime.md](engine_runtime.md)
- [settings_contract.md](settings_contract.md)
- [build_settings.md](build_settings.md)
- [user_settings.md](user_settings.md)

The low-level rewrite must not use [ideas.md](ideas.md) as a source of committed behaviour.

## Key Design Decisions
- Desktop-first describes the design and implementation contracts: local file dialogs and child-process UCI engines remain desktop requirements. It does not require desktop integration to be tested first.
- Browser adapters implement the existing platform interfaces so gameplay, persistence, settings and seeded end-to-end journeys can be verified in a browser before desktop integration. Browser constraints stay inside the platform boundary. Browser UCI workers, including Stockfish.js, are supported; remote engine services remain deferred.
- Multi-engine concurrent analysis is part of the baseline, not a future enhancement.
- Analysis is integrated into `GameView`; it is not a standalone route or view in the baseline.
- The canonical persisted game format is one internal JSON document used for both autosave and file export.
- Engine-controlled non-local interactions are the baseline implementation of a more general non-local participant boundary, so a future remote adapter should hook into the same store contracts and control surfaces rather than requiring new gameplay flows.
- The rewrite must distinguish committed user settings from capabilities and from deferred ideas.
- The rewrite must derive low-level types from the four contracts instead of from earlier inferred notes.

## Documentation Deliverables
Before or during the low-level rewrite, the following high-level contracts are the decision-complete source for their areas:

1. [state_model.md](state_model.md)
2. [persistence_contract.md](persistence_contract.md)
3. [engine_runtime.md](engine_runtime.md)
4. [settings_contract.md](settings_contract.md)

## Non-Baseline Ideas
Deferred or speculative concepts must be collected in [ideas.md](ideas.md), not left mixed into baseline architecture.

That includes, for example:

- remote engine runtimes
- standalone analysis routes
- extra rule variants
- study extensions such as bookmarks or analysis undo/redo

## Verification Sequence

1. Run browser unit and end-to-end journeys against the shared domain, stores and desktop-first UI.
2. Use browser storage, file import/download, theme and lifecycle implementations; inject scripted UCI transport only in journey runs.
3. Verify real NW.js dialogs, disk persistence, shutdown ordering and local processes separately during desktop integration.

## Verification Goals
The documentation is only ready for low-level rewrite when:

- a reader can derive low-level types and store boundaries without making product decisions
- `Current` and `Planned` scenarios map cleanly to the four contracts where relevant
- deferred ideas are separated from baseline commitments
- no baseline document relies on speculative runtime types such as non-UCI protocols, committed remote-player seats, or uncommitted settings
