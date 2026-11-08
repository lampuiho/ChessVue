# ChessVue User Settings Overview

## Purpose
This document summarises the user-editable settings as they appear in Settings.

The authoritative schema lives in [settings_contract.md](settings_contract.md). This document is the reader-friendly overview, grouped by settings category.

## Baseline Rule
Only committed user-editable settings appear here.

Capabilities, restore guarantees, and deferred ideas are not treated as settings unless they are explicitly included in [settings_contract.md](settings_contract.md).

Changes are drafted across all categories and take effect only through **Apply changes** or **Save**. **Reset to defaults** restores every setting, including engine profiles, after confirmation.

## 1. Session
| Setting | Baseline Notes |
| --- | --- |
| Previous session | Reopens the previous game tabs and route after launch when valid; otherwise always opens Home. |
| Auto-pause on menu | Pauses timed live games while using Home, Custom game, saved-games and Settings, locking game interaction until the paired return or an explicit resume. |
| Save folder | Logical root for internal save groups; a relative or absolute local path on desktop, a virtual path in the browser. Changing it does not migrate existing files. |
| Autosave interval | Committed plies between automatic snapshots; 0 disables move-count autosave. |
| Save on close | Persists the open games at close or checkpoint; forced on, and disabled, while Previous session is on. |

## 2. Gameplay
| Setting | Baseline Notes |
| --- | --- |
| Game name | Default name for Quick and Custom games. |
| Randomly assign colours | Labels the participants Player 1 and Player 2 and draws their colours separately for each new game. Saved games retain the resulting assignment. Disabled when either player is unassigned. |
| White player / Black player (Player 1 / Player 2) | Unassigned, Local player, a saved engine configuration, or a copy of an engine profile. **Use free analysis** clears both seats so Quick game opens a free analysis workspace. |
| Clock preset | Default time control: Untimed, a named preset, or a custom clock. |
| Allow takebacks | Copied into future games by both Quick and Custom creation. |
| Show live analysis moves | Copied into future live games; disabled when either player is unassigned because free analysis always shows analysis moves. |
| Analysis engines | Up to four engine snapshots, independent of later profile edits or deletion. |
| After exploring history | Whether analysis-only history moves return to the live position or stay on the analysis branch. The choice is saved, but gameplay does not apply it yet. |

Promotion always requires an explicit piece choice; there is no promotion setting in the UI.

## 3. Appearance
| Setting | Baseline Notes |
| --- | --- |
| Theme | `system` (default), `light` or `dark`, each with a preview. |
| Orientation | White or Black at the bottom of the board. |
| Coordinates | Board coordinate visibility. |
| Last move highlight | Whether the board highlights the most recent move. |
| Interface scale | UI scale percentage, from 75% to 150% in the slider. |

Board and piece theme fields are reserved in the schema for future support. The baseline uses a fixed presentation and exposes no board or piece theme selection controls.

## 4. Engines
| Setting | Baseline Notes |
| --- | --- |
| Resume after restore | Restarts assigned analysis engines only after saved-game restore is complete. |
| Engine profiles | User-managed registry of reusable UCI engine profiles, each a desktop executable or a browser UCI worker with options. Profile names must be unique. Editing or deleting a profile affects future assignments only; existing games and game defaults keep their copied configuration until explicitly replaced. |

On the browser target, the Engines category also lists installed browser engine packages, which can be imported, inspected and removed. Package files are stored by the browser, not in settings; see [engine_runtime.md](engine_runtime.md#engine-packages).

## Not Baseline User Settings
The following items are not committed settings and should not appear in the low-level settings schema unless later promoted:

- user-created custom UI themes
- sound enablement
- recent games preferences
- tab-switch auto-pause
- mobile panel preference
- variant preferences

These remain deferred in [ideas.md](ideas.md).
