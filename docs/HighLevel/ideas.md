# ChessVue Deferred Ideas

## Purpose
This document records speculative, deferred, or explicitly out-of-baseline ideas so they are not lost when the committed architecture is tightened.

Nothing in this file is an implementation commitment for the next low-level rewrite.

## Rewrite Boundary
The current rewrite baseline is:

- `All Planned`
- `desktop-first`
- `multi-engine now`

Anything in this document is excluded from that baseline unless it is later promoted into another high-level document.

## Platform and Runtime Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Browser or WASM engine runtime | `plan.md`, previous `architecture.md`, previous `build_settings.md` | The rewrite baseline commits to desktop child-process UCI integration first. |
| Remote engine or server-backed analysis transport | `plan.md`, previous `build_settings.md` | Adds network/runtime complexity not required for the current desktop-first slice. |
| Additional host shells such as Electron, Capacitor, or mobile packaging | previous `architecture.md`, previous `build_settings.md` | The baseline only needs desktop capabilities, not cross-platform bootstrap decisions. |
| Automatic engine restart and reconnect policy | `scenarios.md` idea scenario `SCN-IDEA-07` | Manual retry is sufficient for the baseline; auto-reconnect needs separate UX and runtime policy. |

## Routes and App-Shell Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Standalone `/analysis` route or dedicated analysis view | previous `architecture.md`, previous `build_settings.md` | Baseline analysis is integrated into `GameView`; a separate shell should not shape the low-level rewrite. |
| Mobile panel-switching shell behaviour | `scenarios.md` idea scenario `SCN-IDEA-09`, previous `plan.md` | Responsive desktop layout is enough for now; compact-mode UX is a separate design task. |

## Gameplay and Study Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Quick preset launch buttons from home | `scenarios.md` idea scenario `SCN-IDEA-01` | The baseline already supports quick new game and custom new game without a preset-specific home workflow. |
| Extra rule variants such as Chess960 | `scenarios.md` idea scenario `SCN-IDEA-08`, previous `architecture.md` | Variant rules change move validation, serialisation, engine compatibility, and setup contracts. |
| Engine-vs-engine mode | `scenarios.md` idea scenario `SCN-IDEA-03` | Multi-engine analysis is in scope, but autonomous engine gameplay needs a separate move-loop contract. |
| Analysis bookmarks or snapshots | `scenarios.md` idea scenario `SCN-IDEA-04` | Valuable study feature, but not required for baseline restore or analysis workflows. |
| Undo/redo stack for analysis exploration | `scenarios.md` idea scenario `SCN-IDEA-06` | The baseline move-tree navigation already covers committed analysis workflows. |
| Tab-switch auto-pause | `scenarios.md` idea scenario `SCN-IDEA-11`, previous `user_settings.md` | Menu-flow auto-pause is committed; tab-switch auto-pause needs separate UX policy. |

## File and Data Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| Batch import and export workflows | `scenarios.md` idea scenario `SCN-IDEA-10` | The baseline file contract is single-game save/load. |
| Public-domain or external format support beyond the canonical JSON document | previous `plan.md`, previous `build_settings.md` | The low-level rewrite needs one stable persisted format before broader compatibility work. |

## Settings and Schema Ideas
| Idea | Source | Why Deferred |
| --- | --- | --- |
| User-created or importable custom UI themes | appearance/theme extension path after baseline `light`, `dark`, and `system` support | Baseline built-in themes only need one stable semantic CSS-variable contract before user-authored theme data is introduced. |
| Sound enablement as a committed user setting | previous low-level drift | Not required by current or planned scenarios. |
| Extra inferred board-display toggles beyond the committed baseline | previous `user_settings.md` inferred rows | Only the settings promoted into `settings_contract.md` should shape the rewrite. |

## Notes
- `Idea` scenarios remain in [scenarios.md](scenarios.md) for traceability, but this document is the main catalogue of deferred concepts.
- When an idea is promoted, update the relevant baseline document first and then remove or revise the entry here.
