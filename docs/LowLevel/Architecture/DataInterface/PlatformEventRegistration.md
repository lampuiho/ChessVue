# Platform Event Registration

## Purpose
Define the shared debug snapshot shape used to inspect active platform event registrations.

## Types
- `enum PlatformEventKey`

## Interfaces
- `interface IPlatformEventRegistration`

## Data Structures
```ts
enum PlatformEventKey {
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
- The snapshot reports active registrations only.
- `registeredAtUtc` uses `RegistrationTimestamp`. **Why:** diagnostic sorting needs date arithmetic while diagnostic display needs registration-specific formatting; leaving it as a string would make each consumer parse and format the same instant independently.
- `registrationId` is an opaque host-generated identifier used for inspection, not application logic.
- `owner` should identify the logical subscriber such as a store, service, or game-session scope.
- `debugLabel` is optional human-readable context for diagnostics.
