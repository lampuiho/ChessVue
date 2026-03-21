# PlatformServices

## Purpose
Define the single bootstrap seam that wires concrete platform adapters into the app.

## Public Interface
```ts
interface IPlatformServices {
  storageAdapter: StorageAdapter
  fileIoAdapter: FileIoAdapter
  processManager: ProcessManager
}

createPlatformServices(): IPlatformServices
```

## Responsibilities
- centralise creation of concrete `StorageAdapter`, `FileIoAdapter`, and `ProcessManager` instances
- keep stores, views, and domain services unaware of host globals or desktop-specific bootstrap code
- make the rewrite-phase host look like `NW.js` without coupling the rest of the app to `NW.js`
- preserve one replacement point for later real host wiring

## Rewrite-Phase Host Note
The first implementation uses adapter-backed mocked `NW.js`-style services.

That mocked host is expected to provide:

- in-memory artefact-separated persistence for `StorageAdapter`
- canned document and canned failure modes for `FileIoAdapter`
- scripted stdout, scripted unexpected exit, and per-session isolation for `ProcessManager`

## Notes
- `createPlatformServices()` is the only baseline place where mocked host services are wired into the app.
- The returned adapters should satisfy the same contracts that later real desktop bindings will satisfy.
