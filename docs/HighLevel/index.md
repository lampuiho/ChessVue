# ChessVue High-Level Docs

## Purpose
This folder contains the high-level product and architecture documents for ChessVue.

These files describe the app from a planning and design perspective before implementation details are fully defined in the low-level architecture docs.

## Folder Summary
- [plan.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/plan.md): the original high-level plan, scope, major architectural directions, and phased implementation ideas.
- [architecture.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/architecture.md): the main structural overview of the system, including layers, module responsibilities, and dependency boundaries.
- [scenarios.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/scenarios.md): detailed user and system scenarios that translate features into concrete flows, branches, and function touchpoints.
- [settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings.md): overview page that explains the split between user settings and build/runtime settings.
- [user_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/user_settings.md): summary of user-facing preferences, defaults, and persisted app behavior.
- [build_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/build_settings.md): summary of build-time and runtime configuration such as platform targets, adapters, persistence backends, and engine integration strategy.

## Recommended Reading Order
1. Start with [plan.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/plan.md) to understand the product goals and intended scope.
2. Read [architecture.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/architecture.md) to see the proposed module and layer structure.
3. Read [scenarios.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/scenarios.md) to understand expected user flows and edge cases.
4. Use [settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings.md), [user_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/user_settings.md), and [build_settings.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/build_settings.md) when defining settings models and configuration boundaries.

## How This Folder Fits With Low-Level Docs
The high-level docs answer questions like:

- what the app is trying to do
- what major modules and workflows exist
- what settings and configuration areas need to be represented

The low-level docs should then define:

- concrete interfaces
- store APIs
- module contracts
- serialized data shapes
- implementation responsibilities

## Summary
In short, this folder is the design-level map for ChessVue:

- `plan.md` explains the direction
- `architecture.md` explains the structure
- `scenarios.md` explains the behavior
- the settings docs explain configuration boundaries
