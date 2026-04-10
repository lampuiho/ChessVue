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
  lastModifiedUtc: string | null
}

showSaveDialog(suggestedPath?: string): Promise<string>
showOpenDialog(startDirectory?: string): Promise<string>
listDirectory(path: string): Promise<IFileSystemEntry[]>
ensureDirectory(path: string): Promise<void>
writeTextFile(path: string, raw: string, overwrite?: boolean): Promise<void>
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
- `writeTextFile` rejects with `alreadyExists` when overwrite is required but not permitted by the caller.
- `writeTextFile` rejects with `permissionDenied` when the selected destination cannot be written.
- `readTextFile` rejects with `invalidDocument` when the selected file cannot be read as a raw text document.
- `readTextFile` may reject with `notFound` or `permissionDenied` when the host cannot reopen the selected file path.
- `deleteFile` rejects with `notFound` or `permissionDenied` when the host cannot remove the selected path.
- Readable-but-invalid payloads are not silently repaired here; layer-2 services still pass loaded artefacts through `SerializationService` for migration and corruption decisions.

## Notes
- The current implementation uses `NW.js` file inputs for open/save selection and Node file APIs for raw file-system work.
- The adapter remains rootless and path-based even though the host is desktop-specific.
