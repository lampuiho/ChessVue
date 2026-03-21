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
- shared platform failure contract from `DataInterface/PlatformError`

## Failure Semantics
- `getSettingsSnapshot`, `getSessionSnapshot`, and `getGameDocument` return `null` when the artefact is absent.
- `listGameDocumentIds`, all `set...`, and `removeGameDocument` reject with `IPlatformError` when the host storage boundary fails.
- Readable-but-invalid payloads are not silently repaired here; stores still pass loaded artefacts through `SerializationService` for migration and corruption decisions.

## Rewrite-Phase Mock Note
- The first implementation pretends to run on `NW.js` but uses an adapter-backed in-memory mock.
- The mock keeps settings, session, and per-game documents separated so corruption and recovery can be tested independently.
