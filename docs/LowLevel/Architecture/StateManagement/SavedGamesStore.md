# SavedGamesStore

## Purpose
Own saved-game browsing, saved-target lookup, and external import or export picker workflows without taking ownership of live-game mutation rules or live workspace save and load execution.

## Public Interface
```ts
listSavedGames(): Promise<ISavedGameGroup[]>
getRestoreFilePaths(gameIds: string[]): Promise<string[]>
getLoadFilePath(gameId: string, saveName?: string): Promise<string>
getRecentGamePath(gameId: string): Promise<string>
deleteSave(gameId: string, saveName?: string): Promise<void>
exportGame(gameId: string): Promise<string>
importGame(): Promise<string | undefined>
```

## Responsibilities
- list grouped save entries for the route-level save/load views
- resolve the latest available managed save target for each remembered `gameId` during session restore
- resolve a selected managed save into the full file path later consumed by `GamesStore.loadGame`
- resolve a recent-game entry into the full file path later consumed by `GamesStore.loadGame`
- delete the selected managed save target from the route-level save/load UI once the user confirms the action
- handle route-driven load behaviour, including selected-game navigation and double-click latest-save path resolution
- open external import and export dialogs and return the selected file paths to the caller-owned save or load flow
- enumerate managed-save directory contents through `SerializationService` before projecting them through `SavedGameIndexService`
- use `SavedGameIndexService` for save-root, folder, latest-save, and file-path logic
- keep saved-game menu data, latest-save choice, and file-path lookup inside one owning store even when later caller-owned sequencing also updates open tabs, active route, or runtime restart state
- keep grouped save enumeration as a store-private helper instead of routing that logic through a shared utility wrapper

## Dependencies
- `SavedGameIndexService`
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-NAV-03`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`

## Notes
- `SavedGamesStore` consumes only layer-2 persistence services. It does not resolve `StorageAdapter` directly.
- `SavedGamesStore` does not call sibling stores directly. Any later save execution, load execution, home-screen recent query, tab or session update, or runtime restart is sequenced by the owning flow after the saved-game lookup or picker operation completes.
- Save-folder grouping belongs to `SavedGameIndexService`, not to `SavedGamesStore` and not to `StorageAdapter`.
- Saved-game directory enumeration plus import/export picker access belong to `SerializationService`, not to `SavedGamesStore` and not to `StorageAdapter`.
- `deleteSave(...)` removes only the selected managed save target. It does not mutate the currently open in-memory workspace collection directly.
- `SavedGamesStore` does not serialise or hydrate workspaces. `GamesStore` owns the actual save and load execution once `SavedGamesStore` has resolved the file path or picker result.
