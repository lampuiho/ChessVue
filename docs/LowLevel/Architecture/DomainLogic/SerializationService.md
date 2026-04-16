# SerializationService

## Purpose
Own canonical persisted payload validation, migration, and the layer-2 storage-backed persistence boundary for all persisted artefacts.

## Public Interface
```ts
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
migrateSettingsSnapshot(input: unknown): ISettingsSnapshot
migrateGameSessionSnapshot(input: unknown): IGameSessionSnapshot
migrateUiLayoutState(input: unknown): IUiLayoutState
migrateGame(input: unknown): IGame
```

## Responsibilities
- keep one canonical JSON wire shape per persisted artefact
- own file-backed settings, game-session, UI-layout, and saved-game reads or writes behind explicit caller-supplied paths
- own managed-save directory enumeration and external import or export picker access behind the same layer-2 persistence boundary
- own saved-game document conversion for internal save/load flows and external import/export flows
- detect the incoming saved-game document shape and schema version before choosing the deserialisation or migration path
- migrate older schema versions on read
- reject corrupt core payloads
- reject incomplete, unsupported, or incompatible saved-game payloads rather than inventing detached UI restore sections or partial-recovery import paths
- strip runtime-only `$` metadata recursively from persisted output before any write path reaches `StorageAdapter`
- validate board-root consistency through structural position identity rather than stored FEN
- validate nested move-tree structure, `mainlineChildIndex`, and persisted `livePath` / `highlightPath`
- validate persisted `IGame.analysis`, including ordered snapshot shape and embedded copied-engine payload shape
- stop at canonical payload validation, migration, and runtime-only `$` stripping; rebuilding runtime-only move-tree references, `$.parent`, and store-usable current-node selection belongs to `GamesStore` / `WorkspaceRestoreUtility` after successful deserialisation
- remain path-agnostic in the sense that callers supply the concrete file path; `SerializationService` never decides which specific file is being read or written

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
- `SerializationService` depends on `StorageAdapter` for raw file and dialog access, but stores still depend only on this layer-2 boundary rather than on the adapter directly.
- `SerializationService` accepts explicit file paths from callers. Build config supplies app-owned settings, session, and layout file paths, while `SavedGameIndexService` supplies managed save or load file paths beneath user-configurable `session.saveRootPath`.
- Recent-game history remains query-derived from available save targets and is not a serialised persisted artefact owned by this service.
- All runtime-only `$` members are stripped from persisted output, including `IGame.$`, `IPlayer.$`, `IAssignedEngine.$`, `IMove.$`, `IMoveNode.$`, and any later runtime-only helpers added under that namespace.
- Embedded copied engine payloads inside `IEnginePlayer.assignedEngine` and `analysis.snapshots[].assignedEngine` must satisfy the `IAssignedEngine` shape directly. Invalid embedded engine payloads are rejected as invalid saved-game payloads rather than silently repaired.
- `analysis.snapshots[].positionKey` is preserved as an opaque persisted derived key. Deserialisation validates its presence and shape but does not recompute it during payload interpretation.
