# Platform Event Registration

## Purpose
Define the shared debug snapshot shape used to inspect active platform event registrations. Sources: `contracts/platform/PlatformEventKey.ts` and `contracts/platform/IPlatformEventRegistration.ts`.

## Types
- `enum PlatformEventKey`

## Interfaces
- `interface IPlatformEventRegistration`

## Data Structures
```ts
const enum PlatformEventKey {
  AppCloseRequested = "appCloseRequested",
  AppFocusReturned = "appFocusReturned",
  SystemThemeChanged = "systemThemeChanged"
}

interface IPlatformEventRegistration {
  registrationId: string
  eventKey: PlatformEventKey
  owner: string
  debugLabel?: string
  registeredAtUtc: RegistrationTimestamp
}
```

## Rules
- Each `IPlatformService.subscribeTo*` call records one registration under the matching `PlatformEventKey`, and the returned unsubscribe function removes it. `IPlatformService.getEventRegistrationSnapshot()`, exposed through `PlatformEventService`, returns the active registrations.
- The snapshot reports active registrations only.
- `registeredAtUtc` uses `RegistrationTimestamp`. **Why:** diagnostic sorting needs date arithmetic while diagnostic display needs registration-specific formatting; leaving it as a string would make each consumer parse and format the same instant independently.
- `registrationId` is an opaque host-generated identifier used for inspection, not application logic.
- `owner` should identify the logical subscriber such as a store, service, or game-session scope (for example `GamesStore` for clock focus-return registrations and `SavedGamesStore` for close-trigger autosave).
- `debugLabel` is optional human-readable context for diagnostics (for example `sync-clock-<gameId>` or `autosave-on-close`).
- `SystemThemeChanged` remains available on the platform contract, but app styling does not subscribe to it; see [Appearance](Appearance.md).
