# Recent Game Types

## Purpose
Define the persisted recent-game metadata used by `HomeView` and `RecentGameStore`.

## Types
- `type RecentGameSourceKind = "autosave" | "saveFile"`

## Interfaces
- `interface IRecentGameEntry`
- `interface IRecentGamesSnapshot`

## Data Structures
```ts
type RecentGameSourceKind = "autosave" | "saveFile"

interface IRecentGameEntry {
  gameId: string
  displayName: string
  sourceKind: RecentGameSourceKind
  filePath: string | null
  lastSavedAtUtc: string
}

interface IRecentGamesSnapshot {
  schemaVersion: number
  entries: IRecentGameEntry[]
}
```

## Rules
- The recent-games snapshot is a dedicated persisted artefact and is not stored inside `IGameSessionSnapshot`, `IUiLayoutState`, or `ISettingsSnapshot`.
- There is at most one recent entry per canonical `gameId`.
- Entries are stored or projected in descending `lastSavedAtUtc` order so the newest saved target appears first on `HomeView`.
- When both an autosave target and a saved-file target exist for the same `gameId`, the entry with the newest `lastSavedAtUtc` wins.
- `saveFile` entries must include a non-null `filePath`; `autosave` entries must store `filePath` as `null`.
- The recent-games snapshot stores reopenable metadata only and never embeds the full saved game payload.
