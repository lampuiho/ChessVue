# Platform Event Registration

## Purpose
Define the shared debug snapshot shape used to inspect active platform event registrations.

## Types
- `type PlatformEventKey = "appCloseRequested" | "appFocusReturned" | "systemThemeChanged"`

## Interfaces
- `interface IPlatformEventRegistration`

## Data Structures
```ts
type PlatformEventKey = "appCloseRequested" | "appFocusReturned" | "systemThemeChanged"

interface IPlatformEventRegistration {
  registrationId: string
  eventKey: PlatformEventKey
  owner: string
  debugLabel: string | null
  registeredAtUtc: string
}
```

## Rules
- The snapshot reports active registrations only.
- `registrationId` is an opaque host-generated identifier used for inspection, not application logic.
- `owner` should identify the logical subscriber such as a store, service, or game-session scope.
- `debugLabel` is optional human-readable context for diagnostics.
