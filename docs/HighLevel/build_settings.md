# ChessVue Build and Runtime Baseline

## Purpose
This document defines the committed build-time and runtime assumptions for the rewrite baseline.

Unlike earlier notes, this is not a catalogue of all possible future targets. It reflects the chosen implementation baseline only.

## Baseline
- `desktop-first`
- local filesystem access
- local child-process engine runtime
- canonical internal JSON persistence
- `NW.js` build target

Deferred runtime options are tracked in [ideas.md](ideas.md).

## Host Assumption
The current rewrite implementation targets `NW.js`, and the Vue app reaches host capabilities only through the platform stores plus layer-2 services.

That means:

- build configuration selects the active platform target
- `usePlatformService()` exposes one `IPlatformService` implementation for that build target
- the `NW.js` implementation is built from one shared injected `nw` runtime instance and real NW.js plus Node APIs
- later host implementations may replace the NW.js stores without changing layer-3 or layer-4 contracts

## Platform Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Host capability | Desktop shell with filesystem and process access |
| Supported runtime family | Desktop only for the current rewrite baseline |
| Environment detection | Build-selected platform target |
| Current host target | `NW.js` |
| Platform composition seam | `usePlatformService()` Pinia store exposing `IPlatformService` |
| Responsive target | Desktop layout first; compact and mobile-specific behaviour is deferred |

## Engine Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Engine protocol | `UCI` only |
| Engine transport | Local child process |
| Protocol/session ownership | Managed through `EngineRuntimeService` using `EngineClient` |
| Raw process lifecycle ownership | Managed through `EngineRuntimeService` using `ProcessManager` |
| Concurrent analysis | Up to `4` analysis engines per game |
| Failure behaviour | Isolate failure per engine and allow manual retry |
| Auto-reconnect | Deferred |

The detailed behaviour lives in [engine_runtime.md](engine_runtime.md).

## Persistence Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Autosave backend | File-backed internal save beneath user-configurable `gameSession.saveRootPath` through `SavedGameIndexService` path composition plus `SerializationService` file writes |
| File save/load | User-selected desktop file paths through `SerializationService`, backed by `StorageAdapter` |
| Canonical game format | One internal JSON saved game payload |
| App-owned file paths | Build config supplies the concrete paths for `settings.json`, `game-session.json`, and `layout-state.json` |
| Session restore | Persisted separately from settings and per-game saved-game payloads through `SerializationService` |
| Schema versioning | Required on every persisted artefact type |
| Migration strategy | Migrate on read, resave on next normal save cycle |
| Corrupt payload handling | Isolate bad payloads and fall back safely |

The detailed behaviour lives in [persistence_contract.md](persistence_contract.md).

## Routing and Shell Baseline
| Setting Area | Baseline Decision |
| --- | --- |
| Route map | `/home`, `/game/:id`, `/saved-games/save/:name`, `/saved-games/load`, `/saved-games/load/:name`, `/settings`, `/settings/:category` |
| Analysis presentation | Integrated into `GameView` |
| Tab shell | Hide tab bar when only one game exists |
| Feature exposure | Only baseline desktop features are assumed to exist |

## Serialisation Scope
| Setting Area | Baseline Decision |
| --- | --- |
| Internal format | Canonical JSON document |
| Migration support | Required |
| External formats | Deferred |
| Analysis persistence | Persisted as part of the canonical game payload |

## Explicitly Deferred
The following are outside the current build/runtime baseline:

- browser or WASM engine support
- remote engine services
- mobile host targets
- standalone analysis route/view
- batch import/export
- external public-domain formats
