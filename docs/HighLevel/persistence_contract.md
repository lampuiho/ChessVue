# ChessVue Persistence Contract

## Purpose
This document defines what ChessVue persists, how persisted artefacts are separated, and what restore guarantees the low-level rewrite must honour.

## Canonical Persisted Artefacts
ChessVue persists five artefact types.

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

### 2. Game Session Snapshot
Purpose: restore the reopenable game shell across launches.

Contains:
- open game IDs and tab order
- active game ID
- last active route among baseline routes
- route-level shell state needed to reopen the same workspace

Does not contain:
- canonical game records
- recent-game history metadata
- remembered UI layout state
- user settings values
- transient modal visibility

### 3. UI Layout State
Purpose: remember non-modal UI state such as panel visibility and section folding.

Contains:
- sidebar panel visibility
- section fold or collapse state
- one shared app-shell layout snapshot that is reused across games
- version metadata for migration

Does not contain:
- open game IDs or active route shell state
- per-game layout variants or layout keyed by game ID
- canonical game records
- recent-game history metadata
- user settings values
- transient modal visibility

### 4. Recent Games Snapshot
Purpose: store the recent-game history shown on `HomeView`.

Contains:
- one recent entry per canonical game ID
- newest-first ordering for recent-entry presentation
- display name for home-screen presentation
- whether the winning recent target is `autosave` or `manualFile`
- manual file path when the winning target is a file-backed save
- `lastSavedAtUtc` used to decide whether autosave or manual-file metadata wins for the same game
- version metadata for migration

Does not contain:
- the full saved game payload
- tab order or active route shell state
- user settings values

### 5. Saved Game Payload
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
- schema version metadata

Does not contain:
- unrelated session shell state such as open tab order for other games
- panel visibility or panel positioning
- saved analysis output
- transient modal visibility

The low-level design should persist the game workspace directly rather than maintaining a second detached saved-game interface.

## Restore Requirement
When a saved game is restored, ChessVue must recreate the persisted game workspace represented by the saved payload.

That means restore must show:

- the saved visible node or position
- the saved move tree, clocks, and result state
- the saved interaction context that is part of the game workspace

Only after that game state is restored may live analysis resume.

## Ownership Boundaries
### Saved Game Payload Owns
- game identity and lifecycle state
- move tree and live/mainline markers
- free-analysis versus live-game state
- clock state and timing metadata
- per-game engine assignment
- visible node and interaction context that are part of the game workspace

### Game Session Snapshot Owns
- which games are currently open in the shell
- which game is active
- route-level shell restoration

### UI Layout State Owns
- remembered non-modal UI state such as panel visibility and section folding
- layout restoration that remains useful even when prior open games are not restored

### Recent Games Snapshot Owns
- recent-game metadata shown on `HomeView`
- latest-save deduping between autosave and manual-file targets for the same canonical `gameId`
- file-path metadata needed to reopen manual saved games without reopening a file picker

### Settings Snapshot Owns
- user preferences and default behaviours
- engine inventory records

## Analysis Persistence Rule
The baseline contract does not require persistence of streamed analysis output inside the saved game payload.

On restore, analysis may restart from the restored game state when engines are available and the relevant setting allows it.

## Autosave Versus Export
### Autosave
- Triggered by meaningful state changes such as committed moves, settings changes, active game changes, or other contractually persisted game-screen changes.
- Writes the saved game payload, recent-games snapshot, game-session snapshot, UI-layout state, or settings snapshot as appropriate.
- May batch rapid writes, but must remain eventually consistent.

### Manual Export
- Writes the same canonical saved game payload to a user-selected file.
- Refreshes the recent-games snapshot with the final written file path after a successful write.
- Must preserve the same game-state restore fidelity as autosave.
- Must not depend on session-only data outside that payload.

### Manual Import
- Reads the canonical saved game payload from file.
- Migrates older versions before insertion into stores.
- Refreshes the recent-games snapshot after any duplicate-ID repair so the stored recent entry points to the final in-app `gameId` and the chosen file path.
- Restores the saved game workspace immediately, then resumes live analysis if possible.

## Schema Versioning
- Every persisted artefact type must include an explicit schema version.
- Migration occurs on read, before the payload is exposed to the rest of the app.
- After successful migration, the latest schema should be written back during the next normal save cycle.

## Corrupt or Partial Payload Handling
### Game Session Snapshot
- If corrupt, discard the bad game-session snapshot and keep valid settings, valid UI-layout state, and valid games.

### UI Layout State
- If corrupt, discard the bad UI-layout state and fall back to layout defaults without affecting valid settings, valid recent-game history, or valid games.

### Recent Games Snapshot
- If corrupt, discard the bad recent-games snapshot and keep valid settings, valid game-session state, valid UI-layout state, and valid games.

### Settings Snapshot
- If corrupt, discard the bad settings snapshot and fall back to defaults.

### Saved Game Payload
- If the core game payload is corrupt, reject that saved game payload.

The app must isolate bad payloads instead of failing the whole launch or import flow.

## Duplicate Game ID Handling
- Internal autosave restore trusts the persisted ID.
- File import must detect collisions with existing in-app game IDs.
- On collision, the imported game receives a new ID before insertion.
- The imported payload otherwise preserves its content and game-state snapshot.

## Baseline File Format Scope
- The baseline import and export contract is one canonical internal JSON document.
- Broader external formats are deferred to [ideas.md](ideas.md).

## Restore Policy Note
- `session.restorePreviousSession` controls whether the game-session snapshot is used to reopen prior tabs and the active route.
- That setting does not block loading UI-layout state; remembered panel visibility and fold state may still be restored independently.

## Non-Baseline Exclusions
This contract does not commit to:

- batch import or export
- public-domain format support beyond the canonical JSON document
- persisted streamed analysis snapshots inside the saved game payload
