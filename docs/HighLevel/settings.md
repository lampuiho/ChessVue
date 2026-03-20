# ChessVue Settings Overview

## Purpose
This page splits ChessVue configuration into two different buckets:

- [User Settings](user_settings.md): preferences and defaults a user can change in the app.
- [Build Settings](build_settings.md): platform/runtime configuration chosen by the app build, shell, or implementation.

This split is based on:

- `docs/HighLevel/scenarios.md`
- `docs/HighLevel/plan.md`
- supporting context from `docs/HighLevel/architecture.md`

## Boundary
Use `User Settings` when the value is part of the product experience and should be persisted as a user preference.

Use `Build Settings` when the value controls how ChessVue is packaged, hosted, integrated with the platform, or backed by specific infrastructure.

## Quick Rule of Thumb
- `piece theme` -> user setting
- `default time preset` -> user setting
- `engine executable path` -> user setting for advanced users
- `localStorage vs filesystem adapter` -> build setting
- `browser/WASM vs desktop child-process engine integration` -> build setting
- `supported import/export formats` -> mostly build setting

## Notes
- Some areas overlap. For example, engine configuration is user-facing, but the underlying engine transport implementation is a build/runtime concern.
- If ChessVue later needs stricter naming, a good split would be:
  - `SettingsSchema` for user-editable settings
  - `RuntimeConfig` or `BuildConfig` for environment/platform configuration
