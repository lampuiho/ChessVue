# ChessVue Persistence Contract

## Purpose
This document defines what ChessVue persists, how persisted artefacts are separated, and what restore guarantees the low-level rewrite must honour.

## Canonical Persisted Artefacts
ChessVue persists four artefact types.

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
Purpose: remember non-modal UI state such as panel visibility and foldable-section state.

Contains:
- history and analysis panel visibility
- fold state for all committed foldable sections, including shared history and analysis panels plus analysis-engine groups by the active game's rendered analysis-row index
- one global app-shell layout snapshot for the current installation
- version metadata for migration

Does not contain:
- open game IDs, selected active game tab, or active route shell state
- full per-game layout variants outside the committed fold-state maps
- canonical game records
- recent-game history metadata
- user settings values
- transient modal visibility

### 4. Saved Game Payload
Purpose: represent one game or setup workspace in a serialisable form.

This is the canonical persisted game payload for both:

- internal autosave storage
- internal save/load files
- external export and import files

Contains:
- game identity and timestamps
- player slots and copied per-game engine payloads
- per-game live-analysis display preference
- gameState, result state, and unresolved draw-offer state when present
- board root, move tree, and minimal selector paths for `livePath` and `highlightPath`
- clock configuration and current clock snapshot
- persisted analysis snapshots with copied engine payloads
- schema version metadata

Does not contain:
- unrelated session shell state such as open tab order for other games
- panel visibility or panel positioning
- transient modal visibility

The low-level design should persist the game workspace directly rather than maintaining a second detached saved-game interface.

## Restore Requirement
When a saved game is restored, ChessVue must recreate the persisted game workspace represented by the saved payload.

That means restore must show:

- the saved highlighted node or position
- the saved move tree, clocks, and result state
- the saved `gameState` that is part of the game workspace
- the saved per-game live-analysis display preference that is part of the game workspace

Only after that game state is restored may live analysis resume.

## Ownership Boundaries
### Saved Game Payload Owns
- game identity and lifecycle state
- move tree and live/mainline markers
- `gameState`
- clock state and timing metadata
- unresolved draw-offer state for the live workspace when one exists
- per-game copied engine payloads, including copied launch configuration
- per-game live-analysis display preference
- `highlightPath`, `livePath`, and `gameState` as persisted parts of the game workspace

### Game Session Snapshot Owns
- which games are currently open in the shell
- which game is active
- route-level shell restoration

### UI Layout State Owns
- remembered non-modal UI state such as history/analysis panel visibility and fold state for all committed foldable sections
- analysis-engine fold state keyed by the active game's rendered analysis-row order, recalculated from that game's ordered persisted analysis snapshot rows when the active game changes
- layout restoration that remains useful even when prior open games are not restored

### Settings Snapshot Owns
- user preferences and default behaviours
- engine inventory records

## Persistence Boundary
- `SerializationService` is the single layer-2 storage-backed persistence boundary for settings, game-session, UI-layout, and saved-game files.
- `SerializationService` stays path-agnostic in the sense that callers supply explicit file paths; it does not decide which concrete file is being used.
- `SavedGameIndexService` remains the pure owner of user-configurable managed-save root rules and managed-save file-path composition beneath `gameSession.saveRootPath`.
- Build config owns the concrete app-managed file paths for settings, game-session, and UI-layout artefacts.

## On-Demand Recent Games Projection
- `HomeView` recent entries are projected on demand from the available managed saves instead of being stored as a separate persisted artefact.
- That projection still keeps at most one recent entry per canonical `gameId`.
- When both an autosave target and a saved-file target exist for the same `gameId`, the target with the newest `lastSavedAtUtc` wins for home-screen display.
- File-path metadata needed to reopen a saved-file recent entry is derived from the selected saved target at query time.

## Internal Save File Organisation
- `gameSession.saveRootPath` defines the logical root for ChessVue's own save/load files.
- The default root is the relative path `saves`.
- ChessVue creates one folder per canonical game beneath that root.
- Each game folder may contain one autosave entry plus user-named save files that use the same canonical saved-game payload.
- Platform adapters may emulate the folder structure differently when the host does not expose normal directories, but the contract remains folder-based.
- The managed save root remains user-configurable. It is not moved into build config.

## Analysis Persistence Rule
The baseline contract persists saved analysis snapshots directly inside the saved game payload.

On restore, those persisted snapshots are restored with the game, and analysis may then restart from the restored game state when engines are available and the relevant setting allows it.

## Internal Save Storage and External File Flows
### Autosave
- Writes or replaces the dedicated autosave entry for one game using the canonical saved-game payload.
- Triggered only by the configured move-count threshold in `gameSession.autosaveAfterMoveCount` and the close trigger in `gameSession.autosaveOnClose`.
- When `gameSession.restorePreviousSession = true`, accepted settings coerce `gameSession.autosaveOnClose = true` so reopening the prior session can rely on at least one up-to-date managed save target for each remembered tab set.
- Settings, game-session state, and UI-layout state remain separate persisted artefacts rather than becoming part of the autosave trigger definition.

### Internal Save File
- Writes the same canonical saved-game payload to a ChessVue-managed save file beneath the configured save root.
- Supports grouped browsing by game and save entry inside the app's route-level save/load view.
- Uses the same restore fidelity as autosave because both persist the same canonical payload.
- May require overwrite confirmation when a chosen save name already exists inside the selected game folder.

### External Export
- Writes the same canonical saved-game payload to a user-selected file through a normal OS save dialog.
- Must preserve the same game-state restore fidelity as autosave and internal save files.
- Must not depend on session-only data outside that payload.

### External Import
- Reads the canonical saved game payload from file.
- Migrates older versions before insertion into stores.
- Restores the saved game workspace immediately, then resumes live analysis if possible.

## Schema Versioning
- Every persisted artefact type must include an explicit schema version.
- Migration occurs on read, before the payload is exposed to the rest of the app.
- After successful migration, the latest schema should be written back during the next normal save cycle.

## Corrupt or Partial Payload Handling
### Game Session Snapshot
- If corrupt, discard the bad game-session snapshot and keep valid settings, valid UI-layout state, and valid games.
- If valid, startup restore uses the remembered `openGameIds` only as targeted latest-save lookup inputs; it does not enumerate and reopen every managed save on disk.

### UI Layout State
- If corrupt, discard the bad UI-layout state and fall back to layout defaults without affecting valid settings or valid saved games.

### Settings Snapshot
- If corrupt, discard the bad settings snapshot and fall back to defaults.

### Saved Game Payload
- If the core game payload is corrupt, reject that saved game payload.
- Unsupported or incomplete saved-game payloads are rejected through the same invalid-document path; there is no baseline partial-recovery import flow.

The app must isolate bad payloads instead of failing the whole launch or import flow.

## Duplicate Game ID Handling
- Internal autosave restore trusts the persisted ID.
- File-backed load and external import must detect collisions with existing in-app game IDs.
- On collision, the loaded game receives a new ID before insertion.
- The loaded payload otherwise preserves its content and game-state snapshot.

## Baseline File Format Scope
- The baseline internal save/load and external import/export contract is one canonical internal JSON document.
- Broader external formats are deferred to [ideas.md](ideas.md).

## Restore Policy Note
- `gameSession.restorePreviousSession` controls whether the game-session snapshot is used to reopen prior tabs and the active route.
- Startup restore is lazy and targeted: only the remembered `gameId` values referenced by that session snapshot are reopened, each from its latest available managed save target.
- That setting does not block loading UI-layout state; remembered panel visibility and fold state may still be restored independently.

## Non-Baseline Exclusions
This contract does not commit to:

- batch import or export
- public-domain format support beyond the canonical JSON document
