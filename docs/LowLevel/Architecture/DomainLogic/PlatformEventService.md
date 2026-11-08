# PlatformEventService

## Purpose
Expose platform event registration to layer 3 through a typed layer-2 bridge backed by `IPlatformService`.

## Public Interface
```ts
// src/domain/PlatformEventService.ts
subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void
subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void
subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void
getEventRegistrationSnapshot(): IPlatformEventRegistration[]
```

## Responsibilities
- bridge typed app-level platform events from `IPlatformService` into layer 2
- keep layer-3 stores from resolving `IPlatformService` directly
- provide one place for event-registration naming and debug snapshot access
- preserve the event semantics defined by the platform abstraction contract

## Dependencies
- `usePlatformService()`

## Notes
- Each method forwards directly to the active platform store. Registration order, unsubscribe callbacks, dispatch over a copied registration list and the copied, sorted registration snapshot are defined in [PlatformServices](../PlatformAbstraction/PlatformServices.md#event-registration-notes).
- `SavedGamesStore` registers the close-trigger autosave checkpoint. On NW.js the close action awaits it before quitting; in the browser it runs best-effort when the page is hidden or unloaded.
- `GamesStore` (`GameClockComposable`) registers focus-return clock synchronisation for an ongoing, timed, running live or live-analysis clock, and replaces or removes that registration at its existing action boundaries.
- No application code subscribes to system-theme changes: CSS `color-scheme` and `light-dark()` own system-theme styling, and `SettingsStore` neither queries nor subscribes to the OS theme. `subscribeToSystemThemeChanged` remains available for an explicit future consumer. See [SystemThemeAdapter](../PlatformAbstraction/SystemThemeAdapter.md).
- `getEventRegistrationSnapshot()` is a diagnostic read; it has no production caller and is exercised by tests and journeys.
- `EngineRuntimeService.isRuntimeAlive(...)` remains engine-runtime-specific and is not replaced by this service.
