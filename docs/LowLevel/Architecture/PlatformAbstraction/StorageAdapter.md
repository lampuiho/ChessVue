# StorageAdapter

## Purpose
Persist settings snapshots, session snapshots, and autosaved game documents in app-local desktop storage.

## Public Interface
```ts
getSettingsSnapshot(): Promise<ISettingsSnapshot | null>
setSettingsSnapshot(snapshot: ISettingsSnapshot): Promise<void>
getSessionSnapshot(): Promise<ISessionSnapshot | null>
setSessionSnapshot(snapshot: ISessionSnapshot): Promise<void>
listGameDocumentIds(): Promise<string[]>
getGameDocument(gameId: string): Promise<IGameDocument | null>
setGameDocument(document: IGameDocument): Promise<void>
removeGameDocument(gameId: string): Promise<void>
```

## Responsibilities
- isolate persisted artefact types instead of exposing an untyped shared key/value API
- keep schema-versioned payloads separated by artefact class
- support corruption isolation per artefact
- support eventual consistency for autosave flows

## Dependencies
- underlying desktop persistence mechanism

## Notes
- `StorageAdapter` does not perform schema migration; `SerializationService` does that on read.
- Optional corrupted sections inside a game document may be replaced with safe defaults after migration.
