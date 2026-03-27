# SavedGamesStore

## Purpose
Own saved-game workflows for autosave, route-level internal save/load browsing, external import/export, and restore orchestration without taking ownership of live-game mutation rules.

## Public Interface
```ts
listSavedGames(): Promise<ISavedGameGroup[]>
persistGame(gameId: string): Promise<void>
autosaveGame(gameId: string, trigger: "moveThreshold" | "close"): Promise<void>
saveGameAs(gameId: string, saveName: string, overwrite?: boolean): Promise<string>
loadSavedGame(filePath: string): Promise<IGameWorkspace>
openRecentGame(gameId: string): Promise<IGameWorkspace>
exportGame(gameId: string): Promise<string>
importGame(): Promise<IGameWorkspace>
```

## Responsibilities
- persist the current or open game workspace to its current saved target when a committed scenario requires persistence outside the explicit manual save flow
- orchestrate autosave writes for the current game using settings-driven triggers
- list grouped save entries for the route-level save/load views
- save the current game into an internal save slot with overwrite handling
- load an internal or recent saved game into the open-game collection
- handle route-driven load behaviour, including selected-game navigation and double-click latest-save loading
- import and export external saved-game files through host dialogs
- use `SavedGameIndexService` for save-root, folder, and file-path logic
- use `SerializationService` for canonical saved-game serialisation, deserialisation, and migration
- keep save-file orchestration inside one owning store even when later caller-owned sequencing also updates recent metadata, open tabs, active route, or runtime restart state

## Dependencies
- `SavedGameIndexService`
- `SerializationService`

## Scenario Coverage
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`

## Notes
- `SavedGamesStore` consumes only layer-2 persistence services. It does not resolve `StorageAdapter` or `FileIoAdapter` directly.
- `SavedGamesStore` does not call sibling stores directly. Any later recent-metadata refresh, tab/session update, or runtime restart is sequenced by the owning flow after the saved-game operation completes.
- Save-folder grouping belongs to `SavedGameIndexService`, not to `SavedGamesStore` and not to `FileIoAdapter`.
