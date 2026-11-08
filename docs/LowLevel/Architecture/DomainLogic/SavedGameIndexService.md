# SavedGameIndexService

## Purpose
Own the pure ChessVue rules for where managed saved games live and how generic directory contents are interpreted as logical save groups and latest-save targets.

## Public Interface
```ts
// src/contracts/domain/ISavedGameFileEntry.ts
interface ISavedGameFileEntry {
  gameId: string;
  saveName: string;
  filePath: string;
  savedAtUtc?: SaveTimestamp;
  isAutosave: boolean;
}

// src/contracts/domain/ISavedGameGroup.ts
interface ISavedGameGroup {
  gameId: string;
  gameFolderPath: string;
  saves: ISavedGameFileEntry[];
}

// src/domain/SavedGameIndexService.ts
normaliseSaveRootPath(configuredRootPath: string): string
getGameFolderPath(rootPath: string, gameId: string): string
getAutosaveFilePath(rootPath: string, gameId: string): string
getNamedSaveFilePath(rootPath: string, gameId: string, saveName: string): string
projectSaveGroups(rootPath: string, entriesByDirectory: ReadonlyMap<string, IFileSystemEntry[]>): ISavedGameGroup[]
getLatestSaveEntry(entries: ISavedGameFileEntry[]): ISavedGameFileEntry | undefined
getLatestSaveEntryForGame(groups: readonly ISavedGameGroup[], gameId: string): ISavedGameFileEntry | undefined
```

## Responsibilities
- keep ChessVue's save-root, game-folder and file-naming conventions in one platform-independent place
- compose autosave and named-save file paths from `gameSession.saveRootPath`, `gameId` and `saveName`
- interpret generic directory entries from `IStorageAdapter` into logical game and save groups for the saved-games route and home recents
- identify autosave entries and the latest loadable save without depending on UI code or file-system APIs
- identify the latest save for a remembered or UI-selected `gameId` from grouped save data without requiring callers to reimplement group lookup

## Dependencies
- shared low-level data interfaces only

## Layout And Validation
- Managed saves live at `<saveRootPath>/<gameId>/<saveName>.json`. The autosave is `<saveRootPath>/<gameId>/auto.json`; `auto` is therefore reserved and `getNamedSaveFilePath` rejects it case-insensitively.
- Paths are normalised to forward slashes, with repeated separators collapsed and a trailing separator removed.
- `getGameFolderPath` and `getNamedSaveFilePath` throw unless the game id and save name are single file-name segments: non-blank, without `\ / : * ? " < > |` or control characters, not ending in a dot or space, and not a reserved Windows device name such as `CON`, `NUL`, `COM1` or `LPT1`. **Why:** `SavedGamesView` validates typed save names for the user, but this service composes the actual path; repeating the rule at that boundary stops a path-like value from addressing a file outside its game folder or a name the desktop file system cannot create.
- `projectSaveGroups` reads the root listing, keeps only safe-named directories whose path is exactly `<root>/<name>`, and within each keeps only safe-named `.json` files directly inside that folder. Groups without saves are omitted. Groups are ordered by `gameId`; saves use the latest-save ordering. Unexpected entries are ignored rather than repaired.

## Callers
- `SavedGamesStore` for listing, restore-target lookup and save-path composition.
- `RecentGameStore` for home recents.
- `SavedGamesView` reads `getLatestSaveEntry` when choosing a group's fallback selection. This is a narrow read under the [dependency rules](../index.md#dependency-rules).

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`

## Notes
- `SavedGameIndexService` performs no file I/O and opens no dialogs. Folder enumeration belongs to `SerializationService.listManagedSaveEntries(...)` through `IStorageAdapter`; save grouping and path conventions belong here.
- `savedAtUtc` is the file's `lastModifiedUtc` from the storage adapter. In the browser, the managed file index makes each write's modification time strictly later than every existing file, so the newest save is unambiguous.
- `getLatestSaveEntry(...)` returns `undefined` for no entries. Otherwise it picks the newest entry by `savedAtUtc`; entries without a timestamp sort last; equal or missing timestamps fall back to the autosave before named saves, then ascending `saveName`. **Why:** the service owns chronological selection, so passing strings would leak parsing assumptions into this query and risk lexical comparison of non-canonical input; the typed instant keeps comparison and save-specific display semantics at the contract boundary.
- Latest-save selection sorts a copied array because input ordering remains caller-owned and must not be mutated by this pure query.
- `getLatestSaveEntryForGame(...)` locates the requested group and reuses the same ordering.
