# PlatformServices

## Purpose
Define the host contract exposed through the platform Pinia store and injected into the layer-2 service graph.

## Public Interface
```ts
enum EngineClientType {
  Uci = "uci",
  UciWorker = "uciWorker",
}

interface IPlatformService {
  getStorageAdapter(): StorageAdapter
  getProcessManager(engineClientType: EngineClientType): IProcessManager
  getSystemThemeAdapter(): SystemThemeAdapter
  getEngineClient(engineClientType: EngineClientType): EngineClient
  subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void
  subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void
  subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void
  getEventRegistrationSnapshot(): IPlatformEventRegistration[]
}

usePlatformService(): IPlatformService
```

## Responsibilities
- expose concrete `StorageAdapter`, `ProcessManager`, `SystemThemeAdapter`, and `EngineClient` instances for the active build target
- expose the small typed app-level event registration surface used by layer-2 services
- select the active host implementation at bootstrap from the build target, with automatic NW.js detection when the target is `auto`
- keep state stores, views, and domain models unaware of host globals or desktop-specific bootstrap code
- preserve one replacement point per platform for later additional host wiring
- provide a queryable snapshot of active platform event registrations for debugging

## Current Host Note
The default build target is `auto`: use NW.js when its runtime exists, otherwise browser. `CHESSVUE_PLATFORM=browser` and `CHESSVUE_PLATFORM=nwjs` explicitly force a host; invalid values fail configuration. Explicit NW.js selection retains the mock host fallback when the desktop runtime is missing, so the NW.js implementation can be tested without installing NW.js. Automatic detection ignores that fallback and selects browser when no real or explicitly injected NW.js runtime exists. Resolved targets use the shared `PlatformTarget` enum. `getNwjs()` rejects calls for non-NW.js targets; browser composition never calls it.

The NW.js storage and system-theme adapter factories use the injected nw instance. Process managers and engine clients are plain raw class instances owned by the platform store. Any required Node modules are resolved separately through implementation-support utilities because NW.js exposes them differently from hosts such as Electron.

NW.js constructs two raw instances of NwjsProcessManager, configured by EngineClientType.Uci and EngineClientType.UciWorker, paired with NwjsUciEngineClient and BrowserUciEngineClient respectively. Browser uses BrowserProcessManager for UciWorker; the existing journey seam directly constructs the scripted native pair after setting Node overrides. Both concrete managers derive private shared implementation. Process-manager and client lookups use the same single enum.

Platform-scope disposal starts cleanup of its exact manager instances and observes rejected cleanup promises through logging. Concrete manager disposal cancels pending stored launches, closes its own Workers and awaits stored-file service-worker unregistration. The public IProcessManager contract and existing native-process/app-close ownership stay unchanged.

## Notes
- `usePlatformService()` is the composition-root boundary for the active host implementation.
- The implementation is selected once at bootstrap from build configuration and host detection; application callers do not pass platform keys.
- `EngineRuntimeService` composes `ProcessManager` and `EngineClient` from layer 2; layer-1 modules do not call one another.
- State-management modules do not resolve host globals directly.
- Shared `nw` instance for all sub-services store initialisation and NW.js-exposed Node-module access are implementation-support concerns and should be documented through `UtilityIndex.md`, not as part of the public platform abstraction contract.
- The returned adapters should satisfy the same contracts that later real desktop bindings will satisfy.
- `subscribeToAppCloseRequested`, `subscribeToAppFocusReturned`, and `subscribeToSystemThemeChanged` register callbacks in registration order and return an unsubscribe callback.
- NW.js app-close callbacks are awaited before shutdown. The browser dispatches callbacks at visibility-hidden/page-hide checkpoints and cannot hold a closing tab open for asynchronous work. One callback failure does not prevent later registered callbacks from running. Browser listeners are detached when the platform store scope is disposed.
- `getEventRegistrationSnapshot()` reports active registrations only; history is intentionally out of scope for the baseline. It returns sorted copies of the public registration records. **Why:** returning registry objects would let diagnostic consumers mutate active registrations or observe private callback wrappers, while sorting the live array would mutate platform-owned ordering.
