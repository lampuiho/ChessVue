# ChessVue Settings Overview

## Purpose
This page explains how ChessVue configuration is split across three related high-level documents:

- [settings_contract.md](settings_contract.md): the authoritative user-editable settings contract
- [user_settings.md](user_settings.md): reader-friendly summary of committed user settings
- [build_settings.md](build_settings.md): committed desktop-first runtime and build assumptions

## Boundary
Use [settings_contract.md](settings_contract.md) when the value is:

- editable by the user
- persisted as a preference
- allowed to shape low-level settings schema design

Use [build_settings.md](build_settings.md) when the value controls:

- platform capabilities
- engine transport/runtime implementation
- persistence backend behaviour
- route and shell exposure defaults
- serialisation/runtime integration choices

Use [ideas.md](ideas.md) when a configuration topic is:

- speculative
- deferred
- intentionally excluded from the current rewrite baseline

## Quick Rule of Thumb
- `piece theme` -> reserved code structure; user selection is deferred
- `theme mode` -> user setting
- `auto-pause on menu interruption` -> user setting
- `engine executable path` -> user-managed settings data
- `local child-process UCI runtime` -> build/runtime baseline
- `user-created custom theme` -> deferred idea
- `browser or WASM engine support` -> deferred idea

## Notes
- Per-game engine assignment belongs to the game model, not to the global settings schema.
- Session restore behaviour is partly controlled by settings, but the reopenable game session and remembered UI layout state are persisted separately as defined in [persistence_contract.md](persistence_contract.md). In the accepted settings model, enabling `restorePreviousSession` also implies effective close autosave so those tabs remain reopenable.
- If a setting or runtime option is not present in the baseline contract docs, the low-level rewrite should not invent it.
