# RecentGameStore

## Purpose
Own on-demand recent-game projection for `HomeView`, including latest-save deduping and saved-target references for later reopen flows.

## Public Interface
```ts
getRecentGames(): Promise<IRecentGameEntry[]>
```

The store (`useRecentGameStore`, store id `recentGameStore`) holds no state.

## Responsibilities
- get recent-game entries on demand when `HomeView` mounts, and again after a failed reopen
- project recent-game metadata from available save targets instead of persisting a dedicated recent snapshot
- keep at most one recent entry per canonical `gameId`
- expose the recent list in newest-first order by `lastSavedAtUtc`
- pick the newest available autosave or saved-file target for each canonical `gameId` through `SavedGameIndexService.getLatestSaveEntry(...)`
- drop missing or invalid targets naturally on the next query instead of requiring eager cleanup writes
- avoid treating the full recent-games list as long-lived authoritative reactive store state
- keep managed-save enumeration and recent-entry projection as store-private helpers instead of a shared utility wrapper

## Dependencies
- `SavedGameIndexService`
- `SerializationService`
- `UserSettingService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-03`
- `SCN-NAV-03`

## Notes
- `getRecentGames()` reads `gameSession.saveRootPath` from `UserSettingService.getSettingsOrDefault()`, enumerates managed saves through `SerializationService.listManagedSaveEntries`, groups them with `SavedGameIndexService.projectSaveGroups`, and reads each group's latest document for its display name.
- Each entry uses the group's `gameId`, `RecentGameSourceKind.Autosave` or `SaveFile`, a `filePath` only for non-autosave targets, and `lastSavedAtUtc` from the entry's save time or, when absent, the document's `metadata.updatedAt`.
- A document that cannot be read is logged and skipped, so one corrupt save cannot hide the rest of the list. `HomeView` treats a rejected query as an empty list.
- `RecentGameStore` consumes only layer-2 save-index, serialisation and settings services. It does not resolve `StorageAdapter` directly and does not call sibling stores.
- `getRecentGames()` is the authoritative read path for `HomeView`; the view's local list is disposable and non-authoritative.
- Loading a recent entry's saved document belongs to `SavedGamesStore.loadRecentGame(...)`, and runtime insertion belongs to `GamesStore.insertGame(...)`. `HomeView` reuses an already-open game with the same id instead of inserting a second copy. `RecentGameStore` owns only the projected recent-entry metadata.
