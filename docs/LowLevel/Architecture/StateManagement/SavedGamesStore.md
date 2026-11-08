# SavedGamesStore

## Purpose
Own saved-game browsing, saved-game serialisation, saved-document loading, restore lookup, managed-save deletion, external import or export flows, and close-trigger autosave registration without taking ownership of active-game mutation rules or hydrated active-workspace insertion.

## Public Interface
```ts
type GameRestoreOutcome =
  | { gameId: string; status: 'restored'; game: IGame }
  | { gameId: string; status: 'failed'; error: unknown }

listSavedGames(): Promise<ISavedGameGroup[]>
restoreGames(gameIds: string[]): Promise<GameRestoreOutcome[]>
loadGame(gameId: string, saveName?: string): Promise<IGame>
loadRecentGame(gameId: string): Promise<IGame>
saveGame(game: IGame, options: ISaveGameOptions): Promise<string>
registerAutosaveOnClose(getGames: () => readonly IGame[]): Promise<void>
disposeAutosaveOnClose(): void
deleteSave(gameId: string, saveName?: string): Promise<void>
deleteGame(gameId: string): Promise<void>
exportGame(game: IGame): Promise<string | undefined>
importGame(): Promise<IGame | undefined>
```

The members appear in the order the store (`useSavedGamesStore`, store id `savedGamesStore`) returns them. The store holds no reactive state; its only instance field is the close-trigger unsubscribe handle.

## Responsibilities
- list grouped save entries for the route-level save/load views
- serialise and write a game to an autosave, managed-save or external-file target once the owning flow has selected that target
- read and deserialise canonical saved-game documents from managed saves, recent entries, session restore or external import; future version conversion remains inside `SerializationService` because allowing each load path to interpret versions would create multiple compatibility policies
- resolve the latest available managed save for each remembered `gameId` during session restore, returning a success or failure outcome for every target so presentation can insert all valid payloads and report invalid ones
- resolve a selected managed save, or the latest save of a group when no save name is supplied, into a loaded payload later inserted into `GamesStore`
- let presentation decide when a successfully loaded payload becomes an open active workspace by passing it into `GamesStore.insertGame(...)`
- delete one managed save target, or every save in a game's group, once the user confirms the action
- open external import and export dialogs and complete the associated read or write flow
- return no payload or path when the picker reports typed cancellation, and propagate genuine picker failures to presentation
- replace an external import's metadata ID with a fresh app-generated game ID before returning the payload, so imported metadata is never reused as a managed folder name
- register and tear down close-trigger autosave callbacks through the layer-2 platform-event boundary
- expose one canonical `saveGame(...)` boundary for explicit saves, close-trigger saves and the serial move-count autosave queue owned by `GamesStore`
- enumerate managed-save directory contents through `SerializationService` before projecting them through `SavedGameIndexService`, keeping grouped enumeration as a store-private helper rather than a shared utility wrapper

## Dependencies
- `SavedGameIndexService`
- `PlatformEventService`
- `SerializationService`
- `UserSettingService`

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`

## Notes
- Every operation reads the save root from `UserSettingService.getSettingsOrDefault()` (`gameSession.saveRootPath`) at call time, so an accepted settings change applies to the next operation without store state.
- Selected, latest and recent managed loads assign the enumerated save group's `gameId` to the returned game before returning it, and recent-game projection uses the same group identity. Imports receive a fresh UUID before presentation; workspace insertion still repairs collisions with open games. `restoreGames(...)` returns the document's own identity.
- `saveGame(...)` resolves the target path by `options.targetKind`: `Autosave` through `SavedGameIndexService.getAutosaveFilePath`, `ManagedSave` through `getNamedSaveFilePath` with `options.saveName`, and `ExternalFile` from `options.filePath`. It writes with `options.overwrite ?? true`, so autosaves replace the previous automatic save by default while explicit overwrite options are honoured, and returns the written path.
- `restoreGames(...)` enumerates the save groups once and then reads every requested game independently; one corrupt or missing target produces a `failed` outcome without affecting the others. An empty request returns immediately.
- `deleteSave(...)` removes only the selected managed save, or the latest save when `saveName` is omitted. `deleteGame(...)` removes each save in the group sequentially and throws when the group is not found. Neither mutates the open in-memory workspace collection.
- `exportGame(...)` proposes `${game.metadata.id}.json` through `SerializationService.selectExportFile`, then writes through `saveGame` as an `ExternalFile` target. `importGame()` opens `SerializationService.selectImportFile` at the save root. Both return `undefined` for a typed `PlatformErrorKind.Cancelled` picker result.
- `registerAutosaveOnClose(...)` disposes any previous registration and subscribes through `PlatformEventService.subscribeToAppCloseRequested('SavedGamesStore', ..., 'autosave-on-close')`. The callback re-reads accepted settings when the close is requested and, only when `gameSession.autosaveOnClose` is enabled, autosaves each supplied game in turn. `App` registers it once after startup restore with `() => gamesStore.listGames()`; no current caller invokes `disposeAutosaveOnClose()`. Browser lifecycle checkpoints remain best effort because tab shutdown cannot await asynchronous callbacks.
- `SavedGamesStore` consumes only layer-2 persistence, settings and platform-event services. It does not resolve `StorageAdapter` directly.
- `SavedGamesStore` does not call sibling stores. Presentation sequences any later `GamesStore.insertGame(...)`, tab or session update after the saved-game operation completes. The reverse direction has one exception: `GamesStore`'s move-count autosave calls `saveGame(...)` directly (see [GamesStore dependencies](GamesStore.md#dependencies)).
- Save-folder grouping, latest-save selection and target-path composition belong to `SavedGameIndexService`, not to `SavedGamesStore` and not to `StorageAdapter`.
- `SavedGamesView` validates user-entered names before submission. `SavedGameIndexService` also rejects unsafe path segments when composing managed targets and excludes enumerated entries outside their expected managed parent.
- Saved-game directory enumeration, document reads and writes, and import/export picker access belong to `SerializationService`, not to `GamesStore` and not to `StorageAdapter`.
- `saveGame(...)`, `loadGame(...)` and `loadRecentGame(...)` return or consume canonical persisted `IGame` payloads without runtime-only hydration; runtime fields such as premove queues and pause owners are excluded by the serialisation schema. `GamesStore.insertGame(...)` remains the boundary that turns successful payloads into active runtime workspaces.
- Route-driven selection, double-click loading and cancellation of in-flight details delivery belong to `SavedGamesView`; the store only resolves the requested or latest entry.
