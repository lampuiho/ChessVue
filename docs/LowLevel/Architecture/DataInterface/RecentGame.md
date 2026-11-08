# Recent Game Types

## Purpose
Define the recent-game metadata projected for `HomeView` by `RecentGameStore`. Source: `contracts/RecentGame.ts`.

## Types
- `enum RecentGameSourceKind`

## Interfaces
- `interface IRecentGameEntry`
- `interface IRecentGamesSnapshot`

## Data Structures
```ts
const enum RecentGameSourceKind {
  Autosave = "autosave",
  SaveFile = "saveFile"
}

interface IRecentGameEntry {
  gameId: string
  displayName: string
  sourceKind: RecentGameSourceKind
  filePath?: string
  lastSavedAtUtc: SaveTimestamp
}

interface IRecentGamesSnapshot {
  schemaVersion: number
  entries: IRecentGameEntry[]
}
```

## Schemas
- `recentGameSourceKinds` feeds `recentGameSourceKindSchema`.
- `recentGameEntrySchema` requires non-empty `gameId` and `displayName`, a `SaveTimestamp` `lastSavedAtUtc`, and refines the source/path pairing below.
- `recentGamesSnapshotSchema` requires `schemaVersion: 1` and an entry array.

## Rules
- Recent-game entries are projected on demand and are not stored inside `IGameSessionSnapshot`, `IUiLayoutState`, or `ISettingsSnapshot`.
- `IRecentGamesSnapshot` and `recentGamesSnapshotSchema` are reserved: no workflow persists or reads a recent-games snapshot.
- Entries come from the managed save root only. For each saved game folder, `RecentGameStore.getRecentGames()` reads the latest save entry; `displayName` is the saved game's `metadata.name`, and `lastSavedAtUtc` is the save file's timestamp, falling back to the game's `metadata.updatedAt`. A save that cannot be read is skipped.
- There is at most one recent entry per canonical `gameId`.
- Entries are projected in descending `lastSavedAtUtc` order so the newest saved target appears first on `HomeView`.
- When both an autosave target and a saved-file target exist for the same `gameId`, the entry with the newest `lastSavedAtUtc` wins.
- `saveFile` entries must include `filePath`; `autosave` entries must omit it.
- Recent-game entries expose reopenable metadata only and never embed the full saved game payload.
