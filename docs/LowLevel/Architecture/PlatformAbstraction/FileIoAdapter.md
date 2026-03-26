# FileIoAdapter

## Purpose
Handle user-driven desktop import/export and path-based reopen of raw saved-game documents.

## Public Interface
```ts
interface ILoadedGameDocument {
  raw: string
  filePath: string
}

saveGameDocument(raw: string): Promise<string>
loadGameDocument(): Promise<ILoadedGameDocument>
loadGameDocumentFromPath(filePath: string): Promise<string>
```

## Responsibilities
- open desktop file dialogs for save/load flows
- reopen a known saved game file without prompting when recent-game history points to a manual file path
- write and read raw canonical JSON game documents only
- surface actionable errors for cancel, permission, and invalid-file failures

## Dependencies
- desktop file APIs
- shared platform failure contract from `DataInterface/PlatformError`

## Failure Semantics
- `saveGameDocument` rejects with `IPlatformError` of kind `cancelled` when the user dismisses save without choosing a destination.
- `saveGameDocument` rejects with `permissionDenied` when the selected destination cannot be written.
- `loadGameDocument` rejects with `cancelled` when the user dismisses load without choosing a file.
- `loadGameDocument` rejects with `invalidDocument` when the selected file cannot be read as a raw document string.
- `loadGameDocument` and `loadGameDocumentFromPath` may reject with `notFound` or `permissionDenied` when the host cannot reopen the selected file path.

## Rewrite-Phase Mock Note
- The first implementation pretends to run on `NW.js` but uses canned documents and canned error modes instead of real file dialogs.

## Notes
- Duplicate imported IDs are handled after load, before insertion into stores.
- JSON parse, canonical validation, and schema migration belong to the owning stores through `SerializationService`, not to `FileIoAdapter`.
- Invalid imports are rejected atomically after store-owned deserialisation; the baseline file-flow contract does not include partial recovery.
- Broader external formats and batch workflows are not baseline.
- `saveGameDocument` returns the final written file path so recent-game metadata can point to the actual manual-save target.
