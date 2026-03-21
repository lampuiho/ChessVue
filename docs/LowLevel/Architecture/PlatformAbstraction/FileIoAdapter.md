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

## Notes
- Duplicate imported IDs are handled after load, before insertion into stores.
- Broader external formats and batch workflows are not baseline.
