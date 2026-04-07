# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-03`.

### SCN-SESSION-01 - Fresh Launch with No Saved State

#### Flow
| `AppBootstrap.start` |
| --- |
| `SettingsStore.loadSettings` |
| `SettingsStore.getAppearanceProjection` |
| `UiStateStore.loadLayoutState` |
| `GamesStore.restorePersistedGames` |
| `RecentGameStore.loadRecentGames` |
| `Router._resolveStartupTarget` |

| `SettingsStore.loadSettings` |
| --- |
| `UserSettingSerivce.loadSettings` |
| `SettingsStore._syncAcceptedSettings` |
| `SettingsStore._syncDraftSettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |
| `PlatformEventService.subscribeToSystemThemeChanged` |

| `SettingsStore.getAppearanceProjection` |
| --- |

| `UiStateStore.loadLayoutState` |
| --- |
| `UiStateStore._loadStoredLayoutState` |
| `UiStateStore._coerceLayoutState` |

| `GamesStore.restorePersistedGames` |
| --- |
| `GamesStore._loadRequestedDocuments` |
| `GamesStore._hydrateWorkspaceCollection` |

| `RecentGameStore.loadRecentGames` |
| --- |
| `RecentGameStore._loadStoredSnapshot` |
| `RecentGameStore._sortMostRecentFirst` |

- UI surface coverage: startup lands on a centred `HomeView`, which exposes one single-row group of large square action buttons for quick new, custom new, load, and settings without auto-creating a workspace. Because this scenario starts with no saved games, the recent games list remains hidden.
- Settings coverage: the initial appearance projection is resolved before the first routed screen binds to shared app chrome. When `appearance.themeMode = ThemeMode.System`, the effective built-in theme comes from the layer-2 theme-resolution path without writing a new settings snapshot. Startup falls back to `/home` whenever prior session restore is disabled, absent, corrupt, or otherwise invalid.
- Requirement verification: `Pass`. Defaults load independently, bad absence is not treated as corruption, theme state is resolved before first render, and startup lands on `/home` instead of auto-creating a game.

### SCN-SESSION-02 - Restore Previous Session

#### Flow A - Restore Saved Tabs And Route
| `AppBootstrap.start` |
| --- |
| `SettingsStore.loadSettings` |
| `SettingsStore.getAppearanceProjection` |
| `UiStateStore.loadLayoutState` |
| `UiStateStore.loadGameSession` |
| `GamesStore.restorePersistedGames` |
| `UiStateStore.setActiveGame` |
| `Router._restoreReturnRoute` |

| `SettingsStore.loadSettings` |
| --- |
| `UserSettingSerivce.loadSettings` |
| `SettingsStore._syncAcceptedSettings` |
| `SettingsStore._syncDraftSettings` |
| `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |
| `PlatformEventService.subscribeToSystemThemeChanged` |

| `SettingsStore.getAppearanceProjection` |
| --- |

| `UiStateStore.loadLayoutState` |
| --- |
| `UiStateStore._loadStoredLayoutState` |
| `UiStateStore._coerceLayoutState` |

| `UiStateStore.loadGameSession` |
| --- |
| `UiStateStore._loadStoredGameSession` |
| `UiStateStore._coerceOpenTabs` |
| `UiStateStore._coerceActiveRoute` |

| `GamesStore.restorePersistedGames` |
| --- |
| `GamesStore._loadRequestedDocuments` |
| `GamesStore._hydrateWorkspace` |
| `GamesStore._repairMissingActiveGame` |

| `UiStateStore.setActiveGame` |
| --- |

#### Flow B - Resume Continuous Analysis After Restore
| `AppBootstrap._resumeVisibleAnalysisIfAllowed` |
| --- |
| `EnginesStore.startAnalysis` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |

| `AppBootstrap._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

#### Flow C - Request Engine Turn After Restore
| `AppBootstrap._requestOpeningEngineTurnIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startPlayerTurn` |
| `EnginesStore._handlePlayerTurnMove` |

| `EnginesStore.startPlayerTurn` |
| --- |
| `EnginesStore._startPlayerTurnSearch` |
| `EnginesStore._bindPlayerTurnCallbacks` |

| `EnginesStore._handlePlayerTurnMove` |
| --- |
| `GamesStore.makeMove` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._resolveMoveContext` |
| `GamesStore._applyMoveByContext` |
| `GamesStore._persistWorkspaceIfNeeded` |
| `AppBootstrap._requestOpeningEngineTurnIfNeeded` |

- State/settings coverage: `session.restorePreviousSession` is the only startup gate for reopening the stored game-session snapshot and active route. If that gate is false, or if the stored session no longer resolves to a valid route, startup falls back to `/home`. `UiStateStore.loadLayoutState` still runs independently so panel visibility and fold state can be restored even when the prior game session is skipped. When a game is restored, `analysis.resumeLiveAnalysisAfterRestore` gates whether continuous analysis restarts after the persisted game state is shown. The appearance projection is resolved before routed surfaces bind to app chrome, and later system-theme changes reproject appearance only when `appearance.themeMode = ThemeMode.System`.
- Requirement verification: `Pass`. Game-session restore is isolated from settings and layout restore, respects the restore setting, resolves theme state before routed chrome binds, repairs invalid `activeGameId` values for the selected open tab before routing, and falls back deterministically to `/home` when restore cannot succeed.

### SCN-SESSION-03 - Startup with Corrupt Persisted Data

#### Flow
| `AppBootstrap.start` |
| --- |
| `SettingsStore.loadSettings` |
| `UiStateStore.loadLayoutState` |
| `UiStateStore.loadGameSession` |
| `RecentGameStore.loadRecentGames` |
| `GamesStore.restorePersistedGames` |

| `SettingsStore.loadSettings` |
| --- |
| `UserSettingSerivce.loadSettings` |

| `UserSettingSerivce.loadSettings` |
| --- |
| `SerializationService._parseJson` |
| `SerializationService._migrateBySchemaVersion` |
| `UserSettingSerivce._migrateSnapshotOrDefault` |
| `UserSettingSerivce._cacheAcceptedSettings` |

| `UiStateStore.loadLayoutState` |
| --- |
| `UiStateStore._loadStoredLayoutState` |
| `UiStateStore._resetInvalidLayoutState` |

| `UiStateStore.loadGameSession` |
| --- |
| `UiStateStore._loadStoredGameSession` |
| `UiStateStore._resetInvalidGameSession` |

| `RecentGameStore.loadRecentGames` |
| --- |
| `RecentGameStore._loadStoredSnapshot` |
| `RecentGameStore._resetCorruptSnapshot` |

| `GamesStore.restorePersistedGames` |
| --- |
| `GamesStore._loadRequestedDocuments` |
| `GamesStore._skipCorruptDocument` |

- Requirement verification: `Pass`. Corrupt settings, game-session, UI-layout, recent-games, or game payloads fall back independently, and corrupt core game payloads are isolated instead of crashing startup.

### SCN-GAME-01 - Quick New Game from Menu

#### Flow
| `MenuBar.quickNewGameRequested` |
| --- |
| `GamesStore.createGame` |
| `UiStateStore.openTab` |
| `UiStateStore.setActiveGame` |
| `UiStateStore.saveGameSession` |

| `GamesStore.createGame` |
| --- |
| `GamesStore._buildDefaultCreateRequest` |
| `GamesStore._validateCreateRequest` |
| `GamesStore._createWorkspace` |
| `GamesStore._persistWorkspace` |

| `UiStateStore.openTab` |
| --- |
| `UiStateStore._coerceOpenTabs` |

| `UiStateStore.setActiveGame` |
| --- |

| `UiStateStore.saveGameSession` |
| --- |
| `UiStateStore._saveGameSessionSnapshot` |

- Requirement verification: `Pass`. The game becomes active immediately, and persistence failure can be surfaced without discarding the in-memory workspace.

### SCN-GAME-02 - Custom New Game with User Options

#### Flow A - Create The Requested Workspace
| `NewGameModal.createRequested` |
| --- |
| `UiStateStore.showModal` |
| `GamesStore.createGame` |
| `UiStateStore.hideModal` |

| `UiStateStore.showModal` |
| --- |

| `GamesStore.createGame` |
| --- |
| `GamesStore._validateCreateRequest` |
| `GamesStore._resolveWorkspaceKind` |
| `GamesStore._validateAssignedPlayers` |
| `GamesStore._validateAssignedEngines` |
| `GamesStore._initialiseClockSnapshot` |
| `GamesStore._seedAnalysisAssignment` |

| `UiStateStore.hideModal` |
| --- |

#### Flow B - Start Continuous Analysis For The New Workspace
| `NewGameModal.createRequested` |
| --- |
| `EnginesStore.startAnalysis` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

#### Flow C - Request The Opening Engine Turn
| `GameView._requestEngineTurnIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `EnginesStore.startPlayerTurn` |
| `EnginesStore._handlePlayerTurnMove` |

| `EnginesStore.startPlayerTurn` |
| --- |
| `EnginesStore._startPlayerTurnSearch` |
| `EnginesStore._bindPlayerTurnCallbacks` |

| `EnginesStore._handlePlayerTurnMove` |
| --- |
| `GamesStore.makeMove` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._resolveMoveContext` |
| `GamesStore._applyMoveByContext` |
| `GamesStore._persistWorkspaceIfNeeded` |
| `GameView._requestEngineTurnIfNeeded` |

- UI surface coverage: the custom creation flow uses `NewGameModal` inside the shared dialog shell, with named form sections, shared dialog-row create or cancel actions, and a live-game-only `Show Live Analysis Moves` toggle.
- State/settings coverage: any request with both sides assigned becomes a baseline `WorkspaceKind.LiveGame`, while any request with either side assigned `PlayerType.None` becomes `WorkspaceKind.FreeAnalysisSetup`. When the request creates a live game, it also captures the per-game `showLiveAnalysisMoves` choice. `GameView._requestEngineTurnIfNeeded` is evaluated immediately after creation whenever the resulting live game starts on an engine-controlled side to move, including `PlayerType.Engine/PlayerType.Engine`.
- Requirement verification: `Pass`. Invalid time control or missing required engines are blocked before workspace creation, any partially or fully unassigned player request resolves into `WorkspaceKind.FreeAnalysisSetup`, and `PlayerType.Engine/PlayerType.Engine` reuses the same live engine-turn gate as any other engine-controlled start.

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility

#### Flow
| `GameTabs.tabSelected` |
| --- |
| `UiStateStore.setActiveGame` |
| `Router.navigateToGame` |
| `GamesStore.getGame` |
| `GamesStore.listGames` |
| `Router._validateGameRoute` |
| `Router._selectFallbackRoute` |

| `UiStateStore.setActiveGame` |
| --- |
| `UiStateStore._coerceOpenTabs` |
| `UiStateStore._coerceActiveRoute` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.listGames` |
| --- |

- Requirement verification: `Pass`. Tab visibility is derived from `openGameIds`, and invalid targets fall back deterministically.

### SCN-NAV-01 - Route to Settings and Back to Active Game

#### Flow A - Enter Settings
| `MenuBar.settingsRequested` |
| --- |
| `GamesStore.pauseGame` |
| `Router.navigateToSettings` |
| `UiStateStore.setActiveRoute` |
| `SettingsStore.loadSettings` |

| `GamesStore.pauseGame` |
| --- |
| `GamesStore._maybeAutoPauseForMenu` |
| `GamesStore._markPauseOwner` |

| `UiStateStore.setActiveRoute` |
| --- |
| `UiStateStore._rememberReturnRoute` |

| `SettingsStore.loadSettings` |
| --- |
| `UserSettingSerivce.loadSettings` |

#### Flow B - Leave Settings And Return
| `SettingsView.returnRequested` |
| --- |
| `UiStateStore.setActiveRoute` |
| `Router._restoreReturnRoute` |
| `GamesStore.resumeGame` |

| `UiStateStore.setActiveRoute` |
| --- |
| `UiStateStore._coerceActiveRoute` |

| `GamesStore.resumeGame` |
| --- |
| `GamesStore._assertResumable` |
| `GamesStore._resumeClock` |
| `GameView._resumeIfMenuOwnedPause` |

- UI surface coverage: `SettingsView` keeps category switching in a tab-style top strip, a secondary reset action area, and a primary bottom-right action row for `Cancel`, `Save`, and `Apply`.
- Route coverage: settings category tabs map to `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`, while invalid settings routes fall back to `/settings/session`.
- State/settings coverage: `session.autoPauseOnMenu` applies only to timed `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition + ResultState.Ongoing` contexts. The stored pause owner prevents settings return from auto-resuming a manually paused game or a game paused for another reason such as in-game analysis. Accepted appearance updates reproject the root semantic CSS variables immediately, and system-theme subscription updates remain active only while `appearance.themeMode = ThemeMode.System`.
- Requirement verification: `Pass`. Auto-pause remains policy-driven, dirty-form prompts stay in `UiStateStore` through the typed `AppModalKind.SettingsDirtyLeave` modal contract, and return routing does not depend on a still-valid game always existing.

### SCN-NAV-02 - Invalid Game Route Handling

#### Flow
| `Router.gameRouteGuard` |
| --- |
| `Router._validateGameRoute` |
| `GamesStore.getGame` |
| `GamesStore.listGames` |
| `Router._selectFallbackRoute` |
| `UiStateStore.setActiveGame` |

| `GamesStore.getGame` |
| --- |

| `GamesStore.listGames` |
| --- |

| `UiStateStore.setActiveGame` |
| --- |
| `UiStateStore._coerceActiveRoute` |

- Requirement verification: `Pass`. Unknown `/game/:id` routes are rejected before `GameView` binds to missing state.

### SCN-NAV-03 - Reopen Recent Game from Home

#### Flow A - Reopen An Autosaved Recent Game
| `HomeView.onRecentGameSelected` |
| --- |
| `SavedGamesStore.getRecentGamePath` |
| `GamesStore.loadGame` |
| `UiStateStore.openTab` |
| `UiStateStore.setActiveGame` |

| `SavedGamesStore.getRecentGamePath` |
| --- |
| `SavedGamesStore._resolveRecentTarget` |
| `SavedGameIndexService.getAutosaveFilePath` |

| `GamesStore.loadGame` |
| --- |
| `GamesStore._readSavedGameDocument` |
| `SerializationService.deserialiseGame` |
| `GamesStore._remapDuplicateIdIfNeeded` |
| `GamesStore._hydrateWorkspace` |

| `UiStateStore.openTab` |
| --- |
| `UiStateStore._coerceOpenTabs` |

| `UiStateStore.setActiveGame` |
| --- |
| `UiStateStore._coerceActiveRoute` |

#### Flow B - Reopen A Saved-File Recent Game
| `HomeView.onRecentGameSelected` |
| --- |
| `SavedGamesStore.getRecentGamePath` |
| `GamesStore.loadGame` |
| `UiStateStore.openTab` |
| `UiStateStore.setActiveGame` |

| `SavedGamesStore.getRecentGamePath` |
| --- |
| `SavedGamesStore._resolveRecentTarget` |

| `GamesStore.loadGame` |
| --- |
| `GamesStore._readSavedGameDocument` |
| `SerializationService.deserialiseGame` |
| `GamesStore._remapDuplicateIdIfNeeded` |
| `GamesStore._hydrateWorkspace` |

| `UiStateStore.openTab` |
| --- |
| `UiStateStore._coerceOpenTabs` |

| `UiStateStore.setActiveGame` |
| --- |
| `UiStateStore._coerceActiveRoute` |

#### Flow C - Remove A Stale Recent Entry
| `HomeView.onRecentGameSelected` |
| --- |
| `RecentGameStore.loadRecentGames` |

- UI surface coverage: `HomeView` keeps the centred primary action row and renders a recent games list below it only when recent entries exist. Selecting one recent entry reuses the normal restore pipeline for whichever backing source won the latest-save dedupe rule.
- Ownership coverage: `SavedGamesStore` owns recent-target path resolution, `GamesStore` owns loading that saved file into the live session, and `RecentGameStore` remains limited to on-demand recent-list projection.
- Requirement verification: `Pass`. Recent selection stays optional, hidden when empty, autosave and manual-file entries share one deduped list, and stale references disappear on the next recent-list query without needing eager cleanup writes.


