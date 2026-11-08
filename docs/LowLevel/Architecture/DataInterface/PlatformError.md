# Platform Error Types

## Purpose
Define the shared typed failure contract used by platform-layer adapters and the engine-package boundary. Source: `contracts/PlatformError.ts`.

These errors describe host-boundary failures only. They do not replace domain validation or schema-version decisions owned elsewhere; the other shared error classes are listed under [Other Shared Error Classes](#other-shared-error-classes).

## Types
- `enum PlatformErrorKind`
- `class PlatformError`

## Interfaces
- `interface IPlatformError`

## Data Structures
```ts
const enum PlatformErrorKind {
  Cancelled = "cancelled",
  NotFound = "notFound",
  AlreadyExists = "alreadyExists",
  PermissionDenied = "permissionDenied",
  InvalidDocument = "invalidDocument",
  InvalidProcessHandle = "invalidProcessHandle",
  ProcessStartFailed = "processStartFailed",
  UnexpectedExit = "unexpectedExit",
  InvalidOperation = "invalidOperation"
}

interface IPlatformError {
  kind: PlatformErrorKind
  operation: string
  message: string
  detail?: string
}

class PlatformError extends Error implements IPlatformError {
  constructor(err: IPlatformError)
  kind: PlatformErrorKind
  operation: string
  detail?: string
}
```

## Schemas
- `platformErrorKinds` feeds `platformErrorKindSchema`.
- `platformErrorSchema` requires non-empty `operation` and `message` and an optional `detail`.

## Rules
- Platform adapters reject failed host-boundary operations with an `IPlatformError`. Some producers reject with a plain object literal (the NW.js storage adapter, NW.js process manager and platform service, and the UCI client base), while others throw a `PlatformError` instance (browser adapters, the worker process manager, `BrowserWorkerProcess`, `EnginePackageService`, and `EnginesStore`). `PlatformError` is an `Error`, so generic `instanceof Error` handlers can read its `message`.
- Consumers that branch on a kind therefore use a structural check (`isPlatformError(...)` in `@/utility/errors` or a local `'kind' in error` test), not `instanceof PlatformError`. `instanceof PlatformError` is valid only where every producer on that path constructs the class, as in the engine-package flows.
- `toPlatformError(operation, error)` in `@/utility/errors` normalises a caught value for logging or display: an existing `IPlatformError` keeps its kind with the new `operation`, and any other value becomes `unexpectedExit`.
- `cancelled` is user-initiated and must not mutate app state. File pickers report it when the user dismisses the dialog without choosing a path.
- Missing files or directories in `StorageAdapter` are represented by `notFound`, not by `cancelled`.
- `alreadyExists` is used when a write would overwrite an existing file but the caller has not allowed overwrite.
- `permissionDenied` covers host refusal to read or write, including browser storage that cannot be read or written and a file picker that cannot open or read the selection.
- `invalidDocument` is used when the selected file or host payload cannot produce a usable canonical document, including an invalid browser file index, a picked file that is not UTF-8 text, and an unreadable or invalid engine package. The NW.js storage adapter also uses it for native file-system errors it cannot classify, and `EnginesStore` uses it when engine files were written or removed but the package list could not be refreshed (`detail` carries the package path).
- `invalidProcessHandle` means a stored process reference is closed or no longer usable. `EngineRuntimeService` treats it as recoverable: readying an engine respawns the process, and an operation on an initialised engine re-initialises and retries once.
- `processStartFailed` means a process or engine session could not be started, or an operation needs an initialised session that does not exist.
- `unexpectedExit` is used for process sessions that started successfully and then terminated or stopped accepting commands unexpectedly. It is also the fallback kind for platform event-callback failures and for values normalised by `toPlatformError(...)`.
- `invalidOperation` means the request is not allowed in the current host or state: engine-package import or removal on a host that does not support it, removal of a package that is not an imported folder or is still referenced, and a browser file-system write or directory creation that conflicts with an existing directory or file.

## Other Shared Error Classes
`contracts/errors` holds the error classes that are not platform failures.

- `SerializationError` (`message`, readonly `causeDetail: unknown`, `name = "SerializationError"`) is raised by `SerializationService` for invalid JSON, schema failures, unsupported schema versions, and structural move-tree or session-reference failures. `causeDetail` is `null` when no cause was supplied.
- `Aborted` (default export) marks expected cancellation: a superseded engine analysis operation and a cleared pending player turn reject with it. Consumers treat it as non-failure, so it does not set engine availability to `failed` and is not logged.
- `InvalidMove` (default export) takes the rejected `IMove` and logs it on construction. It has no current producer; move validation failures currently throw a plain `Error`.
- `errors/index.ts` re-exports these modules with `export *`, which does not re-export default exports; consumers import `Aborted` from `@/contracts/errors/Aborted` directly.
