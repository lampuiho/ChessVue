# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-02`.

### SCN-SESSION-01 - Fresh Launch with No Saved State
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadSession` -> `GamesStore.restorePersistedGames` -> router startup resolution.
- Private design: `SettingsStore._loadStoredSnapshot` -> `_migrateSnapshotOrDefault`; `UiStateStore._loadStoredSession` -> `_coerceActiveRoute`; `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspaceCollection`; `Router._resolveStartupTarget`.
- Requirement verification: `Pass`. Defaults load independently, bad absence is not treated as corruption, and startup lands on a neutral route instead of auto-creating a game.

### SCN-SESSION-02 - Restore Previous Session
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadSession` -> `GamesStore.restorePersistedGames(session.openGameIds)` -> `UiStateStore.setActiveGame` -> router restore.
- Private design: `UiStateStore._coerceOpenTabs` -> `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspace` -> `_repairMissingActiveGame`; `Router._restoreReturnRoute`.
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
- Public flow: `UiStateStore.showModal("newGame")` -> `GamesStore.createGame` -> `UiStateStore.hideModal`.
- Private design: `GamesStore._validateCreateRequest` -> `_resolveWorkspaceKind` -> `_validateAssignedEngines` -> `_initialiseClockSnapshot` -> `_seedAnalysisAssignment`.
- Requirement verification: `Pass`. Invalid time control or missing required engines are blocked before workspace creation, and a no-player request resolves into `freeAnalysisSetup`.

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility
- Public flow: `UiStateStore.setActiveGame` -> router tab navigation -> `GamesStore.getGame` -> `GamesStore.listGames`.
- Private design: `UiStateStore._coerceOpenTabs` -> `_coerceActiveRoute`; `Router._validateGameRoute` -> `_selectFallbackRoute`.
- Requirement verification: `Pass`. Tab visibility is derived from `openGameIds`, and invalid targets fall back deterministically.

### SCN-NAV-01 - Route to Settings and Back to Active Game
- Public flow: conditional `GamesStore.pauseGame` -> `UiStateStore.setActiveRoute("/settings")` -> `SettingsStore.loadSettings`; return path uses `UiStateStore.setActiveRoute` and conditional `GamesStore.resumeGame`.
- Private design: `GamesStore._maybeAutoPauseForMenu` -> `UiStateStore._rememberReturnRoute` -> `SettingsStore._loadStoredSnapshot`; return uses `Router._restoreReturnRoute` -> `GamesStore._resumeIfMenuOwnedPause`.
- Requirement verification: `Pass`. Auto-pause remains policy-driven, dirty-form prompts stay in `UiStateStore`, and return routing does not depend on a still-valid game always existing.

### SCN-NAV-02 - Invalid Game Route Handling
- Public flow: router guard -> `GamesStore.getGame` -> `GamesStore.listGames` -> `UiStateStore.setActiveGame`.
- Private design: `Router._validateGameRoute` -> `_selectFallbackRoute`; `UiStateStore._coerceActiveRoute`.
- Requirement verification: `Pass`. Unknown `/game/:id` routes are rejected before `GameView` binds to missing state.
