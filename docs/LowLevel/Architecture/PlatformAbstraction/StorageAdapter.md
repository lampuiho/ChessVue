# StorageAdapter

## Purpose
Persist settings snapshots, recent-games snapshots, game-session snapshots, UI-layout state, and autosaved saved-game payloads in app-local desktop storage.

## Public Interface
```ts
getSettingsSnapshot(): Promise<ISettingsSnapshot | null>
setSettingsSnapshot(snapshot: ISettingsSnapshot): Promise<void>
getRecentGamesSnapshot(): Promise<IRecentGamesSnapshot | null>
setRecentGamesSnapshot(snapshot: IRecentGamesSnapshot): Promise<void>
getGameSessionSnapshot(): Promise<IGameSessionSnapshot | null>
setGameSessionSnapshot(snapshot: IGameSessionSnapshot): Promise<void>
getUiLayoutState(): Promise<IUiLayoutState | null>
setUiLayoutState(state: IUiLayoutState): Promise<void>
listGameIds(): Promise<string[]>
getGame(gameId: string): Promise<IGameWorkspace | null>
setGame(workspace: IGameWorkspace): Promise<void>
removeGame(gameId: string): Promise<void>
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
- `getSettingsSnapshot`, `getRecentGamesSnapshot`, `getGameSessionSnapshot`, `getUiLayoutState`, and `getGame` return `null` when the artefact is absent.
- `listGameIds`, all `set...`, and `removeGame` reject with `IPlatformError` when the host storage boundary fails.
- Readable-but-invalid payloads are not silently repaired here; stores still pass loaded artefacts through `SerializationService` for migration and corruption decisions.

## Rewrite-Phase Mock Note
- The first implementation pretends to run on `NW.js` but uses an adapter-backed in-memory mock.
- The mock keeps settings, game-session, UI-layout, recent-games, and per-game saved-game payloads separated so corruption and recovery can be tested independently.
