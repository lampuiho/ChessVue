# StorageAdapter

## Purpose
Handle generic host storage plus generic file-system and file-dialog operations through one platform contract.

`StorageAdapter` is path-based and rootless. It operates only on explicit paths supplied by callers and does not own save-root, executable-root, or app-data path policy.

## Public Interface
```ts
interface IFileSystemEntry {
  path: string
  name: string
  isDirectory: boolean
  lastModifiedUtc?: string
}

showSaveDialog(suggestedPath?: string): Promise<string>
showOpenDialog(startDirectory?: string): Promise<string>
listDirectory(path: string): Promise<IFileSystemEntry[]>
ensureDirectory(path: string): Promise<void>
writeTextFile(path: string, raw: string, options?: {
  overwrite?: boolean
  ensureParentDirectory?: boolean
}): Promise<void>
readTextFile(path: string): Promise<string>
deleteFile(path: string): Promise<void>
```

## Responsibilities
- show host save/open dialogs and return the selected file paths
- enumerate directories, create folders when requested, and read or write raw text documents at caller-provided paths
- delete caller-provided files when the owning layer has already decided that removal is required
- avoid owning any implicit storage root; higher-layer services decide how paths such as managed save roots or executable-root-relative files are resolved

## Dependencies
- `NW.js` file-dialog capabilities
- Node file-system APIs available through the active `NW.js` runtime
- shared platform failure contract from `DataInterface/PlatformError`

## Failure Semantics
- `showSaveDialog` and `showOpenDialog` reject with `IPlatformError` of kind `cancelled` when the user dismisses the host dialog without choosing a path.
- `listDirectory` rejects with `notFound` or `permissionDenied` when the requested path cannot be enumerated.
- `ensureDirectory` rejects with `permissionDenied` when the requested directory cannot be created or confirmed.
- `writeTextFile` rejects with `alreadyExists` when overwrite is required but not permitted by the caller. Native non-overwrite writes use exclusive creation (`wx`) so an external writer cannot be silently overwritten between an existence check and the write.
- `writeTextFile` rejects with `permissionDenied` when the selected destination cannot be written.
- `writeTextFile` creates the parent directory only when `ensureParentDirectory = true`; otherwise a missing parent path remains a write failure.
- `readTextFile` rejects with `invalidDocument` when the selected file cannot be read as a raw text document.
- `readTextFile` may reject with `notFound` or `permissionDenied` when the host cannot reopen the selected file path.
- `deleteFile` rejects with `notFound` or `permissionDenied` when the host cannot remove the selected path.
- Readable-but-invalid payloads are not silently repaired here; layer-2 services still pass loaded artefacts through `SerializationService` for schema-version and corruption decisions.

## Notes
- NW.js uses file inputs for open/save selection and Node file APIs for raw file-system work.
- Browser managed files use localStorage (`chessvue:files:v1`) with virtual directories, UTF-8 text, overwrite checks and modification timestamps. Each operation reads the current index so adapter instances do not overwrite a stale cached snapshot. Storage/quota failures are typed `permissionDenied` errors; invalid indexes are `invalidDocument`.
- Browser open selection reads a real File and returns an opaque transient import token; the following read consumes it. Browser save selection returns a transient download token; the following write downloads the JSON document. Suggested paths supply filenames only, and browser pickers cannot honour a desktop start directory. Cancelling import rejects with `cancelled`; downloads follow browser save preferences.
- Journey bootstrap selects isolated sessionStorage and deterministic virtual import/export paths while using the same browser managed-file implementation.
- The adapter remains rootless and path-based even though the host is desktop-specific.
