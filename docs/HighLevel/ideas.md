# ChessVue Deferred Ideas

## Purpose
This document records speculative, deferred, or explicitly out-of-baseline ideas so they are not lost when the committed architecture is tightened.

Nothing in this file is an implementation commitment.

## Baseline Boundary
The committed baseline is:

- `All Planned`
- `desktop-first` design, implemented for NW.js desktop and browser targets
- `multi-engine now`

Anything in this document is excluded from that baseline unless it is later promoted into another high-level document.

## Platform and Runtime Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Remote engine or server-backed analysis transport | `plan.md`, previous `build_settings.md` | Adds network/runtime complexity not required while local processes and in-browser workers cover the engine roles. |
| Additional host shells such as Electron, Capacitor, or mobile packaging | previous `architecture.md`, previous `build_settings.md` | NW.js and the browser target already exercise the platform interfaces; another shell would need its own bootstrap and capability decisions. |
| Packaged NW.js desktop distribution | README desktop section | The development launcher is the only desktop runner; the README treats packaging as a separate step. Rationale for deferral not recorded. |
| Automatic engine restart and reconnect policy | `scenarios.md` idea scenario `SCN-IDEA-07` | Manual retry is sufficient for the baseline; auto-reconnect needs separate UX and runtime policy. |
| Nested or module-worker engine scripts | archived [engine package rework](../ArchivedPlans/EngineInstallationReworkPlan.md#current-verification-limits) | The stored-script Blob bootstrap supports classic workers with sibling scripts and assets only. |

## Routes and App-Shell Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Standalone `/analysis` route or dedicated analysis view | previous `architecture.md`, previous `build_settings.md` | Analysis is integrated into `GameView`; a separate shell should not shape the design. |
| Mobile panel-switching shell behaviour | `scenarios.md` idea scenario `SCN-IDEA-09`, previous `plan.md` | The compact layout stacks the board above the sidebar and keeps every panel reachable; a panel switcher is a separate UX design task. The remembered `showHistoryPanel` and `showAnalysisPanel` layout fields and `UiStateStore.togglePanel` exist, but no control changes them yet. |

## Gameplay and Study Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Quick preset launch buttons from home | `scenarios.md` idea scenario `SCN-IDEA-01` | Home already offers Quick game from saved defaults and Custom game; preset-specific buttons are not needed for the baseline. |
| Extra rule variants such as Chess960 | `scenarios.md` idea scenario `SCN-IDEA-08`, previous `architecture.md` | Variant rules change move validation, serialisation, engine compatibility, and setup contracts. |
| Analysis bookmarks or snapshots | `scenarios.md` idea scenario `SCN-IDEA-04` | Valuable study feature, but not required for baseline restore or analysis workflows. |
| Explain-evaluation panel | `scenarios.md` idea scenario `SCN-IDEA-05` | Not required by current or planned analysis workflows. |
| Undo/redo stack for analysis exploration | `scenarios.md` idea scenario `SCN-IDEA-06` | The move-tree navigation already covers committed analysis workflows. |
| Tab-switch auto-pause | `scenarios.md` idea scenario `SCN-IDEA-11`, previous `user_settings.md` | Menu-flow auto-pause is committed; tab-switch auto-pause needs separate UX policy. |

## File and Data Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Batch import and export workflows | `scenarios.md` idea scenario `SCN-IDEA-10` | The file contract is single-game save/load. |
| Public-domain or external format support beyond the canonical JSON document | previous `plan.md`, previous `build_settings.md` | One stable persisted format comes before broader compatibility work. |

## Settings and Schema Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Board and piece appearance customisation, including theme selection | Initial-phase scope clarification for `FRONTEND-DRIFT-05` | Retain separate appearance paths and reserved schema fields for future implementation; the initial phase uses a fixed presentation without selection controls. |
| User-created or importable custom UI themes | appearance/theme extension path after built-in `light`, `dark`, and `system` support | Built-in themes only need one stable semantic CSS-variable contract before user-authored theme data is introduced. |
| Sound enablement as a committed user setting | previous low-level drift | Not required by current or planned scenarios. |
| Extra inferred board-display toggles beyond the committed baseline | previous `user_settings.md` inferred rows | Only the settings promoted into `settings_contract.md` shape the design. |

## Promoted Ideas
These earlier ideas are now part of the baseline and are documented in the linked contracts:

- engine-vs-engine play (former `SCN-IDEA-03`): both seats may be engines and the normal player-turn loop continues turn by turn; see [engine_runtime.md](engine_runtime.md#1-player-engine)
- recent games on Home (former `SCN-IDEA-02`): see [persistence_contract.md](persistence_contract.md#on-demand-recent-games-projection)
- browser target and in-browser UCI engines, previously excluded as a non-desktop runtime: see [build_settings.md](build_settings.md) and [engine_runtime.md](engine_runtime.md)
- compact (mobile-width) layout with a navigation drawer: see [ui_layout.md](ui_layout.md#workspace-regions)

## Notes
- `Idea` scenarios remain in [scenarios.md](scenarios.md) for traceability, but this document is the main catalogue of deferred concepts.
- When an idea is promoted, update the relevant baseline document first and then move its entry to Promoted Ideas or remove it here.
