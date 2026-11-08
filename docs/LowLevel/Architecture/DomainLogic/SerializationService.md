# SerializationService

## Purpose
Own canonical persisted payload validation, the future schema-version dispatch boundary, and the layer-2 storage-backed persistence boundary for all persisted artefacts.

## Public Interface
```ts
// src/domain/SerializationService.ts
readSettingsDocument(path: string): Promise<ISettingsSnapshot>
writeSettingsDocument(path: string, snapshot: ISettingsSnapshot): Promise<void>
readGameSessionDocument(path: string): Promise<IGameSessionSnapshot>
writeGameSessionDocument(path: string, snapshot: IGameSessionSnapshot): Promise<void>
readUiLayoutDocument(path: string): Promise<IUiLayoutState>
writeUiLayoutDocument(path: string, state: IUiLayoutState): Promise<void>
readGameDocument(filePath: string): Promise<IGame>
writeGameDocument(filePath: string, game: IGame, overwrite?: boolean): Promise<void>
deleteDocument(filePath: string): Promise<void>
listManagedSaveEntries(rootPath: string): Promise<ReadonlyMap<string, IFileSystemEntry[]>>
selectImportFile(startDirectory?: string): Promise<string>
selectExportFile(suggestedPath?: string): Promise<string>
serialiseSettings(snapshot: ISettingsSnapshot): string
deserialiseSettings(raw: string): ISettingsSnapshot
serialiseGameSession(snapshot: IGameSessionSnapshot): string
deserialiseGameSession(raw: string): IGameSessionSnapshot
serialiseUiLayoutState(state: IUiLayoutState): string
deserialiseUiLayoutState(raw: string): IUiLayoutState
serialiseGame(game: IGame): string
deserialiseGame(raw: string): IGame
```

## Responsibilities
- keep one canonical JSON wire shape per persisted artefact
- own file-backed game-session, UI-layout and saved-game reads or writes behind explicit caller-supplied paths. Settings document methods exist with the same contract, but accepted settings are currently read and written by `UserSettingService` directly (see Notes)
- own managed-save directory enumeration and external import or export picker access behind the same layer-2 persistence boundary
- own saved-game document conversion for internal save/load flows and external import/export flows
- require the canonical schema version before deserialisation; version `1` is the first and only schema, so there are no historical payload shapes to migrate and unsupported versions are rejected rather than guessed
- keep schema-version dispatch inside each `deserialise*` path; no migration API or conversion exists while version `1` is the only schema. **Why:** speculative migration methods imply unsupported historical formats and expose an API with no real conversion responsibility. When a second schema exists, dispatch and conversion belong here so live consumers still receive only the canonical shape
- reject corrupt core payloads
- reject incomplete, unsupported, or incompatible saved-game payloads rather than inventing detached UI restore sections or partial-recovery import paths
- project values through the canonical Zod persistence schemas so runtime-only `$` metadata and unknown fields are omitted before any write path reaches `StorageAdapter`. **Why:** direct serialisation would leak callbacks, maps, class instances, and unknown runtime fields into the wire format and turn them into accidental compatibility obligations
- treat the schema-created copy as validation and ownership transfer at the persistence trust boundary, not as a precedent for defensive cloning in ordinary live-state workflows. **Why:** the writer needs a canonical persistence-owned model, while live workflows rely on deliberate identity and would be broken by indiscriminate clones; the same schema accepts hydrated timestamps on write and wire strings on read
- validate `rootPosition` structurally through the board-position schema. Saved games store no FEN or position key, so there is no separate root-identity cross-check
- validate nested move-tree structure, `mainlineChildIndex`, and that persisted `renderedPath` and any `livePath` address existing nodes
- validate that a game session's `activeGameId`, when present, is one of its `openGameIds`, both before writing and after reading
- validate persisted `IGame.analysis`, including ordered seat shape and embedded copied-engine payload shape
- stop at canonical payload validation, future version conversion, and schema projection; rebuilding runtime-only move-tree references, `$.parent`, and store-usable current-node selection belongs to `GamesStore` after successful deserialisation. **Why:** those values depend on active-workspace ownership; hydrating during a pure document read would introduce state-layer assumptions, while omitting insertion-time hydration leaves loaded node traversal silently broken
- remain path-agnostic in the sense that callers supply the concrete file path; `SerializationService` never decides which specific file is being read or written

## Callers
- `UiStateStore`: game-session and UI-layout documents at `BuildConfig.persistence` paths.
- `SavedGamesStore`: saved-game reads and writes, deletion, managed-save enumeration, and import or export picker selection.
- `RecentGameStore`: managed-save enumeration and saved-game reads for home recents.

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-02`
- `SCN-SESSION-03`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`

## Notes
- `SerializationService` depends on `IStorageAdapter`, resolved through `usePlatformService()`, for raw file and dialog access; stores depend only on this layer-2 boundary.
- Settings, session and layout writes overwrite their file. `writeGameDocument(...)` creates the game folder when needed and does not overwrite unless `overwrite` is `true`; `SavedGamesStore` decides when overwrite is allowed. Failures from the adapter propagate unchanged.
- `listManagedSaveEntries(rootPath)` lists the root and each direct subdirectory, keyed by directory path. A missing root (`notFound`) yields an empty map; other failures propagate.
- `selectImportFile` and `selectExportFile` return the adapter's selected path or browser token unchanged. In the browser the following `readGameDocument` or `writeGameDocument` consumes that token; see [StorageAdapter](../PlatformAbstraction/StorageAdapter.md#import-and-export).
- Failures in JSON parsing, schema version, schema shape or structural validation throw `SerializationError` with a cause detail.
- `UserSettingService` currently reads and writes the accepted settings file through `IStorageAdapter` itself, parsing with the same `settingsSnapshotSchema` (whose `schemaVersion` is the literal `1`). `readSettingsDocument`, `writeSettingsDocument`, `serialiseSettings` and `deserialiseSettings` therefore have no production caller.
- `SerializationService` accepts explicit file paths from callers. Build config supplies app-owned settings, session, and layout file paths, while `SavedGameIndexService` supplies managed save or load file paths beneath user-configurable `gameSession.saveRootPath`.
- Recent-game history remains query-derived from available save targets and is not a serialised persisted artefact owned by this service.
- All runtime-only `$` members are omitted from persisted output, including `IGame.$`, `IPlayer.$`, `IAssignedEngine.$`, `IMove.$`, `IMoveNode.$`, and any later runtime-only helpers added under that namespace.
- Version `1` saved games require `renderedPath`. `highlightPath` was never part of a released schema and is not accepted as an alias; accepting undocumented aliases would make misspelled or stale producer fields look valid and create compatibility obligations without a real persisted format to support.
- Embedded copied engine payloads inside `IEnginePlayer.assignedEngine` and `analysis.seats[].assignedEngine` must satisfy the `IAssignedEngine` shape directly. Invalid embedded engine payloads are rejected as invalid saved-game payloads rather than silently repaired.
- `analysis.seats` persists ordered assignments with zero to three rendered lines each for the saved `renderedPath`. There is no analysis position key. Runtime line maps, operations, and subscriptions remain excluded.
