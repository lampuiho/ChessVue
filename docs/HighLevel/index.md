# ChessVue High-Level Docs

## Purpose
This folder contains the high-level product and architecture documents for ChessVue.

These files describe the committed design as implemented: the layers and modules that exist, the user-facing contracts they honour, and the `Planned` and `Idea` intent that is still outstanding. The low-level docs and the code must stay consistent with them.

## Folder Summary
- [plan.md](plan.md): documentation role, committed baseline, platform targets and verification lanes.
- [architecture.md](architecture.md): layers, implemented modules, platform targets, route shape and dependency rules.
- [ui_layout.md](ui_layout.md): responsive workspace placement, navigation, dialogs and parent-child layout ownership.
- [scenarios.md](scenarios.md): `Current`, `Planned`, and `Idea` behaviour catalogue with contract traceability.
- [state_model.md](state_model.md): authoritative game and UI state model.
- [persistence_contract.md](persistence_contract.md): persisted artefacts, desktop and browser storage, restore rules and schema boundaries.
- [engine_runtime.md](engine_runtime.md): UCI engine runtime for desktop processes and browser workers, engine packages and multi-engine rules.
- [settings_contract.md](settings_contract.md): authoritative user-editable settings contract.
- [settings.md](settings.md): overview of the split between user settings and runtime/build configuration.
- [user_settings.md](user_settings.md): reader-friendly summary of user settings as presented in Settings.
- [build_settings.md](build_settings.md): build targets, platform selection, deployment and runtime baseline.
- [ideas.md](ideas.md): deferred or speculative concepts that are intentionally outside the committed baseline.
- [Design questions](../questions/README.md): focused unresolved decisions and scenario/implementation drift found while writing journeys, checked against the [clarified product intent](../ArchivedPlans/JourneyTestPlan.md#product-intent-and-usability-baseline).

## Recommended Reading Order
1. Start with [plan.md](plan.md) to understand the baseline and how these documents are used.
2. Read [architecture.md](architecture.md) for the structure, platform targets and module boundaries.
3. Read [ui_layout.md](ui_layout.md) for workspace placement and navigation before the low-level presentation design.
4. Read [state_model.md](state_model.md), [persistence_contract.md](persistence_contract.md), [engine_runtime.md](engine_runtime.md), and [settings_contract.md](settings_contract.md) as the four implementation-shaping contracts.
5. Read [scenarios.md](scenarios.md) to map committed behaviour to those contracts.
6. Use [user_settings.md](user_settings.md), [build_settings.md](build_settings.md), and [settings.md](settings.md) as companion summaries.
7. Read [ideas.md](ideas.md) only for deferred concepts, not for baseline decisions.

Historical implementation plans, including the rationale behind several current mechanisms, are kept unchanged in [ArchivedPlans](../ArchivedPlans/). The high-level docs link to them where a decision's reasoning lives there.

## How This Folder Fits With Low-Level Docs
The high-level docs answer questions like:

- what the committed baseline is and which platform targets implement it
- what major modules and workflows exist
- where workspace regions sit and who owns layout positioning
- what state, persistence, engine, and settings contracts the low-level docs and code follow

The [low-level docs](../LowLevel/Architecture/index.md) then define:

- concrete interfaces
- store APIs
- module contracts
- serialised data shapes
- implementation responsibilities and process flows

## Summary
In short, this folder is the design-level map for ChessVue:

- `plan.md` sets the baseline and the documentation role
- `architecture.md` sets the structure
- `ui_layout.md` sets the workspace placement rules
- `scenarios.md` sets the behaviour
- the four contract docs remove implementation-shaping ambiguity
- `ideas.md` keeps deferred concepts out of the committed baseline
