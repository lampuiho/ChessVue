# RecentGameStore

## Purpose
Own persisted recent-game metadata for `HomeView`, including on-demand loading, latest-save deduping, and saved-target references for later reopen flows.

## Public Interface
```ts
loadRecentGames(): Promise<IRecentGameEntry[]>
recordAutosavedGame(workspace: IGameWorkspace): Promise<void>
recordSavedGame(workspace: IGameWorkspace, filePath: string, displayName?: string): Promise<void>
removeRecentGame(gameId: string): Promise<void>
pruneUnavailableRecentGames(): Promise<IRecentGameEntry[]>
```

## Responsibilities
- load recent-game entries on demand when `HomeView` becomes active
- persist recent-game metadata in a dedicated recent-games snapshot
- keep at most one recent entry per canonical `gameId`
- expose the recent list in newest-first order by `lastSavedAtUtc`
- replace an existing entry when a newer autosave or saved-file save is recorded for the same `gameId`
- remove or prune stale recent entries when the stored target no longer resolves
- avoid treating the full recent-games list as long-lived authoritative reactive store state

## Dependencies
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-03`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`

## Notes
- `RecentGameStore` consumes the layer-2 recent-games persistence path only; it does not resolve `StorageAdapter` or `FileIoAdapter` directly.
- `loadRecentGames()` is the authoritative read path for `HomeView`; any short-lived cache must be treated as disposable and non-authoritative.
- `recordAutosavedGame(...)` and `recordSavedGame(...)` share one internal upsert path keyed by `workspace.metadata.id`.
- Loading a recent entry's saved target belongs to `SavedGamesStore`; `RecentGameStore` owns only the metadata snapshot.
