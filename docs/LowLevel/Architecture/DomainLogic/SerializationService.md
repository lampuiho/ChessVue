# SerializationService

## Purpose
Own canonical persisted payload validation, the future schema-version dispatch boundary, and the layer-2 storage-backed persistence boundary for all persisted artefacts.

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
```

## Responsibilities
- keep one canonical JSON wire shape per persisted artefact
- own file-backed settings, game-session, UI-layout, and saved-game reads or writes behind explicit caller-supplied paths
- own managed-save directory enumeration and external import or export picker access behind the same layer-2 persistence boundary
- own saved-game document conversion for internal save/load flows and external import/export flows
- require the canonical schema version before deserialisation; version `1` is the first and only schema, so there are no historical payload shapes to migrate and unsupported versions are rejected rather than guessed
- keep schema-version dispatch inside each `deserialise*` path; no migration API or conversion exists while version `1` is the only schema. **Why:** speculative migration methods imply unsupported historical formats and expose an API with no real conversion responsibility. When a second schema exists, dispatch and conversion belong here so live consumers still receive only the canonical shape
- reject corrupt core payloads
- reject incomplete, unsupported, or incompatible saved-game payloads rather than inventing detached UI restore sections or partial-recovery import paths
- project values through the canonical Zod persistence schemas so runtime-only `$` metadata and unknown fields are omitted before any write path reaches `StorageAdapter`. **Why:** direct serialisation would leak callbacks, maps, class instances, and unknown runtime fields into the wire format and turn them into accidental compatibility obligations
- treat the schema-created copy as validation and ownership transfer at the persistence trust boundary, not as a precedent for defensive cloning in ordinary live-state workflows. **Why:** the writer needs a canonical persistence-owned model, while live workflows rely on deliberate identity and would be broken by indiscriminate clones; the same schema accepts hydrated timestamps on write and wire strings on read
- validate board-root consistency through structural position identity rather than stored FEN
- validate nested move-tree structure, `mainlineChildIndex`, and persisted `livePath` / `renderedPath`
- validate persisted `IGame.analysis`, including ordered snapshot shape and embedded copied-engine payload shape
- stop at canonical payload validation, future version conversion, and schema projection; rebuilding runtime-only move-tree references, `$.parent`, and store-usable current-node selection belongs to `GamesStore` after successful deserialisation. **Why:** those values depend on active-workspace ownership; hydrating during a pure document read would introduce state-layer assumptions, while omitting insertion-time hydration leaves loaded node traversal silently broken
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
- `SerializationService` accepts explicit file paths from callers. Build config supplies app-owned settings, session, and layout file paths, while `SavedGameIndexService` supplies managed save or load file paths beneath user-configurable `gameSession.saveRootPath`.
- Recent-game history remains query-derived from available save targets and is not a serialised persisted artefact owned by this service.
- All runtime-only `$` members are omitted from persisted output, including `IGame.$`, `IPlayer.$`, `IAssignedEngine.$`, `IMove.$`, `IMoveNode.$`, and any later runtime-only helpers added under that namespace.
- Version `1` saved games require `renderedPath`. `highlightPath` was never part of a released schema and is not accepted as an alias; accepting undocumented aliases would make misspelled or stale producer fields look valid and create compatibility obligations without a real persisted format to support.
- Embedded copied engine payloads inside `IEnginePlayer.assignedEngine` and `analysis.snapshots[].assignedEngine` must satisfy the `IAssignedEngine` shape directly. Invalid embedded engine payloads are rejected as invalid saved-game payloads rather than silently repaired.
- `analysis.snapshots[].positionKey` is preserved as an opaque persisted derived key. Deserialisation validates its presence and shape but does not recompute it during payload interpretation.
