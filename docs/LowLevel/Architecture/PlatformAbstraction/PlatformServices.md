# PlatformServices

## Purpose
Define the single Pinia-backed seam that wires concrete platform adapters into the app.

## Public Interface
```ts
interface IPlatformServicesStore {
  platformKey: string
  isInitialised: boolean
  initialiseFromBuildConfig(): void
  getStorageAdapter(): StorageAdapter
  getFileIoAdapter(): FileIoAdapter
  getProcessManager(): ProcessManager
}

usePlatformServicesStore(): IPlatformServicesStore
```

## Responsibilities
- resolve the active platform from build configuration
- lazily initialise concrete `StorageAdapter`, `FileIoAdapter`, and `ProcessManager` instances for that platform
- expose those interfaces to the StateManagement layer through one Pinia store
- keep stores, views, and domain services unaware of host globals or desktop-specific bootstrap code
- preserve one replacement point for later real host wiring

## Rewrite-Phase Host Note
The first implementation uses adapter-backed mocked `NW.js`-style services.

That mocked host is expected to provide:

- in-memory artefact-separated persistence for `StorageAdapter`
- canned document and canned failure modes for `FileIoAdapter`
- scripted stdout, scripted unexpected exit, and per-session isolation for `ProcessManager`

## Notes
- `usePlatformServicesStore()` is the only baseline place where platform adapters are initialised and exposed.
- `initialiseFromBuildConfig()` selects the active platform from build configuration and constructs the matching adapter set once.
- The StateManagement layer obtains `StorageAdapter`, `FileIoAdapter`, and `ProcessManager` from this store rather than constructing platform objects directly.
- The returned adapters should satisfy the same contracts that later real desktop bindings will satisfy.
