# SavedGamesStore

## Purpose
Own saved-game workflows for autosave, internal save/load browsing, external import/export, and restore orchestration without taking ownership of live-game mutation rules.

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
- persist the current/open game workspace to its current saved target when a committed scenario requires persistence outside the explicit manual save flow
- orchestrate autosave writes for the current game using settings-driven triggers
- list grouped save entries for the internal save/load dialog
- save the current game into an internal save slot with overwrite handling
- load an internal or recent saved game into the open-game collection
- import and export external saved-game files through host dialogs
- use `SavedGameIndexService` for save-root, folder, and file-path logic
- use `SerializationService` for canonical saved-game serialisation, deserialisation, and migration
- update `RecentGameStore` only after successful autosave, save, load, import, or export outcomes that should affect recent metadata

## Dependencies
- `SavedGameIndexService`
- `SerializationService`
- `PlatformServices`
- `GamesStore`
- `RecentGameStore`
- `SettingsStore`
- `UiStateStore`
- `EnginesStore`

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
- `SavedGamesStore` may read from `GamesStore` to obtain the current/open workspace or insert a restored workspace, but `GamesStore` does not own save/load/import/export orchestration.
- Save-folder grouping belongs to `SavedGameIndexService`, not to `SavedGamesStore` and not to `FileIoAdapter`.
