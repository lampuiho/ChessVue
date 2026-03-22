# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-03`.

### SCN-SESSION-01 - Fresh Launch with No Saved State
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadLayoutState` -> conditional `UiStateStore.loadGameSession` -> `GamesStore.restorePersistedGames` -> `RecentGameStore.loadRecentGames` -> router startup resolution.
- Private design: `SettingsStore._loadStoredSnapshot` -> `_migrateSnapshotOrDefault`; `UiStateStore._loadStoredLayoutState` -> `_coerceLayoutState`; conditional `UiStateStore._loadStoredGameSession` -> `_coerceActiveRoute`; `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspaceCollection`; `RecentGameStore._loadStoredSnapshot` -> `_sortMostRecentFirst`; `Router._resolveStartupTarget`.
- UI surface coverage: startup lands on a centred `HomeView`, which exposes one single-row group of large square action buttons for quick new, custom new, load, and settings without auto-creating a workspace. Because this scenario starts with no persisted state, the recent games list remains hidden.
- Requirement verification: `Pass`. Defaults load independently, bad absence is not treated as corruption, and startup lands on a neutral route instead of auto-creating a game.

### SCN-SESSION-02 - Restore Previous Session
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadLayoutState` -> conditional `UiStateStore.loadGameSession` -> `GamesStore.restorePersistedGames(session.openGameIds)` -> `UiStateStore.setActiveGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> router restore.
- Private design: `UiStateStore._loadStoredLayoutState` -> `_coerceLayoutState`; conditional `UiStateStore._loadStoredGameSession` -> `_coerceOpenTabs` -> `_coerceActiveRoute`; `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspace` -> `_repairMissingActiveGame`; `Router._restoreReturnRoute`.
- State/settings coverage: `session.restorePreviousSession` gates whether the stored game-session snapshot is used to reopen tabs and the active route. `UiStateStore.loadLayoutState` still runs independently so panel visibility and fold state can be restored even when the prior game session is skipped. When a game is restored, `analysis.resumeLiveAnalysisAfterRestore` gates whether continuous analysis restarts after the persisted game state is shown.
- Requirement verification: `Pass`. Game-session restore is isolated from settings and layout restore, respects the restore setting, and repairs invalid `activeGameId` values before routing.

### SCN-SESSION-03 - Startup with Corrupt Persisted Data
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadLayoutState` -> conditional `UiStateStore.loadGameSession` -> `RecentGameStore.loadRecentGames` -> `GamesStore.restorePersistedGames`.
- Private design: `SerializationService._parseJson` -> `_migrateBySchemaVersion`; `SettingsStore._migrateSnapshotOrDefault`; `UiStateStore._loadStoredLayoutState` -> `_resetInvalidLayoutState`; conditional `UiStateStore._loadStoredGameSession` -> `_resetInvalidGameSession`; `RecentGameStore._loadStoredSnapshot` -> `_resetCorruptSnapshot`; `GamesStore._skipCorruptDocument`; `StorageAdapter.removeGame` or repaired rewrite on the next save cycle.
- Requirement verification: `Pass`. Corrupt settings, game-session, UI-layout, recent-games, or game payloads fall back independently, and corrupt core game payloads are isolated instead of crashing startup.

### SCN-GAME-01 - Quick New Game from Menu
- Public flow: `GamesStore.createGame` -> `UiStateStore.openTab` -> `UiStateStore.setActiveGame` -> `UiStateStore.saveGameSession`.
- Private design: `GamesStore._buildDefaultCreateRequest` -> `_validateCreateRequest` -> `_createWorkspace` -> `_persistWorkspace`; `UiStateStore._coerceOpenTabs`.
- Requirement verification: `Pass`. The game becomes active immediately, and persistence failure can be surfaced without discarding the in-memory workspace.

### SCN-GAME-02 - Custom New Game with User Options
- Public flow: `UiStateStore.showModal("newGame")` -> `GamesStore.createGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> `UiStateStore.hideModal`.
- Private design: `GamesStore._validateCreateRequest` -> `_resolveWorkspaceKind` -> `_rejectUnsupportedPlayerCombination` -> `_validateAssignedEngines` -> `_initialiseClockSnapshot` -> `_seedAnalysisAssignment`.
- UI surface coverage: the custom creation flow uses `NewGameModal` inside the shared dialog shell, with named form sections and shared dialog-row create or cancel actions.
- State/settings coverage: at least one human side is required for a baseline `liveGame`; a request with neither side assigned becomes `freeAnalysisSetup`, while a request with both sides assigned to `engine` is rejected because engine-vs-engine autonomous play is out of baseline scope. `_maybeRequestEngineTurn` is evaluated immediately after creation when the resulting live game starts on an engine-controlled side to move.
- Requirement verification: `Pass`. Invalid time control or missing required engines are blocked before workspace creation, a no-player request resolves into `freeAnalysisSetup`, and unsupported engine-vs-engine live creation is rejected centrally.

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility
- Public flow: `UiStateStore.setActiveGame` -> router tab navigation -> `GamesStore.getGame` -> `GamesStore.listGames`.
- Private design: `UiStateStore._coerceOpenTabs` -> `_coerceActiveRoute`; `Router._validateGameRoute` -> `_selectFallbackRoute`.
- Requirement verification: `Pass`. Tab visibility is derived from `openGameIds`, and invalid targets fall back deterministically.

### SCN-NAV-01 - Route to Settings and Back to Active Game
- Public flow: conditional `GamesStore.pauseGame` -> `UiStateStore.setActiveRoute("/settings")` -> `SettingsStore.loadSettings`; return path uses `UiStateStore.setActiveRoute` and conditional `GamesStore.resumeGame`.
- Private design: `GamesStore._maybeAutoPauseForMenu` -> `UiStateStore._rememberReturnRoute` -> `SettingsStore._loadStoredSnapshot`; return uses `Router._restoreReturnRoute` -> `GamesStore._resumeIfMenuOwnedPause`.
- UI surface coverage: `SettingsView` keeps category switching in a tab-style top strip, a secondary reset action area, and a primary bottom-right action row for `Cancel`, `Save`, and `Apply`.
- State/settings coverage: `session.autoPauseOnMenu` applies only to timed `liveGame + currentPosition + ongoing` contexts. The stored pause owner prevents settings return from auto-resuming a manually paused game or a game paused for another reason such as in-game analysis.
- Requirement verification: `Pass`. Auto-pause remains policy-driven, dirty-form prompts stay in `UiStateStore`, and return routing does not depend on a still-valid game always existing.

### SCN-NAV-02 - Invalid Game Route Handling
- Public flow: router guard -> `GamesStore.getGame` -> `GamesStore.listGames` -> `UiStateStore.setActiveGame`.
- Private design: `Router._validateGameRoute` -> `_selectFallbackRoute`; `UiStateStore._coerceActiveRoute`.
- Requirement verification: `Pass`. Unknown `/game/:id` routes are rejected before `GameView` binds to missing state.

### SCN-NAV-03 - Reopen Recent Game from Home
- Public flow: `RecentGameStore.loadRecentGames` -> `HomeView` recent selection -> `RecentGameStore.openRecentGame` -> `UiStateStore.openTab` -> `UiStateStore.setActiveGame`.
- Private design: `RecentGameStore._loadStoredSnapshot` -> `_sortMostRecentFirst`; `RecentGameStore._openAutosavedGame` uses `StorageAdapter.getGame` -> `GamesStore.insertGame`, while `RecentGameStore._openManualFileGame` uses `FileIoAdapter.loadGameFromPath` -> `GamesStore.insertGame`; stale-entry cleanup uses `RecentGameStore._dropStaleEntry`.
- UI surface coverage: `HomeView` keeps the centred primary action row and renders a recent games list below it only when recent entries exist. Selecting one recent entry reuses the normal restore pipeline for whichever backing source won the latest-save dedupe rule.
- Requirement verification: `Pass`. Recent selection stays optional, hidden when empty, autosave and manual-file entries share one deduped list, and stale references can be removed without breaking the centred home layout.
