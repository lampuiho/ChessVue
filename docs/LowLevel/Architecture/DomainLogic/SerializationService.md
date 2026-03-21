# SerializationService

## Purpose
Own canonical JSON serialisation, deserialisation, and migration for all persisted artefacts.

## Public Interface
```ts
serialiseSettings(snapshot: ISettingsSnapshot): string
deserialiseSettings(raw: string): ISettingsSnapshot
serialiseSession(snapshot: ISessionSnapshot): string
deserialiseSession(raw: string): ISessionSnapshot
serialiseGameDocument(document: IGameDocument): string
deserialiseGameDocument(raw: string): IGameDocument
migrateSettingsSnapshot(input: unknown): ISettingsSnapshot
migrateSessionSnapshot(input: unknown): ISessionSnapshot
migrateGameDocument(input: unknown): IGameDocument
```

## Responsibilities
- keep one canonical JSON wire shape per persisted artefact
- migrate older schema versions on read
- reject corrupt core payloads
- downgrade only optional game-document sections to safe defaults when partial corruption is recoverable

## Scenario Coverage
- `SCN-SESSION-03`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-LOAD-01`
- `SCN-LOAD-02`
