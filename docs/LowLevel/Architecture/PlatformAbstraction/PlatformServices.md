# PlatformServices

## Purpose
Define the bootstrap seam that wires concrete platform adapters into the app before layer-2 services are constructed.

## Public Interface
```ts
interface IPlatformServicesStore {
  platformKey: string
  isInitialised: boolean
  initialiseFromBuildConfig(): void
  getStorageAdapter(): StorageAdapter
  getProcessManager(): ProcessManager
  getSystemThemeAdapter(): SystemThemeAdapter
  getEngineClient(): EngineClient
}

usePlatformServicesStore(): IPlatformServicesStore
```

## Responsibilities
- resolve the active platform from build configuration
- lazily initialise concrete `StorageAdapter`, `ProcessManager`, `SystemThemeAdapter`, and `EngineClient` instances for that platform
- expose those interfaces to bootstrap and layer-2 service wiring only
- keep state stores, views, and domain models unaware of host globals or desktop-specific bootstrap code
- preserve one replacement point for later real host wiring

## Rewrite-Phase Host Note
The first implementation uses adapter-backed mocked `NW.js`-style services.

That mocked host is expected to provide:

- canned document, directory, dialog, and delete failure modes for `StorageAdapter`
- scripted stdout, scripted unexpected exit, and per-session isolation for `ProcessManager`
- deterministic system-theme reads and scripted theme-change notifications for `SystemThemeAdapter`
- deterministic protocol transport hooks for `EngineClient`

## Notes
- `usePlatformServicesStore()` is the only baseline place where platform adapters are initialised and exposed.
- `initialiseFromBuildConfig()` selects the active platform from build configuration and constructs the matching adapter set once.
- The store is a bootstrap seam, not a layer-3 dependency. State-management modules do not resolve platform objects from it directly.
- The returned adapters should satisfy the same contracts that later real desktop bindings will satisfy.
