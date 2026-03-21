# Platform Error Types

## Purpose
Define the shared typed failure contract used by platform-layer adapters during the rewrite baseline.

These errors describe host-boundary failures only. They do not replace domain validation or schema-migration decisions owned elsewhere.

## Types
- `type PlatformErrorKind = "cancelled" | "notFound" | "permissionDenied" | "invalidDocument" | "processStartFailed" | "unexpectedExit"`

## Interfaces
- `interface IPlatformError`

## Data Structures
```ts
type PlatformErrorKind =
  | "cancelled"
  | "notFound"
  | "permissionDenied"
  | "invalidDocument"
  | "processStartFailed"
  | "unexpectedExit"

interface IPlatformError {
  kind: PlatformErrorKind
  operation: string
  message: string
  detail: string | null
  isRecoverable: boolean
}
```

## Rules
- Platform adapters reject failed host-boundary operations with `IPlatformError`.
- `cancelled` is user-initiated and must not mutate app state.
- Missing persisted artefacts in `StorageAdapter` are represented by `null` return values, not by `cancelled`.
- `invalidDocument` is used when the selected file or host payload cannot produce a usable canonical document.
- `unexpectedExit` is reserved for process sessions that started successfully and then terminated unexpectedly.
