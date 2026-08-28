# Data Interfaces

## Purpose
This folder defines the shared low-level types used across the platform, domain, state, and presentation layers.

## Core Runtime Types
- [ChessPiece](ChessPiece.md): piece, colour, square, and notation primitives.
- [ChessboardState](ChessboardState.md): serialisable board-position state.
- [Game](Game.md): workspace, player-slot, and state-axis types.
- [Move](Move.md): move payloads, nodes, and move-tree structure.
- [TimeControl](TimeControl.md): time-control config and live clock snapshots.
- [Engine](Engine.md): configured engines, per-game assignment, and runtime sessions.
- [Analysis](Analysis.md): streamed engine output and visible analysis snapshots.
- [ModalState](ModalState.md): typed transient modal kinds and payloads.
- [PlatformError](PlatformError.md): shared typed platform-layer failure contract.
- [PlatformEventRegistration](PlatformEventRegistration.md): active platform event-registration snapshot entries.
- [Appearance](Appearance.md): app theme modes, resolved theme state, and semantic CSS-variable projection.

## Persisted Artefacts
- [Settings](Settings.md): authoritative user settings snapshot.
- [RecentGame](RecentGame.md): recent-game entries projected for `HomeView`.
- [SessionSnapshot](SessionSnapshot.md): persisted game-session and UI-layout restore payloads.
- [GameDocument](GameDocument.md): persistence rules for the canonical saved-game payload, which reuses `IGame`.

## Design Rules
- Interface names use `I` prefixes.
- Types include only committed baseline fields.
- Ownership is documented once and cross-referenced elsewhere rather than duplicated.
- Persisted artefacts include explicit schema versions.

## UTC Timestamp Convention
- UTC instants are real `Date` values with purpose-specific `UtcTimestamp` subclasses: `RecordTimestamp`, `ClockTimestamp`, `AnalysisTimestamp`, `SaveTimestamp`, and `RegistrationTimestamp`. **Why:** string timestamps push parsing, comparison, arithmetic, and formatting into every consumer, while one generic `Date` still allows record, clock, analysis, file, and diagnostic display rules to drift. The replacement invariant is typed arithmetic, one canonical ISO wire value, and one owner for each purpose-specific display format.
- `utcTimestampSchema(...)` accepts a persisted ISO string or an already hydrated `Date` and always constructs the requested subclass; `Date.toJSON()` emits the canonical ISO wire value. **Why:** the same Zod schema validates both JSON on read and the in-memory model before write; accepting only one representation would require duplicate schemas or bypass validation on one boundary.
- Timestamp instances are treated as immutable instants. Workflows replace a timestamp rather than mutating an existing `Date`. **Why:** clock and record history may share an instant safely only while no owner can rewrite it behind another record.
