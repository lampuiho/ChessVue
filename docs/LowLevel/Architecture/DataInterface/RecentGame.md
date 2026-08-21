# Recent Game Types

## Purpose
Define the recent-game metadata projected for `HomeView` by `RecentGameStore`.

## Types
- `enum RecentGameSourceKind`

## Interfaces
- `interface IRecentGameEntry`

## Data Structures
```ts
enum RecentGameSourceKind {
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
```

## Rules
- Recent-game entries are projected on demand and are not stored inside `IGameSessionSnapshot`, `IUiLayoutState`, or `ISettingsSnapshot`.
- There is at most one recent entry per canonical `gameId`.
- Entries are projected in descending `lastSavedAtUtc` order so the newest saved target appears first on `HomeView`.
- When both an autosave target and a saved-file target exist for the same `gameId`, the entry with the newest `lastSavedAtUtc` wins.
- `saveFile` entries must include `filePath`; `autosave` entries must omit it.
- Recent-game entries expose reopenable metadata only and never embed the full saved game payload.
