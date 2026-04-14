# SavedGamesStore

## Purpose
Own saved-game browsing, saved-target lookup, and external import or export picker workflows without taking ownership of live-game mutation rules or live workspace save and load execution.

## Public Interface
```ts
listSavedGames(): Promise<ISavedGameGroup[]>
getLoadFilePath(gameId: string, saveName?: string): Promise<string>
getRecentGamePath(gameId: string): Promise<string>
exportGame(gameId: string): Promise<string>
importGame(): Promise<string | undefined>
```

## Responsibilities
- list grouped save entries for the route-level save/load views
- resolve a selected managed save into the full file path later consumed by `GamesStore.loadGame`
- resolve a recent-game entry into the full file path later consumed by `GamesStore.loadGame`
- handle route-driven load behaviour, including selected-game navigation and double-click latest-save path resolution
- open external import and export dialogs and return the selected file paths to the caller-owned save or load flow
- enumerate managed-save directory contents through `SavedGameDocumentService` before projecting them through `SavedGameIndexService`
- use `SavedGameIndexService` for save-root, folder, and file-path logic
- keep saved-game menu data, latest-save choice, and file-path lookup inside one owning store even when later caller-owned sequencing also updates open tabs, active route, or runtime restart state

## Dependencies
- `SavedGameIndexService`
- `SavedGameDocumentService`

## Scenario Coverage
- `SCN-NAV-03`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`

## Notes
- `SavedGamesStore` consumes only layer-2 persistence services. It does not resolve `StorageAdapter` directly.
- `SavedGamesStore` does not call sibling stores directly. Any later save execution, load execution, home-screen recent query, tab or session update, or runtime restart is sequenced by the owning flow after the saved-game lookup or picker operation completes.
- Save-folder grouping belongs to `SavedGameIndexService`, not to `SavedGamesStore` and not to `StorageAdapter`.
- Saved-game directory enumeration plus import/export picker access belong to `SavedGameDocumentService`, not to `SavedGamesStore` and not to `StorageAdapter`.
- `SavedGamesStore` does not serialise or hydrate workspaces. `GamesStore` owns the actual save and load execution once `SavedGamesStore` has resolved the file path or picker result.
