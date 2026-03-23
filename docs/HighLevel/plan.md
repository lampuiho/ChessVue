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
- The app shell is desktop-first and must support local file dialogs and local child-process UCI engines.
- Multi-engine concurrent analysis is part of the baseline, not a future enhancement.
- Analysis is integrated into `GameView`; it is not a standalone route or view in the baseline.
- The canonical persisted game format is one internal JSON document used for both autosave and file export.
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

- browser or WASM runtimes
- standalone analysis routes
- extra rule variants
- study extensions such as bookmarks or analysis undo/redo

## Verification Goals
The documentation is only ready for low-level rewrite when:

- a reader can derive low-level types and store boundaries without making product decisions
- `Current` and `Planned` scenarios map cleanly to the four contracts where relevant
- deferred ideas are separated from baseline commitments
- no baseline document relies on speculative fields such as non-UCI protocols, remote players, or uncommitted settings
