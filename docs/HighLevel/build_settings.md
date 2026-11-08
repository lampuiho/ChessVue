# ChessVue Build and Runtime Baseline

## Purpose
This document defines the committed build-time and runtime assumptions as implemented.

It is not a catalogue of all possible future targets. It reflects the chosen implementation baseline only. Deferred runtime options are tracked in [ideas.md](ideas.md).

## Baseline
- `desktop-first` design
- two platform targets: `NW.js` desktop and browser
- local filesystem and native child-process engines on desktop; Web Storage, file import/download and worker engines in the browser
- canonical internal JSON persistence on both targets
- the browser target published to GitHub Pages

## Toolchain
- Vue 3, Pinia and Vue Router, built with Vite (the `rolldown-vite` package) and TypeScript
- Zod schemas for persisted documents and contracts
- `fflate` for reading engine package archives
- the pinned `stockfish` 19.0.1 package for the bundled engine
- Vitest for unit and mounted application tests, Playwright for browser, journey and desktop tests

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Code audit (`check:code`), type checking (`type-check`) and production bundle (`build-only`) in parallel |
| `npm run check:code` | AST audit: no watchers or reactive subscriptions, no async invalidation counters, no redundant implementation return annotations, no Vue style blocks or scope-escape selectors |
| `npm run desktop` | NW.js development launcher |
| `npm run journey` | Seeded journey launcher and reports |
| `npm run test:unit`, `npm run test:e2e`, `npm run test:desktop` | Test lanes described in [plan.md](plan.md#verification-lanes) |

## Host Selection
The design remains desktop-first; the browser implements the same platform contracts. The Vue app reaches host capabilities only through the platform store plus layer-2 services.

| Variable | Values | Effect |
| --- | --- | --- |
| `CHESSVUE_PLATFORM` | `auto` (default), `nwjs`, `browser` | Compiled into `__CHESSVUE_PLATFORM__`. `getPlatformTarget()` returns a forced value, or for `auto` selects NW.js when the global `nw.Window` exists and the browser otherwise. Other values fail the build. |
| `CHESSVUE_BASE_PATH` | default `/` | Vite base path, also used as the router history base and to resolve app-served engine scripts. |

That means:

- `usePlatformService()` exposes one `IPlatformService` implementation for the selected target
- the `NW.js` implementation is built from one injected `nw` runtime instance and real NW.js plus Node APIs; forcing `nwjs` without a runtime uses a mock NW.js/Node fallback so desktop adapters can be exercised without NW.js
- browser storage, import/download, theme, lifecycle and worker adapters satisfy the same interfaces without changing layer-3 or layer-4 contracts

## Platform Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Host capability | NW.js: filesystem, native dialogs and child processes. Browser: Web Storage, IndexedDB, file input, downloads and Web Workers |
| Supported runtime family | NW.js desktop and modern browsers |
| Environment detection | Build-selected target or automatic NW.js runtime detection |
| Platform composition seam | `usePlatformService()` Pinia store exposing `IPlatformService` |
| Responsive target | Desktop layout first, with a compact layout at widths up to 760 CSS pixels; see [ui_layout.md](ui_layout.md) |
| UI scale | Root font size: a percentage of the browser font size in the browser; scaled to the window in NW.js |
| Response headers | Vite development and preview send `Permissions-Policy: geolocation=()`; a self-hosted production build should serve the same header |

### NW.js Desktop
- `npm run desktop` uses the NW.js SDK named by `CHESSVUE_NWJS_EXECUTABLE`. It starts a local Vite server on a loopback port, writes the NW.js manifest into `.desktop/development/`, enables Node access only for that loopback origin, disables Chromium's Windows location-permission integration, and keeps its Chromium profile, settings, session, layout and default `saves/` folder there.
- Closing the window awaits close autosave and engine shutdown before the launcher stops the server.
- Packaged desktop distribution is not provided; the launcher runs the development app.
- The native desktop test lane needs a real SDK and `CHESSVUE_UCI_EXECUTABLE`; `CHESSVUE_DESKTOP_INTERACTIVE=1` runs the operator checks with visible windows. See the [desktop test procedure](../../e2e/desktop/README.md).

### Browser and GitHub Pages
- The [Pages workflow](../../.github/workflows/deploy-pages.yml) builds with `CHESSVUE_PLATFORM=browser` and the repository's Pages base path, copies `dist/index.html` to `dist/404.html` so refreshed and bookmarked routes load the app, and publishes `dist/` on every push to `master` or on manual dispatch.
- GitHub still returns HTTP 404 for direct route requests served through `404.html`; navigation inside the app is unaffected.
- Browser data stays in each visitor's browser origin. Native executable engines require the desktop app.

## Engine Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Engine protocol | `UCI` only |
| Engine interfaces | `uci`: local child process (desktop only). `uciWorker`: dedicated Web Worker (both targets) |
| Bundled engine | Stockfish.js 19.0.1 lite single-threaded WASM build (`StockfishConfig`), served from `engines/stockfish/` with its licence |
| Browser engine packages | ZIP archives imported into IndexedDB (`EnginePackageConfig`: database `chessvue-engines`, store `files`, root `engine-files`) |
| Protocol/session ownership | Managed through `EngineRuntimeService` using `IEngineClient` |
| Raw process lifecycle ownership | Managed through `EngineRuntimeService` using `IProcessManager` |
| Concurrent analysis | Up to `4` analysis engines per game |
| Untimed player search | Fixed 1000 ms per move (`BuildConfig.engine.untimedMoveTimeMs`), independent of game clocks; not a user setting |
| Failure behaviour | Isolate failure per engine and allow manual retry |
| Auto-reconnect | Deferred |

The `stockfishAssets` Vite plugin (`build/StockfishAssets.ts`) serves the pinned worker, WASM and licence files during development and emits them into production builds. It prepends a small worker failure boundary that rethrows unhandled promise rejections as worker errors, because Stockfish's WASM instantiation can reject without settling its startup promise. The single-threaded build needs no cross-origin-isolation headers.

The detailed behaviour lives in [engine_runtime.md](engine_runtime.md).

## Persistence Runtime
| Setting Area | Baseline Decision |
| --- | --- |
| Autosave backend | File-backed internal save beneath user-configurable `gameSession.saveRootPath` through `SavedGameIndexService` path composition plus `SerializationService` file writes |
| Desktop storage | UTF-8 files through Node; relative paths resolve against the host working directory |
| Browser storage | One versioned localStorage index (`chessvue:files:v1`) holding the same logical paths and JSON documents; the save folder is a virtual path |
| File save/load | Desktop: user-selected paths through native dialogs. Browser: file input import and JSON download export. Both through `SerializationService` backed by `IStorageAdapter` |
| Canonical game format | One internal JSON saved game payload |
| App-owned file paths | `BuildConfig.persistence` supplies `settings.json`, `game-session.json`, and `layout-state.json` |
| Session restore | Persisted separately from settings and per-game saved-game payloads |
| Schema versioning | Required on every persisted artefact type |
| Future migration strategy | If a second schema is introduced, dispatch during deserialisation, convert on read, then resave on the next normal save cycle |
| Corrupt payload handling | Isolate bad payloads and fall back safely with a recovery warning |

The detailed behaviour, including browser lifecycle limits, lives in [persistence_contract.md](persistence_contract.md). Browser code cannot enumerate arbitrary disk directories or guarantee asynchronous work completes when a tab closes; hidden-page and page-hide events request a best-effort autosave checkpoint. Journeys use an isolated sessionStorage namespace, deterministic picker choices and scripted UCI transport.

## Routing and Shell Baseline
| Setting Area | Baseline Decision |
| --- | --- |
| Route map | `/home`, `/game/:id`, `/saved-games/save/:name`, `/saved-games/load`, `/saved-games/load/:name`, `/settings/:category` with engine profile and package child routes; `/` and unknown paths redirect to `/home`, `/settings` to `/settings/session`. See [architecture.md](architecture.md#baseline-route-shape) |
| Router history | HTML5 history mode with the configured base path |
| Analysis presentation | Integrated into `GameView` |
| Tab shell | Hide tab bar when only one game exists |
| Feature exposure | Engine package import is shown only on the browser target; native executable browsing only on desktop |

## Serialisation Scope
| Setting Area | Baseline Decision |
| --- | --- |
| Internal format | Canonical JSON document |
| Historical migrations | None; version `1` is the first schema |
| External formats | Deferred |
| Analysis persistence | Persisted as part of the canonical game payload |

## Explicitly Deferred
The following are outside the current build/runtime baseline:

- remote engine services
- mobile host targets and other host shells
- packaged desktop distribution
- standalone analysis route/view
- batch import/export
- external public-domain formats
