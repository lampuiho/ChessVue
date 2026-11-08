# ChessVue Persistence Contract

## Purpose
This document defines what ChessVue persists, how persisted artefacts are separated, and what restore guarantees the implementation honours.

## Storage Hosts
The same canonical artefacts and logical paths are used on both platform targets. Only the storage adapter differs.

### Desktop (NW.js)
- `NwjsStorageAdapter` reads and writes UTF-8 files through Node. Relative paths, including the default `saves` root and the app-owned file names, resolve against the desktop host's working directory; the development launcher uses `.desktop/development/`.
- External import and export use the native NW.js open and save dialogs.
- Closing the window awaits the registered close callbacks, including close autosave, before engine shutdown and exit.

### Browser
- `BrowserStorageAdapter` stores files through `BrowserFileSystem`: one JSON index in the origin's localStorage under `chessvue:files:v1`, holding virtual directories and each file's text and modification time. Modification times only increase, so latest-save ordering stays stable. The configured save folder is a virtual path inside this index and grants no disk access.
- External import opens a file input and reads the chosen JSON file into memory for one read. External export downloads the canonical JSON with the suggested filename; a cancelled import picker is reported as cancellation.
- Browser lifecycle checkpoints are best effort: `pagehide` and the document becoming hidden raise the same close callbacks, but a tab cannot await asynchronous work while closing. Explicit saves and move-count autosaves are awaited during normal use.
- Writes are limited by the origin's storage quota and site permissions; a failed write surfaces as a storage error through the calling flow. Because every browser file shares one index, an unreadable index fails every read and write until it is cleared.
- Seeded browser journeys use an isolated sessionStorage namespace with the same file representation.
- Browser engine package files are stored separately in IndexedDB and are not part of these artefacts; see [engine_runtime.md](engine_runtime.md#engine-packages).

## Canonical Persisted Artefacts
ChessVue persists four artefact types.

| Artefact | Location | Owner | Written when |
| --- | --- | --- | --- |
| User settings snapshot | `settings.json` (`BuildConfig.persistence.settingsPath`) | `UserSettingService` | Apply, Save or Reset in Settings |
| Game session snapshot | `game-session.json` (`gameSessionPath`) | `UiStateStore` through `SerializationService` | Startup completion and every committed route change |
| UI layout state | `layout-state.json` (`layoutStatePath`) | `UiStateStore` through `SerializationService` | Panel or engine-group fold changes and engine removal |
| Saved game payload | `<saveRootPath>/<gameId>/auto.json` or `<saveRootPath>/<gameId>/<saveName>.json`, or an external file | `SavedGamesStore` through `SerializationService` | Autosave triggers, explicit save, export |

Runtime fields under `$`, including premove queues, pause owners, pending or deferred player turns, the game-end announcement flag and engine processes, are never persisted. Saving leaves the in-memory premove FIFO intact; restoring creates fresh runtime without it. Projected premove pieces and red squares never replace canonical root, tree, selectors or engine input, including while saving.

### 1. User Settings Snapshot
Purpose: store committed user-editable settings.

Owner:
- [settings_contract.md](settings_contract.md)

Contains:
- the authoritative settings schema, including game creation defaults
- the engine profile inventory
- version metadata for current-format validation and future dispatch

Does not contain:
- open tabs
- transient modal state
- per-game move or analysis data
- browser engine package files

### 2. Game Session Snapshot
Purpose: restore the reopenable game shell across launches.

Contains:
- `openGameIds` in tab order
- `activeGameId`
- `activeRoute`: the last committed route among `/home`, `/game/:id`, `/saved-games/load`, `/saved-games/load/:name`, `/saved-games/save/:name` and `/settings/:category`. Engine profile and package child routes are not remembered.

Does not contain:
- canonical game records
- recent-game history metadata
- remembered UI layout state
- user settings values
- transient modal visibility

Loaded snapshots are coerced before use: duplicate or empty tab IDs are dropped, the active game must be an open tab, and an invalid route or a game route for a closed tab falls back to the active game or `/home`.

### 3. UI Layout State
Purpose: remember non-modal UI state such as panel visibility and foldable-section state.

Contains:
- `showHistoryPanel` and `showAnalysisPanel`
- `historyCollapsed` and `analysisCollapsed`
- `analysisEngineExpandedByIndex`: analysis-engine fold state by the active game's rendered analysis-row index
- one global app-shell layout snapshot for the current installation
- version metadata for current-format validation and future dispatch

Does not contain:
- open game IDs, selected active game tab, or active route shell state
- full per-game layout variants outside the committed fold-state maps
- the transient navigation-rail expansion preference
- canonical game records
- recent-game history metadata
- user settings values
- transient modal visibility

### 4. Saved Game Payload
Purpose: represent one game or setup workspace in a serialisable form.

This is the canonical persisted game payload for:

- internal autosave storage
- internal managed save files
- external export and import files

Contains (`gameSchema`):
- `schemaVersion` and `metadata`: game identity, name and created/updated timestamps
- `whitePlayer` and `blackPlayer`, including copied engine payloads (`displayName`, `clientType`, `entryPath`, `options`)
- `gameplayOptions`: `allowTakeback` and `showLiveAnalysisMoves`
- `gameState`, `resultState`, `resultReason` and unresolved `drawOfferState` when present
- `rootPosition`, `moveTree` and minimal selector paths for `livePath` and `renderedPath`; move nodes carry their clock snapshots and optional `recordedAnalysis`
- `timeControl` and the current `clockSnapshot`
- persisted analysis seats with copied engine payloads

Does not contain:
- unrelated session shell state such as open tab order for other games
- panel visibility or panel positioning
- transient modal visibility
- engine package files or binaries

The game workspace is persisted directly rather than through a second detached saved-game interface.

## Restore Requirement
When a saved game is restored, ChessVue recreates the persisted game workspace represented by the saved payload.

That means restore shows:

- the saved highlighted node or position
- the saved move tree, clocks, and result state
- the saved `gameState` that is part of the game workspace
- the saved per-game gameplay options

A restored paused game requires an explicit Resume, because its runtime pause owners are not persisted. Only after the game state is restored may live analysis resume.

Analysis seats retain up to three rendered lines each, belonging to the saved root and `renderedPath`. Empty seats remain valid assignments. There is no analysis position key or visibility filter; position-changing actions clear old rendered results before publication or saving. Runtime line maps, promises, subscriptions, and process state are excluded. Restored results remain available when automatic resume is disabled or engines are unavailable. The revised analysis schema replaced the unfinished earlier format without migration support.

## Recorded Analysis Scope

The user confirmed that recorded analysis applies only to actual moves played in games. Exploratory moves are temporary and may be pruned under SCN-HIST-04; they do not create recorded-analysis entries. Saving/restoring a workspace may still include branches under the move-tree contract, which is distinct from the recording feature. See [Q-ANALYSIS-002 — resolved](../questions/analysis/Q-ANALYSIS-002-VariationRetention.md).

Actual played move nodes may also contain `recordedAnalysis`: a capture timestamp and copied engine seats with their names/options, output timestamps, depth, scores, up to three principal variations and any best move available at commit. These are pre-move evaluations, labelled separately from current rendered-position output. Capture is automatic when an actual move is played with available analysis for its parent position; no engine output means no record. Historical rewrites record the selected parent's output. Engine replies committed while a different position is rendered do not copy unrelated output. Exploratory moves never capture or replace records.

Records belong to their played node and survive subsequent play, temporary exploratory pruning, historical rewrites retaining that node, and canonical save/load/export/import. Explicit takeback may remove played nodes under its existing destructive tree contract. Runtime fields are excluded from copied seats and persisted records. The optional node field preserves compatibility with version-1 files lacking records. [Q-ANALYSIS-001](../questions/analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md) and [Q-ENGINE-001](../questions/engine/Q-ENGINE-001-ComparisonAndPersistence.md) retain broader future capture/replacement policy prompts; JRN-HIST-06 verifies this available-output baseline.

## Ownership Boundaries
### Saved Game Payload Owns
- game identity and lifecycle state
- move tree and live/mainline markers
- `gameState`
- clock state and timing metadata
- unresolved draw-offer state for the live workspace when one exists
- per-game copied engine payloads, including copied launch configuration
- per-game gameplay options
- `renderedPath`, `livePath`, and `gameState` as persisted parts of the game workspace

### Game Session Snapshot Owns
- which games are currently open in the shell
- which game is active
- route-level shell restoration

### UI Layout State Owns
- remembered non-modal UI state such as history/analysis panel visibility and fold state for all committed foldable sections
- analysis-engine fold state keyed by the active game's rendered analysis-row order, recalculated from that game's ordered persisted analysis seat rows when the active game changes
- layout restoration that remains useful even when prior open games are not restored

### Settings Snapshot Owns
- user preferences, creation defaults and default behaviours
- engine inventory records

## Persistence Boundary
- `SerializationService` is the layer-2 storage-backed persistence boundary for game-session, UI-layout, and saved-game files, managed-save enumeration and external pickers.
- `UserSettingService` reads and writes the settings document itself through the storage adapter, validating it with the same settings schema, so the accepted settings cache and its file have one owner. `SerializationService` also exposes settings document methods; the running app does not use them.
- `SerializationService` stays path-agnostic in the sense that callers supply explicit file paths; it does not decide which concrete file is being used.
- `SavedGameIndexService` remains the pure owner of user-configurable managed-save root rules and managed-save file-path composition beneath `gameSession.saveRootPath`.
- Build config owns the concrete app-managed file paths for settings, game-session, and UI-layout artefacts.

## On-Demand Recent Games Projection
- `HomeView` recent entries are projected on demand from the available managed saves instead of being stored as a separate persisted artefact. `IRecentGamesSnapshot` remains a contract type but is not written.
- That projection keeps at most one recent entry per canonical `gameId`, using the latest save in each game folder.
- The latest save is the newest by modification time, with the autosave first on a tie. Its game name is read from that document; unreadable documents are skipped.
- `HomeView` shows the three newest entries. Opening an entry reuses the game when it is already open, and otherwise loads that game's latest managed save.

## Internal Save File Organisation
- `gameSession.saveRootPath` defines the logical root for ChessVue's own save/load files.
- The default root is the relative path `saves`.
- ChessVue creates one folder per canonical game beneath that root, named by its game identity.
- Each game folder may contain one autosave entry (`auto.json`) plus user-named save files (`<saveName>.json`) that use the same canonical saved-game payload.
- The browser emulates the folder structure in its virtual index, but the contract remains folder-based.
- The managed save root remains user-configurable and is not moved into build config. Changing it does not migrate existing files.

## Managed Save Input Ownership
- `SavedGamesView` owns validation of a user-entered managed save name before it calls `SavedGamesStore`. Invalid input keeps the Save action disabled, remains editable with inline feedback, and never reaches the store.
- An accepted save name is one non-reserved file-name segment, not a path. Blank names, `auto`, reserved path characters, directory separators, device names, a trailing dot and control characters are invalid.
- Managed game-folder identifiers do not come from editable text. New games use an app-generated identity, managed loads use the identity of the enumerated save group, and external imports receive a fresh app-generated identity before insertion or any later managed save.
- `SavedGamesStore` does not repeat presentation form validation. `SavedGameIndexService` still asserts that every identity and save name is a single safe file-name segment, and that `auto` is not used as a named save, before composing a path; this is a path-safety guard rather than user feedback. External file paths remain owned by the picker flow.

## Analysis Persistence Rule
Saved analysis seats are persisted directly inside the saved game payload.

On restore, those persisted snapshots are restored with the game, and analysis may then restart from the restored game state when engines are available and `analysis.resumeLiveAnalysisAfterRestore` allows it.

## Internal Save Storage and External File Flows
### Autosave
- Writes or replaces the dedicated autosave entry for one game using the canonical saved-game payload.
- Triggered only by the move-count threshold in `gameSession.autosaveAfterMoveCount` and the close trigger in `gameSession.autosaveOnClose`. Move-count autosaves are queued one at a time; a failure shows an **Automatic save failed** notice in `GameView`.
- When `gameSession.restorePreviousSession = true`, accepted settings coerce `gameSession.autosaveOnClose = true` so reopening the prior session can rely on at least one up-to-date managed save target for each remembered tab.
- Close autosave writes every open game. On the browser it runs at the best-effort checkpoints described above.
- Settings, game-session state, and UI-layout state remain separate persisted artefacts rather than becoming part of the autosave trigger definition.

### Internal Save File
- Writes the same canonical saved-game payload to a ChessVue-managed save file beneath the configured save root.
- Supports grouped browsing by game and save entry inside the app's route-level save/load view.
- Uses the same restore fidelity as autosave because both persist the same canonical payload.
- Requires overwrite confirmation when a chosen save name already exists inside the selected game folder.
- Deleting a save removes that file; deleting a game removes every save in its folder and leaves any open workspace for it open.

### External Export
- Writes the same canonical saved-game payload to a user-selected file through the host's save dialog or, in the browser, a download.
- Must preserve the same game-state restore fidelity as autosave and internal save files.
- Must not depend on session-only data outside that payload.
- Cancelling the picker writes nothing and shows no success notification. Other picker failures follow the normal error flow.

### External Import
- Reads and validates the canonical saved game payload from a user-selected file.
- Rejects unsupported schema versions before insertion into stores and shows an import error dialog.
- Assigns a fresh game identity, restores the saved game workspace immediately, then resumes live analysis if possible.

## Schema Versioning
- Every persisted artefact type includes an explicit `schemaVersion`.
- Version `1` is the first and only current schema; there are no historical schema payloads or field aliases to migrate.
- Readers accept the current version and reject unsupported versions before exposing a payload to the rest of the app. This prevents malformed current payloads from being mistaken for undocumented older formats.
- The `SerializationService` deserialisation boundary is the reserved place for future version dispatch. No migration API exists until a second schema requires conversion; once it does, conversion must occur there on read and the canonical version should be written during the next normal save cycle.
- The app is unreleased, so contract changes such as the removal of the engine `protocol` field replaced the version-1 shape directly without migrations; see the archived [engine package rework](../ArchivedPlans/EngineInstallationReworkPlan.md#current-contract-changes-and-delivery).

## Corrupt or Partial Payload Handling
### Game Session Snapshot
- If corrupt, discard the bad game-session snapshot, show a recovery warning, and keep valid settings, valid UI-layout state, and valid games. Startup then writes a fresh snapshot.
- If valid, startup restore uses the remembered `openGameIds` as targeted lookup inputs: it lists the managed save groups but reads only the latest save of each remembered game. A game that cannot be restored is removed from the tabs with a recovery warning.

### UI Layout State
- If corrupt, discard the bad UI-layout state, show a recovery warning, and fall back to layout defaults without affecting valid settings or valid saved games.

### Settings Snapshot
- If corrupt or invalid, use defaults and show a recovery warning that links to Settings. The invalid file is not rewritten until an explicit Apply, Save or Reset.

### Saved Game Payload
- If the core game payload is corrupt, reject that saved game payload.
- Unsupported or incomplete saved-game payloads are rejected through the same invalid-document path; there is no partial-recovery import flow.

A missing file is not corruption: it uses defaults without a warning. The app isolates bad payloads instead of failing the whole launch or import flow, subject to the browser index limitation above.

## Duplicate Game ID Handling
- Startup session restore trusts the persisted ID.
- A managed file-backed load takes its identity from the selected enumerated save group.
- Inserting a game whose identity is already open assigns it a new app-generated identity, so loading another snapshot of an open game opens a second workspace. Reopening a recent entry for an open game switches to that game instead. A source note in `GameWorkspaceComposable` records that loading another snapshot of an open game should revert that game rather than clone it; that behaviour is not implemented.
- An external import always receives a fresh app-generated ID before insertion, so imported metadata never becomes a managed path segment.
- The loaded payload otherwise preserves its content and game-state snapshot.

## Baseline File Format Scope
- The internal save/load and external import/export contract is one canonical internal JSON document.
- Broader external formats are deferred to [ideas.md](ideas.md).

## Restore Policy Note
- `gameSession.restorePreviousSession` controls whether the game-session snapshot is used to reopen prior tabs and the active route. When it is off, startup closes the remembered tabs and opens `/home`.
- Startup restore is lazy and targeted: only the remembered `gameId` values referenced by that session snapshot are reopened, each from its latest available managed save target.
- When the app is opened at `/` or `/home`, startup navigates to the remembered committed route. A direct link to another route keeps that route.
- That setting does not block loading UI-layout state; remembered panel visibility and fold state may still be restored independently.

## Non-Baseline Exclusions
This contract does not commit to:

- batch import or export
- public-domain format support beyond the canonical JSON document
