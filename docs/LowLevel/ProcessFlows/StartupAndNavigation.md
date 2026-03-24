# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-03`.

### SCN-SESSION-01 - Fresh Launch with No Saved State
- Public flow: `SettingsStore.loadSettings` -> `SettingsStore.getAppearanceProjection` -> `UiStateStore.loadLayoutState` -> conditional `UiStateStore.loadGameSession` -> `GamesStore.restorePersistedGames` -> `RecentGameStore.loadRecentGames` -> router startup resolution.
- Private design: `SettingsStore._loadStoredSnapshot` -> `_migrateSnapshotOrDefault` -> `_resolveThemeMode` -> `_buildAppearanceProjection` -> `_subscribeToSystemThemeChanges`; `UiStateStore._loadStoredLayoutState` -> `_coerceLayoutState`; conditional `UiStateStore._loadStoredGameSession` -> `_coerceActiveRoute`; `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspaceCollection`; `RecentGameStore._loadStoredSnapshot` -> `_sortMostRecentFirst`; `Router._resolveStartupTarget`.
- UI surface coverage: startup lands on a centred `HomeView`, which exposes one single-row group of large square action buttons for quick new, custom new, load, and settings without auto-creating a workspace. Because this scenario starts with no persisted state, the recent games list remains hidden.
- Settings coverage: the initial appearance projection is resolved before the first routed screen binds to shared app chrome. When `appearance.themeMode = system`, the effective built-in theme comes from `SystemThemeAdapter` without writing a new settings snapshot.
- Requirement verification: `Pass`. Defaults load independently, bad absence is not treated as corruption, theme state is resolved before first render, and startup lands on a neutral route instead of auto-creating a game.

### SCN-SESSION-02 - Restore Previous Session
- Public flow: `SettingsStore.loadSettings` -> `SettingsStore.getAppearanceProjection` -> `UiStateStore.loadLayoutState` -> conditional `UiStateStore.loadGameSession` -> `GamesStore.restorePersistedGames(session.openGameIds)` -> `UiStateStore.setActiveGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> router restore.
- Private design: `UiStateStore._loadStoredLayoutState` -> `_coerceLayoutState`; conditional `UiStateStore._loadStoredGameSession` -> `_coerceOpenTabs` -> `_coerceActiveRoute`; `GamesStore._loadRequestedDocuments` -> `_hydrateWorkspace` -> `_repairMissingActiveGame`; `Router._restoreReturnRoute`.
- State/settings coverage: `session.restorePreviousSession` gates whether the stored game-session snapshot is used to reopen tabs and the active route. `UiStateStore.loadLayoutState` still runs independently so panel visibility and fold state can be restored even when the prior game session is skipped. When a game is restored, `analysis.resumeLiveAnalysisAfterRestore` gates whether continuous analysis restarts after the persisted game state is shown. The appearance projection is resolved before routed surfaces bind to app chrome, and later system-theme changes reproject appearance only when `appearance.themeMode = system`.
- Requirement verification: `Pass`. Game-session restore is isolated from settings and layout restore, respects the restore setting, resolves theme state before routed chrome binds, and repairs invalid `activeGameId` values for the selected open tab before routing.

### SCN-SESSION-03 - Startup with Corrupt Persisted Data
- Public flow: `SettingsStore.loadSettings` -> `UiStateStore.loadLayoutState` -> conditional `UiStateStore.loadGameSession` -> `RecentGameStore.loadRecentGames` -> `GamesStore.restorePersistedGames`.
- Private design: `SerializationService._parseJson` -> `_migrateBySchemaVersion`; `SettingsStore._migrateSnapshotOrDefault`; `UiStateStore._loadStoredLayoutState` -> `_resetInvalidLayoutState`; conditional `UiStateStore._loadStoredGameSession` -> `_resetInvalidGameSession`; `RecentGameStore._loadStoredSnapshot` -> `_resetCorruptSnapshot`; `GamesStore._skipCorruptDocument`; `StorageAdapter.removeGame` or repaired rewrite on the next save cycle.
- Requirement verification: `Pass`. Corrupt settings, game-session, UI-layout, recent-games, or game payloads fall back independently, and corrupt core game payloads are isolated instead of crashing startup.

### SCN-GAME-01 - Quick New Game from Menu
- Public flow: `GamesStore.createGame` -> `UiStateStore.openTab` -> `UiStateStore.setActiveGame` -> `UiStateStore.saveGameSession`.
- Private design: `GamesStore._buildDefaultCreateRequest` -> `_validateCreateRequest` -> `_createWorkspace` -> `_persistWorkspace`; `UiStateStore._coerceOpenTabs`.
- Requirement verification: `Pass`. The game becomes active immediately, and persistence failure can be surfaced without discarding the in-memory workspace.

### SCN-GAME-02 - Custom New Game with User Options
- Public flow: `UiStateStore.showModal({ kind: "newGame" })` -> `GamesStore.createGame` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> `UiStateStore.hideModal`.
- Private design: `GamesStore._validateCreateRequest` -> `_resolveWorkspaceKind` -> `_validateAssignedPlayers` -> `_validateAssignedEngines` -> `_initialiseClockSnapshot` -> `_seedAnalysisAssignment`.
- UI surface coverage: the custom creation flow uses `NewGameModal` inside the shared dialog shell, with named form sections, shared dialog-row create or cancel actions, and a live-game-only `Show Live Analysis Moves` toggle.
- State/settings coverage: any request with both sides assigned becomes a baseline `liveGame`, while any request with either side assigned `none` becomes `freeAnalysisSetup`. When the request creates a live game, it also captures the per-game `showLiveAnalysisMoves` choice. `_maybeRequestEngineTurn` is evaluated immediately after creation whenever the resulting live game starts on an engine-controlled side to move, including `engine/engine`.
- Requirement verification: `Pass`. Invalid time control or missing required engines are blocked before workspace creation, any partially or fully unassigned player request resolves into `freeAnalysisSetup`, and `engine/engine` reuses the same live engine-turn gate as any other engine-controlled start.

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility
- Public flow: `UiStateStore.setActiveGame` -> router tab navigation -> `GamesStore.getGame` -> `GamesStore.listGames`.
- Private design: `UiStateStore._coerceOpenTabs` -> `_coerceActiveRoute`; `Router._validateGameRoute` -> `_selectFallbackRoute`.
- Requirement verification: `Pass`. Tab visibility is derived from `openGameIds`, and invalid targets fall back deterministically.

### SCN-NAV-01 - Route to Settings and Back to Active Game
- Public flow: conditional `GamesStore.pauseGame` -> router redirect to `/settings/session` -> `UiStateStore.setActiveRoute("/settings/session")` -> `SettingsStore.loadSettings`; return path uses `UiStateStore.setActiveRoute` and conditional `GamesStore.resumeGame`.
- Private design: `GamesStore._maybeAutoPauseForMenu` -> `UiStateStore._rememberReturnRoute` -> `SettingsStore._loadStoredSnapshot`; return uses `Router._restoreReturnRoute` -> `GamesStore._resumeIfMenuOwnedPause`.
- UI surface coverage: `SettingsView` keeps category switching in a tab-style top strip, a secondary reset action area, and a primary bottom-right action row for `Cancel`, `Save`, and `Apply`.
- Route coverage: settings category tabs map to `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`, while invalid settings routes fall back to `/settings/session`.
- State/settings coverage: `session.autoPauseOnMenu` applies only to timed `liveGame + currentPosition + ongoing` contexts. The stored pause owner prevents settings return from auto-resuming a manually paused game or a game paused for another reason such as in-game analysis. Accepted appearance updates reproject the root semantic CSS variables immediately, and system-theme subscription updates remain active only while `appearance.themeMode = system`.
- Requirement verification: `Pass`. Auto-pause remains policy-driven, dirty-form prompts stay in `UiStateStore` through the typed `settingsDirtyLeave` modal contract, and return routing does not depend on a still-valid game always existing.

### SCN-NAV-02 - Invalid Game Route Handling
- Public flow: router guard -> `GamesStore.getGame` -> `GamesStore.listGames` -> `UiStateStore.setActiveGame`.
- Private design: `Router._validateGameRoute` -> `_selectFallbackRoute`; `UiStateStore._coerceActiveRoute`.
- Requirement verification: `Pass`. Unknown `/game/:id` routes are rejected before `GameView` binds to missing state.

### SCN-NAV-03 - Reopen Recent Game from Home
- Public flow: `RecentGameStore.loadRecentGames` -> `HomeView` recent selection -> `RecentGameStore.openRecentGame` -> `UiStateStore.openTab` -> `UiStateStore.setActiveGame`.
- Private design: `RecentGameStore._loadStoredSnapshot` -> `_sortMostRecentFirst`; `RecentGameStore._openAutosavedGame` uses `StorageAdapter.getGame` -> `GamesStore.insertGame`, while `RecentGameStore._openManualFileGame` uses `FileIoAdapter.loadGameFromPath` -> `GamesStore.insertGame`; stale-entry cleanup uses `RecentGameStore._dropStaleEntry`.
- UI surface coverage: `HomeView` keeps the centred primary action row and renders a recent games list below it only when recent entries exist. Selecting one recent entry reuses the normal restore pipeline for whichever backing source won the latest-save dedupe rule.
- Requirement verification: `Pass`. Recent selection stays optional, hidden when empty, autosave and manual-file entries share one deduped list, and stale references can be removed without breaking the centred home layout.

