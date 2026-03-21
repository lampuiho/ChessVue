# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-02`.

### SCN-SESSION-01 - Fresh Launch with No Saved State
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadSession` -> `GamesStore.restorePersistedGames` -> router startup resolution.
- Private design: `SettingsStore._loadStoredSnapshot` -> `_migrateSnapshotOrDefault`; `UiStateStore._loadStoredSession` -> `_coerceActiveRoute`; `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspaceCollection`; `Router._resolveStartupTarget`.
- Requirement verification: `Pass`. Defaults load independently, bad absence is not treated as corruption, and startup lands on a neutral route instead of auto-creating a game.

### SCN-SESSION-02 - Restore Previous Session
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadSession` -> `GamesStore.restorePersistedGames(session.openGameIds)` -> `UiStateStore.setActiveGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> router restore.
- Private design: `UiStateStore._coerceOpenTabs` -> `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspace` -> `_repairMissingActiveGame` -> `_restoreSavedVisibleState`; `Router._restoreReturnRoute`.
- State/settings coverage: restore keeps the saved `workspaceKind`, `interactionContext`, `clockState`, and `resultState` intact before any engine runtime resumes. `analysis.resumeLiveAnalysisAfterRestore` gates whether continuous analysis restarts after the saved visible snapshot is shown. `_maybeRequestEngineTurn` runs only when the restored context lands on `liveGame + currentPosition + ongoing + not paused` and the side to move is engine-controlled.
- Requirement verification: `Pass`. Session restore is isolated from settings restore and repairs invalid `activeGameId` values before routing.

### SCN-SESSION-03 - Startup with Corrupt Persisted Data
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadSession` -> `GamesStore.restorePersistedGames`.
- Private design: `SerializationService._parseJson` -> `_migrateBySchemaVersion`; `SettingsStore._migrateSnapshotOrDefault`; `GamesStore._skipCorruptDocument`; `StorageAdapter.removeGameDocument` or repaired rewrite on the next save cycle.
- Requirement verification: `Pass`. Corrupt session or settings payloads fall back independently, and corrupt core game payloads are isolated instead of crashing startup.

### SCN-GAME-01 - Quick New Game from Menu
- Public flow: `GamesStore.createGame` -> `UiStateStore.openTab` -> `UiStateStore.setActiveGame` -> `UiStateStore.saveSession`.
- Private design: `GamesStore._buildDefaultCreateRequest` -> `_validateCreateRequest` -> `_createWorkspace` -> `_persistWorkspace`; `UiStateStore._coerceOpenTabs`.
- Requirement verification: `Pass`. The game becomes active immediately, and persistence failure can be surfaced without discarding the in-memory workspace.

### SCN-GAME-02 - Custom New Game with User Options
- Public flow: `UiStateStore.showModal("newGame")` -> `GamesStore.createGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> `UiStateStore.hideModal`.
- Private design: `GamesStore._validateCreateRequest` -> `_resolveWorkspaceKind` -> `_rejectUnsupportedPlayerCombination` -> `_validateAssignedEngines` -> `_initialiseClockSnapshot` -> `_seedAnalysisAssignment`.
- State/settings coverage: at least one human side is required for a baseline `liveGame`; a request with neither side assigned becomes `freeAnalysisSetup`, while a request with both sides assigned to `engine` is rejected because engine-vs-engine autonomous play is out of baseline scope. `_maybeRequestEngineTurn` is evaluated immediately after creation when the resulting live game starts on an engine-controlled side to move.
- Requirement verification: `Pass`. Invalid time control or missing required engines are blocked before workspace creation, a no-player request resolves into `freeAnalysisSetup`, and unsupported engine-vs-engine live creation is rejected centrally.

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility
- Public flow: `UiStateStore.setActiveGame` -> router tab navigation -> `GamesStore.getGame` -> `GamesStore.listGames`.
- Private design: `UiStateStore._coerceOpenTabs` -> `_coerceActiveRoute`; `Router._validateGameRoute` -> `_selectFallbackRoute`.
- Requirement verification: `Pass`. Tab visibility is derived from `openGameIds`, and invalid targets fall back deterministically.

### SCN-NAV-01 - Route to Settings and Back to Active Game
- Public flow: conditional `GamesStore.pauseGame` -> `UiStateStore.setActiveRoute("/settings")` -> `SettingsStore.loadSettings`; return path uses `UiStateStore.setActiveRoute` and conditional `GamesStore.resumeGame`.
- Private design: `GamesStore._maybeAutoPauseForMenu` -> `UiStateStore._rememberReturnRoute` -> `SettingsStore._loadStoredSnapshot`; return uses `Router._restoreReturnRoute` -> `GamesStore._resumeIfMenuOwnedPause`.
- State/settings coverage: `session.autoPauseOnMenu` applies only to timed `liveGame + currentPosition + ongoing` contexts. The stored pause owner prevents settings return from auto-resuming a manually paused game or a game paused for another reason such as in-game analysis.
- Requirement verification: `Pass`. Auto-pause remains policy-driven, dirty-form prompts stay in `UiStateStore`, and return routing does not depend on a still-valid game always existing.

### SCN-NAV-02 - Invalid Game Route Handling
- Public flow: router guard -> `GamesStore.getGame` -> `GamesStore.listGames` -> `UiStateStore.setActiveGame`.
- Private design: `Router._validateGameRoute` -> `_selectFallbackRoute`; `UiStateStore._coerceActiveRoute`.
- Requirement verification: `Pass`. Unknown `/game/:id` routes are rejected before `GameView` binds to missing state.
