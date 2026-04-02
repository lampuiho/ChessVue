# RecentGameStore

## Purpose
Own on-demand recent-game projection for `HomeView`, including latest-save deduping and saved-target references for later reopen flows.

## Public Interface
```ts
loadRecentGames(): Promise<IRecentGameEntry[]>
```

## Responsibilities
- load recent-game entries on demand when `HomeView` becomes active
- project recent-game metadata from available save targets instead of persisting a dedicated recent snapshot
- keep at most one recent entry per canonical `gameId`
- expose the recent list in newest-first order by `lastSavedAtUtc`
- pick the newest available autosave or saved-file target for each canonical `gameId`
- drop missing or invalid targets naturally on the next query instead of requiring eager cleanup writes
- avoid treating the full recent-games list as long-lived authoritative reactive store state

## Dependencies
- `SavedGameIndexService`
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-03`
- `SCN-NAV-03`

## Notes
- `RecentGameStore` consumes only layer-2 save-index and serialisation services. It does not resolve `StorageAdapter` directly.
- `loadRecentGames()` is the authoritative read path for `HomeView`; any short-lived cache must be treated as disposable and non-authoritative.
- Loading a recent entry's saved target belongs to `GamesStore` after `SavedGamesStore` resolves the full path; `RecentGameStore` owns only the projected recent-entry metadata.
