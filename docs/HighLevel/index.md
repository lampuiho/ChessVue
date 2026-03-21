# ChessVue High-Level Docs

## Purpose
This folder contains the high-level product and architecture documents for ChessVue.

These files define the committed implementation baseline that should be settled before the low-level design is rewritten.

## Folder Summary
- [plan.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/plan.md): rewrite baseline, authoritative inputs, and verification goals.
- [architecture.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/architecture.md): committed system structure, layers, baseline modules, and route shape.
- [scenarios.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/scenarios.md): `Current`, `Planned`, and `Idea` behaviour catalogue with contract traceability.
- [state_model.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/state_model.md): authoritative game and UI state model.
- [persistence_contract.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/persistence_contract.md): persisted artefacts, restore rules, and schema boundaries.
- [engine_runtime.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/engine_runtime.md): desktop-first UCI engine runtime and multi-engine rules.
- [settings_contract.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings_contract.md): authoritative user-editable settings contract.
- [settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings.md): overview of the split between user settings and runtime/build configuration.
- [user_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/user_settings.md): reader-friendly summary of committed user settings.
- [build_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/build_settings.md): committed desktop-first build and runtime baseline.
- [ideas.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/ideas.md): deferred or speculative concepts that are intentionally outside the low-level rewrite baseline.

## Recommended Reading Order
1. Start with [plan.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/plan.md) to understand the rewrite baseline.
2. Read [architecture.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/architecture.md) for the committed structure and module boundaries.
3. Read [state_model.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/state_model.md), [persistence_contract.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/persistence_contract.md), [engine_runtime.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/engine_runtime.md), and [settings_contract.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings_contract.md) as the four implementation-shaping contracts.
4. Read [scenarios.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/scenarios.md) to map committed behaviour to those contracts.
5. Use [user_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/user_settings.md), [build_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/build_settings.md), and [settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings.md) as companion summaries.
6. Read [ideas.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/ideas.md) only for deferred concepts, not for baseline implementation decisions.

## How This Folder Fits With Low-Level Docs
The high-level docs answer questions like:

- what the rewrite baseline is
- what major modules and workflows are committed
- what state, persistence, engine, and settings contracts the low-level docs must follow

The low-level docs should then define:

- concrete interfaces
- store APIs
- module contracts
- serialised data shapes
- implementation responsibilities

## Summary
In short, this folder is the design-level map for ChessVue:

- `plan.md` sets the rewrite baseline
- `architecture.md` sets the structure
- `scenarios.md` sets the behaviour
- the four contract docs remove implementation-shaping ambiguity
- `ideas.md` keeps deferred concepts out of the committed baseline
