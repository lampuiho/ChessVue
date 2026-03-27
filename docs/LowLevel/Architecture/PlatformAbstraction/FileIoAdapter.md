# FileIoAdapter

## Purpose
Handle generic host file-system and file-dialog operations with no ChessVue-specific save semantics.

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
```

## Responsibilities
- show host save/open dialogs and return the selected file paths
- enumerate directory contents and create directories when requested by state-management workflows
- write and read raw text documents at caller-provided paths
- surface actionable errors for cancel, permission, and invalid-file failures

## Dependencies
- desktop file APIs
- shared platform failure contract from `DataInterface/PlatformError`

## Failure Semantics
- `showSaveDialog` and `showOpenDialog` reject with `IPlatformError` of kind `cancelled` when the user dismisses the host dialog without choosing a path.
- `listDirectory` rejects with `notFound` or `permissionDenied` when the requested path cannot be enumerated.
- `ensureDirectory` rejects with `permissionDenied` when the requested directory cannot be created or confirmed.
- `writeTextFile` rejects with `alreadyExists` when overwrite is required but not permitted by the caller.
- `writeTextFile` rejects with `permissionDenied` when the selected destination cannot be written.
- `readTextFile` rejects with `invalidDocument` when the selected file cannot be read as a raw text document.
- `readTextFile` may reject with `notFound` or `permissionDenied` when the host cannot reopen the selected file path.

## Rewrite-Phase Mock Note
- The first implementation pretends to run on `NW.js` but uses canned documents and canned error modes instead of real file dialogs.

## Notes
- File naming, per-game folder layout, save grouping, overwrite policy, and saved-game interpretation belong to the state-management layer, not to `FileIoAdapter`.
- JSON parse, canonical validation, and schema migration belong to the owning stores through `SerializationService`, not to `FileIoAdapter`.
- Invalid imports are rejected atomically after store-owned deserialisation; the baseline file-flow contract does not include partial recovery.
- Broader external formats and batch workflows are not baseline.
