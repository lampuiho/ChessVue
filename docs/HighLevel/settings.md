# ChessVue Settings Overview

## Purpose
This page explains how ChessVue configuration is split across three related high-level documents:

- [settings_contract.md](settings_contract.md): the authoritative user-editable settings contract
- [user_settings.md](user_settings.md): reader-friendly summary of user settings as presented in Settings
- [build_settings.md](build_settings.md): build targets, platform selection and runtime assumptions

## Boundary
Use [settings_contract.md](settings_contract.md) when the value is:

- editable by the user
- persisted as a preference in the settings snapshot
- allowed to shape low-level settings schema design

Use [build_settings.md](build_settings.md) when the value controls:

- platform target selection and host capabilities
- engine transport/runtime implementation
- persistence backend behaviour and app-owned file paths
- route and shell exposure defaults
- serialisation/runtime integration choices
- deployment

Use [ideas.md](ideas.md) when a configuration topic is:

- speculative
- deferred
- intentionally excluded from the current baseline

## Quick Rule of Thumb
- `piece theme` -> reserved schema field; user selection is deferred
- `theme mode` -> user setting
- `auto-pause on menu interruption` -> user setting
- `quick game defaults` -> user setting
- `engine profile entry path and interface` -> user-managed settings data
- `imported browser engine package files` -> browser engine storage, not settings
- `local child-process UCI runtime` -> build/runtime baseline
- `browser UCI worker runtime, including the bundled Stockfish.js` -> build/runtime baseline
- `untimed engine move time` -> build configuration, not a user setting
- `platform target (CHESSVUE_PLATFORM) and base path (CHESSVUE_BASE_PATH)` -> build configuration
- `user-created custom theme` -> deferred idea

## Notes
- Per-game engine assignment belongs to the game model, not to the global settings schema. Game creation defaults hold their own engine snapshots.
- Session restore behaviour is partly controlled by settings, but the reopenable game session and remembered UI layout state are persisted separately as defined in [persistence_contract.md](persistence_contract.md). In the accepted settings model, enabling `restorePreviousSession` also forces close autosave so those tabs remain reopenable.
- If a setting or runtime option is not present in the baseline contract docs, the implementation should not invent it.
