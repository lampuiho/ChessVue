# SerializationService

## Purpose
Own canonical JSON serialisation, deserialisation, and migration for all persisted artefacts.

## Public Interface
```ts
serialiseSettings(snapshot: ISettingsSnapshot): string
deserialiseSettings(raw: string): ISettingsSnapshot
serialiseGameSession(snapshot: IGameSessionSnapshot): string
deserialiseGameSession(raw: string): IGameSessionSnapshot
serialiseUiLayoutState(state: IUiLayoutState): string
deserialiseUiLayoutState(raw: string): IUiLayoutState
serialiseGame(workspace: IGameWorkspace): string
deserialiseGame(raw: string): IGameWorkspace
migrateSettingsSnapshot(input: unknown): ISettingsSnapshot
migrateGameSessionSnapshot(input: unknown): IGameSessionSnapshot
migrateUiLayoutState(input: unknown): IUiLayoutState
migrateGame(input: unknown): IGameWorkspace
```

## Responsibilities

- keep one canonical JSON wire shape per persisted artefact
- own saved-game document conversion for internal save/load flows and external import/export flows after stores obtain or supply raw document text
- detect the incoming saved-game document shape and schema version before choosing the deserialisation or migration path
- migrate older schema versions on read
- reject corrupt core payloads
- reject incomplete, unsupported, or incompatible saved-game payloads rather than inventing detached UI restore sections or partial-recovery import paths
- strip runtime-only `$` metadata from persisted output
- validate board-root consistency through structural position identity rather than stored FEN
- remain platform-independent and path-agnostic: stores orchestrate adapter calls, but `SerializationService` decides how persisted payloads are interpreted

## Scenario Coverage
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
- `SerializationService` owns payload shape only. It does not resolve file paths, storage roots, executable-root policy, or save-root policy.
- Recent-game history remains query-derived from available save targets and is not a serialised persisted artefact owned by this service.
