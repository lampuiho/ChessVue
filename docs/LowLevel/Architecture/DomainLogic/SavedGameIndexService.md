# SavedGameIndexService

## Purpose
Own the pure ChessVue rules for where saved games live on disk and how generic directory contents are interpreted as logical save groups and latest-save targets.

## Public Interface
```ts
interface ISavedGameFileEntry {
  gameId: string
  saveName: string
  filePath: string
  savedAtUtc?: string
  isAutosave: boolean
}

interface ISavedGameGroup {
  gameId: string
  gameFolderPath: string
  saves: ISavedGameFileEntry[]
}

normaliseSaveRootPath(configuredRootPath: string): string
getGameFolderPath(rootPath: string, gameId: string): string
getAutosaveFilePath(rootPath: string, gameId: string): string
getNamedSaveFilePath(rootPath: string, gameId: string, saveName: string): string
projectSaveGroups(rootPath: string, entriesByDirectory: ReadonlyMap<string, IFileSystemEntry[]>): ISavedGameGroup[]
getLatestSaveEntry(entries: ISavedGameFileEntry[]): ISavedGameFileEntry | undefined
getLatestSaveEntryForGame(groups: readonly ISavedGameGroup[], gameId: string): ISavedGameFileEntry | undefined
```

## Responsibilities
- keep ChessVue's canonical save-root, game-folder, and file-naming conventions in one platform-independent place
- decide how autosave and named-save file paths are composed from `gameSession.saveRootPath`, `gameId`, and `saveName`
- interpret generic directory entries from `StorageAdapter` into logical game/save groups and latest-save targets for the route-level save/load views
- identify autosave entries without depending on UI code or file-system APIs
- identify the latest loadable save entry for a selected game without depending on UI code or file-system APIs
- identify the latest loadable save entry for a remembered or UI-selected `gameId` from grouped save data without requiring callers to reimplement group lookup

## Dependencies
- shared low-level data interfaces only

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`

## Notes
- `SavedGameIndexService` performs no file I/O and opens no dialogs.
- Folder enumeration and raw reads or writes belong to `StorageAdapter`; save grouping and path conventions belong here.
- `getLatestSaveEntry(...)` is a pure query. It returns `undefined` when no entries are available, otherwise it picks the newest entry by `savedAtUtc`, and when timestamps are missing or equal it falls back to a deterministic ordering of autosave before named-save and then ascending `saveName`.
- `getLatestSaveEntryForGame(...)` is a pure convenience query for grouped save data. It reuses the same latest-save ordering after locating the requested game's save group.
