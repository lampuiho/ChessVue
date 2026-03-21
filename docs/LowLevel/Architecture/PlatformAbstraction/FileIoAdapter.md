# FileIoAdapter

## Purpose
Handle user-driven desktop import/export of the canonical game document.

## Public Interface
```ts
saveGameDocument(document: IGameDocument): Promise<void>
loadGameDocument(): Promise<IGameDocument>
```

## Responsibilities
- open desktop file dialogs for save/load flows
- write and read the canonical JSON document only
- preserve exact-screen restore fidelity in exported files
- surface actionable errors for cancel, permission, and invalid-file failures

## Dependencies
- desktop file APIs
- `SerializationService` for serialise/parse and migration
- shared platform failure contract from `DataInterface/PlatformError`

## Failure Semantics
- `saveGameDocument` rejects with `IPlatformError` of kind `cancelled` when the user dismisses save without choosing a destination.
- `saveGameDocument` rejects with `permissionDenied` when the selected destination cannot be written.
- `loadGameDocument` rejects with `cancelled` when the user dismisses load without choosing a file.
- `loadGameDocument` rejects with `invalidDocument` when the selected file cannot produce a usable canonical saved game document after parse and migration.
- `loadGameDocument` may reject with `notFound` or `permissionDenied` when the host cannot reopen the selected file path.

## Rewrite-Phase Mock Note
- The first implementation pretends to run on `NW.js` but uses canned documents and canned error modes instead of real file dialogs.

## Notes
- Duplicate imported IDs are handled after load, before insertion into stores.
- Broader external formats and batch workflows are not baseline.
