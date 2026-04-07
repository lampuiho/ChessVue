# PlatformServices

## Purpose
Define the host contract selected at bootstrap and injected into the layer-2 service graph.

## Public Interface
```ts
interface IPlatformService {
  platformKey: string
  getStorageAdapter(): StorageAdapter
  getProcessManager(): ProcessManager
  getSystemThemeAdapter(): SystemThemeAdapter
  getEngineClient(): EngineClient
  subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void
  subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void
  subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void
  getEventRegistrationSnapshot(): IPlatformEventRegistration[]
}

createPlatformService(platformKey: string): IPlatformService
```

## Responsibilities
- expose concrete `StorageAdapter`, `ProcessManager`, `SystemThemeAdapter`, and `EngineClient` instances for the selected platform
- expose the small typed app-level event registration surface used by layer-2 services
- allow bootstrap or composition code to select one concrete host implementation for the active platform
- keep state stores, views, and domain models unaware of host globals or desktop-specific bootstrap code
- preserve one replacement point per platform for later real host wiring
- provide a queryable snapshot of active platform event registrations for debugging

## Rewrite-Phase Host Note
The first implementation uses adapter-backed mocked `NW.js`-style services.

That mocked host is expected to provide:

- canned document, directory, dialog, and delete failure modes for `StorageAdapter`
- scripted stdout, scripted unexpected exit, and per-session isolation for `ProcessManager`
- deterministic system-theme reads through `SystemThemeAdapter`
- scripted app-close, focus-return, and system-theme notifications through `IPlatformService`
- deterministic protocol transport hooks for `EngineClient`

## Notes
- `IPlatformService` is selected during bootstrap or other composition-root wiring, then injected into the layer-2 service graph.
- The baseline expects multiple concrete host implementations to satisfy the same `IPlatformService` contract; it does not assume a store-shaped singleton.
- State-management modules do not resolve `IPlatformService` directly.
- The returned adapters should satisfy the same contracts that later real desktop bindings will satisfy.
- `subscribeToAppCloseRequested`, `subscribeToAppFocusReturned`, and `subscribeToSystemThemeChanged` register callbacks in registration order and return an unsubscribe callback.
- App-close callbacks must be awaited before shutdown completes. One callback failure does not prevent later registered callbacks from running.
- `getEventRegistrationSnapshot()` reports active registrations only; history is intentionally out of scope for the baseline.
