# ChessVue High-Level Plan

## Purpose
This document defines the committed baseline and the role of the high-level documents.

The high-level documents began as the decision-complete input for the low-level rewrite. That rewrite is implemented, so they now describe the design as built. They remain the place where product decisions are recorded before code or low-level docs change, and they keep outstanding `Planned` and `Idea` intent visibly separate from implemented behaviour.

## Baseline
The baseline is:

- `All Planned`
- `desktop-first` design, implemented for NW.js desktop and browser targets
- `multi-engine now`

This means:

- every scenario marked `Current` or `Planned` is committed behaviour; `Planned` marks committed work that is not implemented yet
- every scenario marked `Idea` is not committed
- code and low-level docs must not invent behaviour outside the committed high-level documents; a new behaviour is first recorded here

## Authoritative Inputs
Low-level design and implementation depend on:

- [architecture.md](architecture.md)
- [scenarios.md](scenarios.md) for `Current` and `Planned`
- [state_model.md](state_model.md)
- [persistence_contract.md](persistence_contract.md)
- [engine_runtime.md](engine_runtime.md)
- [settings_contract.md](settings_contract.md)
- [build_settings.md](build_settings.md)
- [user_settings.md](user_settings.md)

[ideas.md](ideas.md) is not a source of committed behaviour.

## Key Design Decisions
- Desktop-first describes the design: layout, local file dialogs and native child-process UCI engines are designed for the NW.js desktop host. It does not require desktop integration to be tested first.
- The browser target implements the same platform interfaces, so gameplay, persistence, settings and engines run without NW.js. Browser constraints stay inside the platform boundary and are documented where they change user-visible guarantees, such as best-effort tab-close autosave. The browser build is also published to GitHub Pages; see [build_settings.md](build_settings.md).
- Browser UCI workers, including the bundled Stockfish.js engine and user-imported engine packages, are supported on both targets. Native executables remain desktop-only. Remote engine services remain deferred.
- Multi-engine concurrent analysis is part of the baseline, not a future enhancement.
- Analysis is integrated into `GameView`; it is not a standalone route or view.
- The canonical persisted game format is one internal JSON document used for autosave, managed saves and file export.
- Engine-controlled non-local interactions are the baseline implementation of a more general non-local participant boundary, so a future remote adapter should hook into the same store contracts and control surfaces rather than requiring new gameplay flows.
- Committed user settings are distinguished from capabilities and from deferred ideas.
- Low-level types derive from the four contracts instead of from earlier inferred notes.

## Contract Documents
The following high-level contracts are the decision-complete source for their areas:

1. [state_model.md](state_model.md)
2. [persistence_contract.md](persistence_contract.md)
3. [engine_runtime.md](engine_runtime.md)
4. [settings_contract.md](settings_contract.md)

## Non-Baseline Ideas
Deferred or speculative concepts are collected in [ideas.md](ideas.md), not mixed into baseline architecture.

That includes, for example:

- remote engine runtimes
- standalone analysis routes
- extra rule variants
- study extensions such as bookmarks or analysis undo/redo

## Verification Lanes
1. Unit and mounted application tests (`npm run test:unit`) run against the shared domain, stores and components.
2. Browser end-to-end tests (`npm run test:e2e`) run the ordinary browser app and the seeded journeys. Ordinary browser runs use browser storage, real file import/download and real Stockfish.js workers. Journey runs use isolated sessionStorage, deterministic picker choices and injected scripted UCI transport.
3. The native desktop lane (`npm run test:desktop`) verifies real NW.js dialogs, disk persistence, shutdown ordering and local engine processes separately; see the [desktop test procedure](../../e2e/desktop/README.md).
4. `npm run build` runs the code audit (`npm run check:code`), type checking and the production bundle.

Journey scope and priorities are recorded in the archived [journey test plan](../ArchivedPlans/JourneyTestPlan.md).

## Documentation Consistency Goals
The high-level documents are consistent with the code when:

- a reader can derive low-level types and store boundaries without making product decisions
- `Current` and `Planned` scenarios map cleanly to the four contracts where relevant
- deferred ideas are separated from baseline commitments, and implemented ideas are moved out of [ideas.md](ideas.md)
- no baseline document relies on speculative runtime types such as non-UCI protocols, committed remote-player seats, or uncommitted settings
