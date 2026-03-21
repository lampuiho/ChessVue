# ChessVue Persistence Contract

## Purpose
This document defines what ChessVue persists, how persisted artefacts are separated, and what restore guarantees the low-level rewrite must honour.

## Canonical Persisted Artefacts
ChessVue persists three artefact types.

### 1. User Settings Snapshot
Purpose: store committed user-editable settings.

Owner:
- [settings_contract.md](settings_contract.md)

Contains:
- the authoritative settings schema
- engine inventory managed through settings
- version metadata for migration

Does not contain:
- open tabs
- transient modal state
- per-game move or analysis data

### 2. Session Snapshot
Purpose: restore the app shell across launches.

Contains:
- open game IDs and tab order
- active game ID
- last active route among baseline routes
- non-modal shell state needed to reopen the same workspace

Does not contain:
- canonical game records
- user settings values
- transient modal visibility

### 3. Saved Game Document
Purpose: represent one game or setup workspace in a serialisable form.

This is the canonical persisted game payload for both:

- internal autosave storage
- manual export and import files

Contains:
- game identity and timestamps
- player slots and per-game engine assignment
- workspace kind and result state
- board root, move tree, current live node, and current visible node
- clock configuration and current clock snapshot
- exact-screen snapshot for the saved node
- saved analysis snapshot for the visible node
- schema version metadata

Does not contain:
- unrelated session shell state such as open tab order for other games
- transient modal visibility

## Exact-Screen Restore Requirement
When a saved game is restored, ChessVue must first recreate the exact visible screen represented by the saved document.

That means restore must show:

- the saved visible node or position
- the saved panel visibility/layout state for that game screen
- the saved displayed analysis lines for that position

Only after that visible state is restored may live analysis resume.

## Ownership Boundaries
### Game Document Owns
- game identity and lifecycle state
- move tree and live/mainline markers
- free-analysis versus live-game state
- clock state and timing metadata
- per-game engine assignment
- saved screen snapshot for that game
- saved analysis snapshot for the saved visible node

### Session Snapshot Owns
- which games are currently open in the shell
- which game is active
- route-level shell restoration

### Settings Snapshot Owns
- user preferences and default behaviours
- engine inventory records

## Analysis Persistence Rule
The baseline contract requires persistence of the latest displayed analysis snapshot for the saved visible node.

This includes:

- engine identity
- the position being shown
- the latest displayed score and lines for each visible engine

The baseline does not require a full historical cache of every analysed position. If broader caches are stored later, restore behaviour must still honour the exact-screen rule above.

## Autosave Versus Export
### Autosave
- Triggered by meaningful state changes such as committed moves, settings changes, active game changes, or other contractually persisted game-screen changes.
- Writes the saved game document, session snapshot, or settings snapshot as appropriate.
- May batch rapid writes, but must remain eventually consistent.

### Manual Export
- Writes the same canonical saved game document to a user-selected file.
- Must preserve the same restore fidelity as autosave.
- Must not depend on session-only data outside that document.

### Manual Import
- Reads the canonical saved game document from file.
- Migrates older versions before insertion into stores.
- Restores the saved screen immediately, then resumes live analysis if possible.

## Schema Versioning
- Every persisted artefact type must include an explicit schema version.
- Migration occurs on read, before the payload is exposed to the rest of the app.
- After successful migration, the latest schema should be written back during the next normal save cycle.

## Corrupt or Partial Payload Handling
### Session Snapshot
- If corrupt, discard the bad session snapshot and keep valid settings and valid games.

### Settings Snapshot
- If corrupt, discard the bad settings snapshot and fall back to defaults.

### Saved Game Document
- If the core game payload is corrupt, reject that game document.
- If optional sections such as saved screen state or saved analysis snapshot are corrupt, load the core game when possible and reset only the invalid optional sections to safe defaults.

The app must isolate bad payloads instead of failing the whole launch or import flow.

## Duplicate Game ID Handling
- Internal autosave restore trusts the persisted ID.
- File import must detect collisions with existing in-app game IDs.
- On collision, the imported game receives a new ID before insertion.
- The imported document otherwise preserves its content and visible-screen snapshot.

## Baseline File Format Scope
- The baseline import and export contract is one canonical internal JSON document.
- Broader external formats are deferred to [ideas.md](ideas.md).

## Non-Baseline Exclusions
This contract does not commit to:

- batch import or export
- public-domain format support beyond the canonical JSON document
- broader analysis history caches than the exact-screen requirement
