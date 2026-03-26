# RecentGameStore

## Purpose
Own persisted recent-game metadata for `HomeView`, including on-demand loading, latest-save deduping, and reopen routing for autosave-backed and manual-file-backed entries.

## Public Interface
```ts
loadRecentGames(): Promise<IRecentGameEntry[]>
recordAutosavedGame(workspace: IGameWorkspace): Promise<void>
recordManuallySavedGame(workspace: IGameWorkspace, filePath: string, displayName?: string): Promise<void>
removeRecentGame(gameId: string): Promise<void>
pruneUnavailableRecentGames(): Promise<IRecentGameEntry[]>
openRecentGame(gameId: string): Promise<IGameWorkspace>
```

## Responsibilities
- load recent-game entries on demand when `HomeView` becomes active
- persist recent-game metadata in a dedicated recent-games snapshot
- keep at most one recent entry per canonical `gameId`
- expose the recent list in newest-first order by `lastSavedAtUtc`
- replace an existing entry when a newer autosave or manual-file save is recorded for the same `gameId`
- reopen autosave-backed entries through `StorageAdapter`
- reopen manual-file-backed entries through `FileIoAdapter`
- remove or prune stale recent entries when the stored target no longer resolves
- avoid treating the full recent-games list as long-lived authoritative reactive store state

## Dependencies
- `PlatformServices`
- `SerializationService`
- `GamesStore`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-03`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-LOAD-01`

## Notes
- `RecentGameStore` resolves `StorageAdapter` and `FileIoAdapter` through `usePlatformServicesStore()`.
- `loadRecentGames()` is the authoritative read path for `HomeView`; any short-lived cache must be treated as disposable and non-authoritative.
- `recordAutosavedGame(...)` and `recordManuallySavedGame(...)` share one internal upsert path keyed by `workspace.metadata.id`.
- Manual-file reopen stays on the state-management side of the boundary: `FileIoAdapter` returns raw document text, and `RecentGameStore` uses `SerializationService` before handing the workspace to `GamesStore.insertGame(...)`.
- When `GamesStore.importGame` loads a manual file and repairs duplicate IDs, the recent entry must be written only after the final in-app `gameId` is known.
