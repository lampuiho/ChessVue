# Data Interfaces

## Purpose
This folder defines the shared low-level types in `src/contracts` used across the platform, domain, state, and presentation layers.

## Core Runtime Types
- [ChessPiece](ChessPiece.md): piece, colour, and square primitives from `contracts/Chess.ts`.
- [ChessboardState](ChessboardState.md): serialisable board position, castling data, check state, and derived position caches.
- [Game](Game.md): canonical game, player, result, runtime, and creation-request types, plus the runtime premove queue from `contracts/Premove.ts`.
- [Move](Move.md): raw, candidate, and detailed moves, move nodes, and move-tree structure.
- [TimeControl](TimeControl.md): time-control config and live clock snapshots.
- [Engine](Engine.md): engine profiles, launch and package projections, per-game assignment, and runtime sessions.
- [Analysis](Analysis.md): analysis lines, seats, recorded move analysis, and visible analysis from `contracts/Analysis.ts` and `contracts/AnalysisSeat.ts`.
- [PlatformError](PlatformError.md): shared typed platform failure contract, plus the non-platform error classes in `contracts/errors`.
- [PlatformEventRegistration](PlatformEventRegistration.md): active platform event-registration snapshot entries.
- [Appearance](Appearance.md): app theme modes, theme-profile snapshots, the semantic CSS-variable contract, and the built-in profiles in `config/AppearanceConfig.ts`.

## Persisted Artefacts
- [Settings](Settings.md): authoritative user settings snapshot.
- [RecentGame](RecentGame.md): recent-game entries projected for `HomeView`.
- [SessionSnapshot](SessionSnapshot.md): persisted game-session and UI-layout restore payloads.
- [GameDocument](GameDocument.md): persistence rules for the canonical saved-game payload, which reuses `IGame`, and the `ISaveGameOptions` save-target request.

## Contracts Documented Elsewhere
These files live under `src/contracts`, but their callable owner documents them so each shape is defined once.

| Contract file | Owning document |
| --- | --- |
| `platform/IPlatformService.ts`, `platform/PlatformTarget.ts` | [PlatformServices](../PlatformAbstraction/PlatformServices.md) |
| `platform/IStorageAdapter.ts`, `platform/IFileSystemEntry.ts`, `platform/IWriteTextFileOptions.ts` | [StorageAdapter](../PlatformAbstraction/StorageAdapter.md) |
| `platform/IProcessManager.ts`, `platform/IProcess.ts` | [ProcessManager](../PlatformAbstraction/ProcessManager.md); [Engine](Engine.md#shared-process-reference) summarises the runtime reference |
| `platform/ISystemThemeAdapter.ts` | [SystemThemeAdapter](../PlatformAbstraction/SystemThemeAdapter.md) |
| `platform/IEngineClient.ts` | [EngineClient](../PlatformAbstraction/EngineClient.md) |
| `domain/ISavedGameFileEntry.ts`, `domain/ISavedGameGroup.ts` | [SavedGameIndexService](../DomainLogic/SavedGameIndexService.md) |
| `domain/GameRestoreOutcome.ts` | [SavedGamesStore](../StateManagement/SavedGamesStore.md) |
| `state/PauseReason.ts` | [GamesStore](../StateManagement/GamesStore.md) |

`contracts/index.ts` re-exports every root contract file except `UtcTimestampSchema.ts` (with `AnalysisSeat.ts` reached through `Analysis.ts`), plus `contracts/state`. `contracts/platform`, `contracts/domain`, and `contracts/errors` are imported through their own folders or files.

## Design Rules
- Interface names use `I` prefixes; object-shaped type aliases such as `IEngineSelection` and `IGamePositionState` follow the same rule. Deep-readonly aliases use a `Readonly` prefix (`ReadonlyGame`, `ReadonlyAnalysisSeat`), and discriminated result unions such as `GameRestoreOutcome` take no prefix.
- Enums are declared as `const enum`. An enum validated at a boundary feeds its `z.enum(...)` schema from an `as const` value tuple, normally an exported sibling such as `playerColours`.
- Each persisted or boundary-validated shape has a sibling Zod schema, normally named `<camelCaseType>Schema`. The owning document lists the schemas and any constraint that is stricter than the TypeScript type.
- Zod object schemas never declare `$`, and Zod object parsing drops undeclared keys. Parsing therefore strips runtime-only state: this is how serialisation excludes `$` and how snapshot copies made through `playerSchema` or `analysisSeatSchema` discard engine runtimes and callbacks.
- Types include committed fields only. An enum member or field that is declared but has no current producer is marked as reserved in its owning document rather than described as live behaviour.
- Ownership is documented once and cross-referenced elsewhere rather than duplicated.
- Persisted artefacts include explicit schema versions. Every current persisted schema accepts only the literal version `1`.

## Readonly Projections
`DeepReadonly<T>` in `contracts/Readonly.ts` recursively applies `readonly` to object properties, arrays, `ReadonlyMap` keys and values, and `ReadonlySet` items. `Date` values (including every `UtcTimestamp` subclass) and functions pass through unchanged.

- Store getters expose deep-readonly projections of store-owned mutable data, for example `ReadonlyGame` from `GamesStore.getGame(...)` and `listGames()`, and `DeepReadonly<ISettingsSnapshot>` from `SettingsStore.settings`. Presentation reads the canonical store objects directly; the type prevents a consumer from mutating paths, trees, or settings that only store actions may change, without the defensive copies rejected by the [Copy And Identity Policy](../index.md#copy-and-identity-policy).
- `IEngineAnalysisUpdate` uses deep-readonly members: one emitted update object passes from the client through the service guard to the game subscription, and none of them may mutate it.
- Timestamps and functions pass through because mapping their members would replace the purpose-specific class or callable type with a structural type, so a readonly projection could no longer be passed where a `RecordTimestamp` or callback is required. Timestamp instants are already treated as immutable (see below).

## UTC Timestamp Convention
- UTC instants are real `Date` values with purpose-specific `UtcTimestamp` subclasses from `@/utility/date`: `RecordTimestamp`, `ClockTimestamp`, `AnalysisTimestamp`, `SaveTimestamp`, and `RegistrationTimestamp`. `UtcTimestamp.toJSON()` emits `toISOString()`, and each subclass overrides `toString()` with its own display format. **Why:** string timestamps push parsing, comparison, arithmetic, and formatting into every consumer, while one generic `Date` still allows record, clock, analysis, file, and diagnostic display rules to drift. The replacement invariant is typed arithmetic, one canonical ISO wire value, and one owner for each purpose-specific display format.
- `utcTimestampSchema<T extends UtcTimestamp>(construct: (value: string | Date) => T)` in `contracts/UtcTimestampSchema.ts` accepts either an ISO 8601 string with an offset (`z.string().datetime({ offset: true })`) or an already hydrated `Date`, and always constructs the requested subclass. **Why:** the same Zod schema validates both JSON on read and the in-memory model that `SerializationService` re-parses before write; accepting only one representation would require duplicate schemas or bypass validation on one boundary.
- Timestamp instances are treated as immutable instants. Workflows replace a timestamp rather than mutating an existing `Date`. **Why:** clock and record history may share an instant safely only while no owner can rewrite it behind another record.
