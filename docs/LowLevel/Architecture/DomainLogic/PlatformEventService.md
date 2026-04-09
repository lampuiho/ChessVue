# PlatformEventService

## Purpose
Expose platform event registration to layer 3 through a typed layer-2 bridge backed by `IPlatformService`.

## Public Interface
```ts
subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void
subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void
subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void
getEventRegistrationSnapshot(): IPlatformEventRegistration[]
```

## Responsibilities
- bridge typed app-level platform events from `IPlatformService` into layer 2
- keep layer-3 stores from resolving `IPlatformService` directly
- provide one place for event-registration naming and debug snapshot access
- preserve the committed event semantics defined by the platform abstraction contract

## Dependencies
- `IPlatformService`

## Notes
- Session-owned workflows such as close-trigger autosave and focus-return clock reconciliation register and unregister through this service.
- `SettingsStore` uses this service to react to later system-theme changes while continuing to read the current theme through its existing theme-resolution path.
- `EngineRuntimeService.getSession(...)` remains engine-runtime-specific and is not replaced by this service.
