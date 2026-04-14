# Platform Error Types

## Purpose
Define the shared typed failure contract used by platform-layer adapters during the rewrite baseline.

These errors describe host-boundary failures only. They do not replace domain validation or schema-migration decisions owned elsewhere.

## Types
- `enum PlatformErrorKind`

## Interfaces
- `interface IPlatformError`

## Data Structures
```ts
enum PlatformErrorKind {
  Cancelled = "cancelled",
  NotFound = "notFound",
  AlreadyExists = "alreadyExists",
  PermissionDenied = "permissionDenied",
  InvalidDocument = "invalidDocument",
  ProcessStartFailed = "processStartFailed",
  UnexpectedExit = "unexpectedExit"
}

interface IPlatformError {
  kind: PlatformErrorKind
  operation: string
  message: string
  detail?: string
}
```

## Rules
- Platform adapters reject failed host-boundary operations with `IPlatformError`.
- `cancelled` is user-initiated and must not mutate app state.
- Missing files or directories in `StorageAdapter` are represented by `notFound`, not by `cancelled`.
- `alreadyExists` is used when a write would overwrite an existing file but the caller has not allowed overwrite.
- `invalidDocument` is used when the selected file or host payload cannot produce a usable canonical document.
- `unexpectedExit` is reserved for process sessions that started successfully and then terminated unexpectedly.
