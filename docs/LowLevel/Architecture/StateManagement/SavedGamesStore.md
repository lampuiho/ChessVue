# SavedGamesStore

## Purpose
Own saved-game browsing, saved-game serialisation, saved-document loading, restore lookup, external import or export flows, and close-trigger autosave registration without taking ownership of active-game mutation rules or hydrated active-workspace insertion.

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
exportGame(game: IGame): Promise<string | undefined>
importGame(): Promise<IGame | undefined>
```

## Responsibilities
- list grouped save entries for the route-level save/load views
- serialise and write the current game to autosave, managed-save, or external-file targets once the owning flow has selected that target
- read and deserialise canonical saved-game documents from managed saves, recent entries, session restore, or external import; future version conversion remains inside `SerializationService` because allowing each load path to interpret versions would create multiple compatibility policies
- resolve the latest available managed save target for each remembered `gameId` during session restore, then return a success or failure outcome for every target so presentation can insert all valid payloads and report invalid ones
- resolve a selected managed save or recent-game entry into a loaded saved-game payload later inserted into `GamesStore`
- let presentation decide when a successfully loaded payload should become an open active workspace by passing it into `GamesStore.insertGame(...)`
- delete the selected managed save target from the route-level save/load UI once the user confirms the action
- handle route-driven load behaviour, including selected-game navigation and double-click latest-save path resolution
- open external import and export dialogs and complete the associated read or write flow
- return no payload/path when the picker reports typed cancellation, and propagate genuine picker failures to presentation
- replace an external import's metadata ID with a fresh app-generated game ID before returning the payload to presentation, so imported metadata is never reused as a managed folder name
- register and tear down close-trigger autosave callbacks through the layer-2 platform-event boundary when presentation decides the current UI context should autosave on app close
- expose one canonical `saveGame(...)` boundary for explicit saves, close-trigger saves and the serial move-count autosave queue owned by `GamesStore`
- enumerate managed-save directory contents through `SerializationService` before projecting them through `SavedGameIndexService`
- use `SavedGameIndexService` for save-root, folder, latest-save, and file-path logic
- keep saved-game menu data, latest-save choice, and file-path lookup inside one owning store even when later caller-owned sequencing also updates open tabs, active route, or runtime restart state
- keep grouped save enumeration as a store-private helper instead of routing that logic through a shared utility wrapper

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
- Selected/latest/recent managed loads assign identity from the enumerated save group before returning the game. Recent-game projection uses that same group identity. Imports receive a fresh UUID before presentation; workspace insertion still repairs collisions. Internal session restore keeps its separate identity policy.
- Autosaves overwrite the previous `auto.json` by default. Explicit overwrite options remain honoured.
- `SavedGamesStore` consumes only layer-2 persistence, settings, and platform-event services. It does not resolve `StorageAdapter` directly.
- `SavedGamesStore` does not call sibling stores directly. Presentation sequences any later `GamesStore.insertGame(...)`, tab or session update, or runtime restart after the saved-game operation completes.
- Save-folder grouping belongs to `SavedGameIndexService`, not to `SavedGamesStore` and not to `StorageAdapter`.
- `SavedGamesView` validates user-entered names before submission. `SavedGameIndexService` also rejects unsafe path segments when composing managed targets and excludes enumerated entries outside their expected managed parent.
- Saved-game directory enumeration, saved-document reads and writes, and import/export picker access belong to `SerializationService`, not to `GamesStore` and not to `StorageAdapter`.
- `saveGame(...)`, `loadGame(...)`, and `loadRecentGame(...)` return or consume canonical persisted `IGame` payloads without runtime-only hydration. Each `restoreGames(...)` outcome contains either one such payload or the isolated target error. `GamesStore.insertGame(...)` remains the boundary that turns successful payloads into active runtime workspaces.
- `deleteSave(...)` removes only the selected managed save target. It does not mutate the currently open in-memory workspace collection directly.
- `registerAutosaveOnClose(...)` is a persistence convenience boundary for presentation. The caller still decides when the app should begin or stop close-trigger autosave and which active games are supplied to that callback.
