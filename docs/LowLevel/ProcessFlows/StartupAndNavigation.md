# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-03`.

### SCN-SESSION-01 - Fresh Launch with No Saved State

#### Flow A - Home Route Setup
| `HomeView.setup` |
| --- |
| `SettingsStore.getAppearanceProjection` |
| `UiStateStore.getLayoutStateOrDefault` |
| `RecentGameStore.getRecentGames` |

| `SettingsStore.getAppearanceProjection` |
| --- |
| `SettingsStore.getSettings` |
| `SettingsStore._resolveThemeMode` |
| `UserSettingSerivce.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |
| `PlatformEventService.subscribeToSystemThemeChanged` |

| `SettingsStore.getSettings` |
| --- |
| `UserSettingSerivce.getSettingsOrDefault` |
| `SettingsStore._syncAcceptedSettings` |
| `SettingsStore._syncDraftSettings` |

| `UiStateStore.getLayoutStateOrDefault` |
| --- |
| `SessionStateService.getLayoutStateOrDefault` |
| `UiStateStore._coerceLayoutState` |

| `RecentGameStore.getRecentGames` |
| --- |
| `SavedGameDocumentService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |
| `RecentGameStore._projectRecentEntries` |
| `RecentGameStore._sortMostRecentFirst` |

- UI surface coverage: startup lands on a centred `HomeView`, which exposes one single-row group of large square action buttons for quick new, custom new, load, and settings without auto-creating a workspace. Because this scenario starts with no saved games, the recent games list remains hidden.
- State/settings coverage: there is no eager bootstrap hydration phase. `HomeView.setup` uses the same lazy read path regardless of whether backing files exist; missing files simply resolve to defaults or empty projections. When `appearance.themeMode = ThemeMode.System`, the effective built-in theme comes from the layer-2 theme-resolution path without writing a new settings snapshot.
- Requirement verification: `Pass`. Fresh launch uses the same route and setup path as any other home-screen entry, theme and layout are resolved only when needed, and an empty install still lands on `/home` without special-case bootstrap logic.

### SCN-SESSION-02 - Restore Previous Session

#### Flow A - Restore Saved Tabs And Route
| `HomeView.setup` |
| --- |
| `SettingsStore.getSettings` |
| `UiStateStore.getGameSessionOrDefault` |
| `Router._restoreReturnRoute` |

| `SettingsStore.getSettings` |
| --- |
| `UserSettingSerivce.getSettingsOrDefault` |
| `SettingsStore._syncAcceptedSettings` |
| `SettingsStore._syncDraftSettings` |

| `UiStateStore.getGameSessionOrDefault` |
| --- |
| `SessionStateService.getGameSessionOrDefault` |
| `UiStateStore._coerceOpenTabs` |
| `UiStateStore._coerceActiveRoute` |

#### Flow B - Restore The Routed Game Lazily
| `GameView.setup` |
| --- |
| `GamesStore.restorePersistedGames` |
| `UiStateStore.setActiveGame` |

| `GamesStore.restorePersistedGames` |
| --- |
| `SavedGameDocumentService.readDocument` |
| `SerializationService.deserialiseGame` |
| `GamesStore._hydrateWorkspace` |
| `GamesStore._repairMissingActiveGame` |

| `UiStateStore.setActiveGame` |
| --- |

#### Flow C - Resume Continuous Analysis After Restore
| `GameView._resumeVisibleAnalysisIfAllowed` |
| --- |
| `EnginesStore.startAnalysis` |

| `EnginesStore.startAnalysis` |
| --- |
| `EnginesStore._startAnalysisSessions` |
| `EnginesStore._bindAnalysisCallbacks` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `AnalysisStore.applyAnalysisUpdate` |

#### Flow D - Request Engine Turn After Restore
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

- State/settings coverage: `session.restorePreviousSession` is the gate for reusing the stored game-session snapshot and active route, but the read happens lazily from `HomeView.setup` rather than a startup bootstrap. When the restored route resolves to a game, `GameView.setup` lazily restores only the needed persisted game data. `analysis.resumeLiveAnalysisAfterRestore` still gates whether continuous analysis restarts after the restored game state is visible.
- Requirement verification: `Pass`. Session restore is lazy, route-driven, respects the restore setting, repairs invalid `activeGameId` values before the game view binds, and falls back deterministically to `/home` when restore cannot succeed.

### SCN-SESSION-03 - Startup with Corrupt Persisted Data

#### Flow A - Home Route Setup With Corrupt Optional Data
| `HomeView.setup` |
| --- |
| `SettingsStore.getAppearanceProjection` |
| `UiStateStore.getLayoutStateOrDefault` |
| `UiStateStore.getGameSessionOrDefault` |
| `RecentGameStore.getRecentGames` |

| `SettingsStore.getAppearanceProjection` |
| --- |
| `SettingsStore.getSettings` |
| `SettingsStore._resolveThemeMode` |
| `UserSettingSerivce.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |

| `SettingsStore.getSettings` |
| --- |
| `UserSettingSerivce.getSettingsOrDefault` |

| `UserSettingSerivce.getSettingsOrDefault` |
| --- |
| `SerializationService._parseJson` |
| `SerializationService._migrateBySchemaVersion` |
| `UserSettingSerivce._migrateSnapshotOrDefault` |
| `UserSettingSerivce._cacheAcceptedSettings` |

| `UiStateStore.getLayoutStateOrDefault` |
| --- |
| `SessionStateService.getLayoutStateOrDefault` |
| `UiStateStore._resetInvalidLayoutState` |

| `UiStateStore.getGameSessionOrDefault` |
| --- |
| `SessionStateService.getGameSessionOrDefault` |
| `UiStateStore._resetInvalidGameSession` |

| `RecentGameStore.getRecentGames` |
| --- |
| `SavedGameDocumentService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |
| `RecentGameStore._skipInvalidRecentTarget` |

#### Flow B - Corrupt Restored Game Payload
| `GameView.setup` |
| --- |
| `GamesStore.restorePersistedGames` |

| `GamesStore.restorePersistedGames` |
| --- |
| `SavedGameDocumentService.readDocument` |
| `SerializationService.deserialiseGame` |
| `GamesStore._skipCorruptDocument` |

- Requirement verification: `Pass`. Corrupt settings, game-session, UI-layout, recent-save targets, or game payloads fall back independently through lazy reads, and corrupt core game payloads are isolated instead of crashing app entry.

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
| `SessionStateService.saveGameSession` |

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
- State/settings coverage: any request with both sides assigned becomes a baseline `WorkspaceKind.LiveGame`, while any request with either side unassigned becomes `WorkspaceKind.FreeAnalysisSetup`. At the low-level request boundary, that unassigned state is encoded as `null`. When the request creates a live game, it also captures the per-game `showLiveAnalysisMoves` choice. `GameView._requestEngineTurnIfNeeded` is evaluated immediately after creation whenever the resulting live game starts on an engine-controlled side to move, including `PlayerType.Engine/PlayerType.Engine`.
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
| `SettingsView.setup` |

| `GamesStore.pauseGame` |
| --- |
| `GamesStore._maybeAutoPauseForMenu` |
| `GamesStore._markPauseOwner` |

| `UiStateStore.setActiveRoute` |
| --- |
| `UiStateStore._rememberReturnRoute` |

| `SettingsView.setup` |
| --- |
| `SettingsStore.getSettings` |

| `SettingsStore.getSettings` |
| --- |
| `UserSettingSerivce.getSettingsOrDefault` |

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
| `SavedGameDocumentService.readDocument` |
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
| `SavedGameDocumentService.readDocument` |
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
| `RecentGameStore.getRecentGames` |

- UI surface coverage: `HomeView` keeps the centred primary action row and renders a recent games list below it only when recent entries exist. Selecting one recent entry reuses the normal restore pipeline for whichever backing source won the latest-save dedupe rule.
- Ownership coverage: `SavedGamesStore` owns recent-target path resolution, `GamesStore` owns loading that saved file into the live session, and `RecentGameStore` remains limited to on-demand recent-list projection.
- Requirement verification: `Pass`. Recent selection stays optional, hidden when empty, autosave and manual-file entries share one deduped list, and stale references disappear on the next recent-list query without needing eager cleanup writes.



