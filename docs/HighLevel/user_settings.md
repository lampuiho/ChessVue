# ChessVue User Settings Overview

## Purpose
This document summarises the committed user-editable settings for the rewrite baseline.

The authoritative schema lives in [settings_contract.md](settings_contract.md). This document is the reader-friendly overview.

## Baseline Rule
Only committed user-editable settings appear here.

Capabilities, restore guarantees, and deferred ideas are not treated as settings unless they are explicitly included in [settings_contract.md](settings_contract.md).

## 1. Session Behaviour
| Setting | Baseline Notes |
| --- | --- |
| Restore previous session on launch | Reopens prior session when valid. |
| Autosave enabled | Controls whether meaningful state changes are persisted automatically. |
| Autosave debounce | Reduces excessive write frequency during rapid changes. |
| Auto-pause on menu interruption | Applies to timed live games during settings, save, and similar flows. |

## 2. Gameplay Policies
| Setting | Baseline Notes |
| --- | --- |
| Quick new game name seed | Default label for quick-created games. |
| Default time control | Default quick-new-game time control. |
| Default white player type | `local` or `engine`. |
| Default black player type | `local` or `engine`. |
| Takeback policy | Decides whether moves made from history rewrite the live mainline or stay analysis-only. |
| Confirm before mainline rewrite | Adds a confirmation gate before changing the main continuation. |
| Analysis branch exit behaviour | Decides whether analysis-only history moves return to the live node or stay on the branch. |
| Promotion policy | Baseline requires explicit promotion selection. |

## 3. Engines
| Setting | Baseline Notes |
| --- | --- |
| Resume live analysis after restore | Engine-category preference that restarts live analysis only after saved-game restore is complete. |
| Engine inventory | User-managed registry of reusable UCI engine profiles. Profile names must be unique. Editing or deleting a profile affects future assignments only; existing games keep their copied in-game engine payloads until explicitly swapped. |

## 4. Appearance
| Setting | Baseline Notes |
| --- | --- |
| Theme mode | Built-in `light` and `dark` app themes with `system` as the default mode. |
| Board theme | Board colour and styling choice. |
| Piece theme | Piece style selection. |
| UI scale | Desktop UI scale percentage. |
| Board orientation | Default orientation for the board. |
| Show coordinates | Board coordinate visibility. |
| Highlight last move | Whether the board highlights the most recent move. |

## Not Baseline User Settings
The following items are not committed baseline settings and should not appear in the low-level settings schema unless later promoted:

- user-created custom UI themes
- sound enablement
- recent games preferences
- tab-switch auto-pause
- mobile panel preference
- variant preferences

These remain deferred in [ideas.md](ideas.md).

