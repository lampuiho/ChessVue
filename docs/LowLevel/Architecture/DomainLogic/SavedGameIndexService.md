# SavedGameIndexService

## Purpose
Own the pure ChessVue rules for where saved games live on disk and how generic directory contents are interpreted as logical save groups.

## Public Interface
```ts
interface ISavedGameFileEntry {
  gameId: string
  saveName: string
  filePath: string
  savedAtUtc: string | null
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
```

## Responsibilities
- keep ChessVue's canonical save-root, game-folder, and file-naming conventions in one platform-independent place
- decide how autosave and named-save file paths are composed from `session.saveRootPath`, `gameId`, and `saveName`
- interpret generic directory entries from `FileIoAdapter` into logical game/save groups for the save/load dialog
- identify autosave entries without depending on UI code or file-system APIs

## Dependencies
- shared low-level data interfaces only

## Scenario Coverage
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`

## Notes
- `SavedGameIndexService` performs no file I/O and opens no dialogs.
- Folder enumeration and raw reads/writes belong to `FileIoAdapter`; save grouping and path conventions belong here.
