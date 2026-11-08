# PlatformServices

## Purpose
Define the host contract exposed through the platform Pinia store and consumed by the layer-2 service graph. One store definition is selected for the active host. It composes storage, system-theme, process-lifecycle and engine-protocol capabilities with the small app-event registration surface.

## Public Interface
```ts
// src/contracts/Engine.ts (re-exported by src/contracts/platform)
const enum EngineClientType {
  Uci = 'uci',
  UciWorker = 'uciWorker',
}

// src/contracts/platform/IPlatformService.ts
interface IPlatformService {
  getStorageAdapter(): IStorageAdapter;
  getProcessManager(clientType: EngineClientType): IProcessManager;
  getSystemThemeAdapter(): ISystemThemeAdapter;
  getEngineClient(engineClientType: EngineClientType): IEngineClient;
  subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void;
  subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void;
  subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void;
  getEventRegistrationSnapshot(): IPlatformEventRegistration[];
}

// src/platform/PlatformService.ts, re-exported by src/platform/index.ts
usePlatformService(); // the selected host's platform store
```

Both concrete stores also return `triggerAppCloseRequested(): Promise<IPlatformError[]>`, `triggerAppFocusReturned()`, `triggerSystemThemeChanged(theme)` and `reset()`. These dispatch and registry-reset hooks are used by the stores' own event listeners and by tests; they are not part of `IPlatformService`, and application code does not call them.

## Responsibilities
- expose the concrete storage, system-theme, process-manager and engine-client implementations for the active host
- pair each `EngineClientType` with exactly one process manager and one engine client
- expose the typed app-level event registration surface used by `PlatformEventService`
- select the active host implementation once, from the build target and host detection
- keep state stores, views and domain models unaware of host globals, Node modules and bootstrap code
- own disposal of the process managers it constructs and the host listeners it attaches
- provide a queryable snapshot of active platform event registrations for diagnostics

## Host Selection
- `getPlatformTarget()` in `src/utility/nwjs/NwjsUtility.ts` resolves the shared `PlatformTarget` enum (`Nwjs` or `Browser`) from the build-time `__CHESSVUE_PLATFORM__` define. `vite.config.ts` reads `CHESSVUE_PLATFORM` (`auto` by default, `nwjs` or `browser`) and fails configuration for any other value.
- `auto` selects NW.js only when an override set through `setNwjsOverride(...)`, or the global `nw`, exposes `Window`. Otherwise it selects the browser host.
- `src/platform/PlatformService.ts` switches on that target once, at module evaluation: NW.js uses `defineNwjsPlatformServiceStore(getNwjs())`; browser uses `useBrowserPlatformService`. Both register the Pinia store id `platformService`. Application callers never pass a platform key.
- `getNwjs()` throws for a non-NW.js target. Under an explicit `nwjs` target it returns the override, the real `nw` global, or the cached `getMockNwjs()` host when no NW.js runtime exists, so the NW.js implementation can run without an SDK. **Why:** automatic detection must never pick that mock, otherwise an ordinary browser tab would silently run on fake desktop files and processes. The invariant is that `auto` reaches the NW.js store only when a real or explicitly injected host exists.
- `App.vue` also reads `getPlatformTarget()` to set `data-app-mode` for viewport-based scaling. That is a presentation read of the resolved target, not host access.

## Build And Deployment Targets
- `npm run dev` serves the browser host through Vite. `npm run desktop` runs `desktop/RunDesktop.mjs`, which starts a loopback Vite server with `__CHESSVUE_PLATFORM__ = 'auto'`, writes an NW.js manifest under `.desktop/development` that grants `node-remote` to that origin, and launches the SDK named by `CHESSVUE_NWJS_EXECUTABLE`. Detection then selects the NW.js store.
- `.github/workflows/deploy-pages.yml` publishes the browser build to GitHub Pages on pushes to `master`. It builds with `CHESSVUE_PLATFORM=browser` and `CHESSVUE_BASE_PATH` set to the Pages base path, then copies `index.html` to `404.html` so direct history-mode URLs load the app. The router uses `createWebHistory(import.meta.env.BASE_URL)`, and Worker entry URLs resolve against the same base.
- The `stockfishAssets()` Vite plugin (`build/StockfishAssets.ts`) serves in development, and emits at build time, the bundled Stockfish files listed by `StockfishConfig` under `engines/stockfish/`. It prefixes the worker script with an `unhandledrejection` relay. **Why:** Stockfish's WASM-instantiation promise can reject without settling its module startup, which would leave the UCI handshake pending forever. Rethrowing it raises an ordinary Worker `error` event, so `BrowserWorkerProcess` closes with a diagnostic and the client fails the session. See [JourneyImplementation](../../../ArchivedPlans/JourneyImplementation.md#ordinary-browser-implementation).

## Engine Bindings
| Host | `EngineClientType.Uci` | `EngineClientType.UciWorker` |
| --- | --- | --- |
| NW.js | `NwjsProcessManager(EngineClientType.Uci)` with `NwjsUciEngineClient` | `NwjsProcessManager(EngineClientType.UciWorker)` with `BrowserUciEngineClient` |
| Browser | Registered only when `setBrowserPlatformOptions({ createEngineServices })` supplies a pair (journeys) | `BrowserProcessManager` with `BrowserUciEngineClient` |

- Both getters read one private `Map<EngineClientType, { processManager, engineClient }>`. An unregistered type throws `Unsupported engine client type: ...`, which reaches the caller's existing runtime error handling. **Why:** the manager and the client share the process object stored on `engine.$.process`; resolving them through independent switches could pair a native client with a Worker process. One enum value selects the complete pair, so a replacement must keep the pairing in one table. See [EngineInstallationReworkPlan](../../../ArchivedPlans/EngineInstallationReworkPlan.md#mixed-runtime-and-ui).
- The desktop registers both bindings, so one game may mix native executables and Worker scripts. The browser cannot launch native executables; a `Uci` profile there fails when its binding is requested.
- Managers and clients are plain class instances constructed with `markRaw(...)` and retained by the platform store. There is no per-client Pinia store, factory, bound-method facade, transport resolver or process registry. **Why:** the earlier client stores and registries duplicated object identity that the runtime already holds, and a reactive proxy would break the identity comparisons that the client and manager perform on shared process objects. See [BrowserEngineDependencyFixPlan](../../../ArchivedPlans/BrowserEngineDependencyFixPlan.md).

## Browser Composition
- `useBrowserPlatformService` constructs `defineBrowserStorageAdapterStore(storage, storageKey)()`, `markRaw(new BrowserProcessManager())`, `markRaw(new BrowserUciEngineClient())` and `new BrowserSystemThemeAdapter()`.
- `setBrowserPlatformOptions({ storage?, storageKey?, createEngineServices? })` must run during bootstrap, before any platform store is created. `journeys/PrepareJourney.ts` uses it to select isolated `sessionStorage`, a run-specific file-index key and a scripted native pair: `NwjsProcessManager(EngineClientType.Uci)` and `NwjsUciEngineClient` over `ScriptedEngine` processes installed through `setNodeModuleOverrides(...)`.
- Window `pagehide` and `visibilitychange` to hidden dispatch app-close checkpoints. Window `focus` and `visibilitychange` to visible dispatch focus-returned callbacks. The `prefers-color-scheme` media listener is attached on the first theme subscription.
- Close checkpoints are started, not awaited, by the page; their failures are logged. **Why:** a browser cannot keep a closing tab open for asynchronous work, so these checkpoints are best-effort. Focus-callback failures are logged and do not stop later callbacks.
- Scope disposal removes the window, document and media listeners, starts `BrowserProcessManager.dispose()` and logs its rejection, then clears registrations.

## NW.js Composition
- `defineNwjsPlatformServiceStore(nw)` creates the storage and system-theme adapter stores from the injected `nw` object, two `NwjsProcessManager` instances, one `NwjsUciEngineClient` and one `BrowserUciEngineClient`.
- The native window `close` and `focus` listeners, and the theme media listener, attach on the first subscription to the matching event.
- A native close starts one close action. It awaits every close callback in registration order, collecting failures, then settles both managers with `Promise.allSettled`, then calls `nw.App.quit()`. An injected host without `App` falls back to `nativeWindow.close(true)`. **Why:** close-trigger autosave must finish while the window still exists; managers must drain so native engine children are not left running; and a real-host run showed that closing the last window could leave the NW.js application alive without `App.quit`. Callback or process-stop failures do not prevent the remaining cleanup or exit. See [desktop scenario review](../../../../journeys/definitions/desktop/ScenarioReview.md).
- Focus callbacks are awaited in registration order. Unlike close checkpoints and the browser host, a throwing NW.js focus callback stops the remaining focus callbacks.
- Store-scope disposal detaches the native close, focus and theme listeners, clears registrations and then settles both managers' disposal. Vue does not await scope callbacks, so that settlement is owned by the disposal function itself.

## Event Registration Notes
- `subscribeToAppCloseRequested`, `subscribeToAppFocusReturned` and `subscribeToSystemThemeChanged` record a registration with a generated `registrationId`, the `PlatformEventKey`, the caller-supplied owner and debug label, and a `RegistrationTimestamp`. They return an unsubscribe callback.
- Dispatch iterates a copied registration list, so a callback may unsubscribe without disturbing the active iteration.
- `getEventRegistrationSnapshot()` reports active registrations only, sorted by registration time and then id. It returns copies of the public registration records. **Why:** returning registry objects would let diagnostic consumers mutate active registrations or observe private callback wrappers, while sorting the live array would mutate platform-owned ordering. History is out of scope.
- The application currently registers close checkpoints (`SavedGamesStore`) and focus return (`GamesStore` clock synchronisation). No application code subscribes to system-theme changes: CSS `color-scheme` and `light-dark()` own system-theme selection. The theme event remains a platform capability for an explicit future consumer.

## Notes
- `usePlatformService()` is the composition-root boundary. Layer-2 services call it lazily; state stores and presentation do not.
- `EngineRuntimeService` composes `ProcessManager` and `EngineClient` from layer 2. Layer-1 modules do not call one another.
- Shared `nw` resolution and Node-module access are implementation support, documented in [UtilityIndex](../UtilityIndex.md#platform-host-support), not part of the public platform contract.
- The concrete pieces are documented with their contracts: [StorageAdapter](StorageAdapter.md), [ProcessManager](ProcessManager.md), [SystemThemeAdapter](SystemThemeAdapter.md) and [EngineClient](EngineClient.md).
