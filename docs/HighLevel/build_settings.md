# ChessVue Build and Runtime Baseline

## Purpose
This document defines the committed build-time and runtime assumptions for the rewrite baseline.

Unlike earlier notes, this is not a catalogue of all possible future targets. It reflects the chosen implementation baseline only.

## Baseline
- `desktop-first`
- local filesystem access
- local child-process engine runtime
- canonical internal JSON persistence
- adapter-backed mocked `NW.js` host services during the rewrite phase

Deferred runtime options are tracked in [ideas.md](ideas.md).

## Rewrite-Phase Host Assumption
The first rewrite implementation should behave as if the desktop host were `NW.js`, but the Vue app must only see state stores plus layer-2 services.

That means:

- `StorageAdapter`, `ProcessManager`, `SystemThemeAdapter`, and `EngineClient` are wired during platform bootstrap and then exposed upward through layer-2 service boundaries
- the initial concrete implementations are mocked `NW.js`-style services behind those adapters
- real host wiring may replace the mocks later without changing layer-3 or layer-4 contracts

## Platform Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Host capability | Desktop shell with filesystem and process access |
| Supported runtime family | Desktop only for the current rewrite baseline |
| Environment detection | Minimal desktop-capability bootstrap only |
| Rewrite-phase host fiction | Mocked `NW.js`-style services behind platform adapters |
| Adapter bootstrap seam | `usePlatformServicesStore().initialiseFromBuildConfig()` |
| Responsive target | Desktop layout first; compact and mobile-specific behaviour is deferred |

## Engine Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Engine protocol | `UCI` only |
| Engine transport | Local child process |
| Protocol/session ownership | Managed through `EngineClient` |
| Raw process ownership | Managed through `ProcessManager` |
| Concurrent analysis | Up to `4` analysis engines per game |
| Failure behaviour | Isolate failure per engine and allow manual retry |
| Auto-reconnect | Deferred |

The detailed behaviour lives in [engine_runtime.md](engine_runtime.md).

## Persistence Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Autosave backend | File-backed internal save beneath `session.saveRootPath` |
| File save/load | User-selected desktop file paths via `StorageAdapter` |
| Canonical game format | One internal JSON saved game payload |
| Session restore | Persisted separately from settings and per-game saved-game payloads |
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
| Analysis persistence | No persisted streamed-analysis snapshot requirement in the baseline |

## Explicitly Deferred
The following are outside the current build/runtime baseline:

- browser or WASM engine support
- remote engine services
- mobile host targets
- standalone analysis route/view
- batch import/export
- external public-domain formats
