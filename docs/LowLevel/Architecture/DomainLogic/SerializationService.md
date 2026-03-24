# SerializationService

## Purpose
Own canonical JSON serialisation, deserialisation, and migration for all persisted artefacts.

## Public Interface
```ts
serialiseSettings(snapshot: ISettingsSnapshot): string
deserialiseSettings(raw: string): ISettingsSnapshot
serialiseRecentGames(snapshot: IRecentGamesSnapshot): string
deserialiseRecentGames(raw: string): IRecentGamesSnapshot
serialiseGameSession(snapshot: IGameSessionSnapshot): string
deserialiseGameSession(raw: string): IGameSessionSnapshot
serialiseUiLayoutState(state: IUiLayoutState): string
deserialiseUiLayoutState(raw: string): IUiLayoutState
serialiseGame(workspace: IGameWorkspace): string
deserialiseGame(raw: string): IGameWorkspace
migrateSettingsSnapshot(input: unknown): ISettingsSnapshot
migrateRecentGamesSnapshot(input: unknown): IRecentGamesSnapshot
migrateGameSessionSnapshot(input: unknown): IGameSessionSnapshot
migrateUiLayoutState(input: unknown): IUiLayoutState
migrateGame(input: unknown): IGameWorkspace
```

## Responsibilities
- keep one canonical JSON wire shape per persisted artefact
- migrate older schema versions on read
- reject corrupt core payloads
- reject incomplete, unsupported, or incompatible saved-game payloads rather than inventing detached UI restore sections or partial-recovery import paths

## Scenario Coverage
- `SCN-SESSION-03`
- `SCN-NAV-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-LOAD-01`
- `SCN-LOAD-02`
