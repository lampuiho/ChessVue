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
| `UserSettingService.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |
| `PlatformEventService.subscribeToSystemThemeChanged` |

| `SettingsStore.getSettings` |
| --- |
| `UserSettingService.getSettingsOrDefault` |
| `SettingsStore._syncAcceptedSettings` |
| `SettingsStore._syncDraftSettings` |

| `UiStateStore.getLayoutStateOrDefault` |
| --- |
| `SerializationService.readUiLayoutDocument` |
| `UiStateStore._coerceLayoutState` |

| `RecentGameStore.getRecentGames` |
| --- |
| `SerializationService.listManagedSaveEntries` |
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
| `UserSettingService.getSettingsOrDefault` |
| `SettingsStore._syncAcceptedSettings` |
| `SettingsStore._syncDraftSettings` |

| `UiStateStore.getGameSessionOrDefault` |
| --- |
| `SerializationService.readGameSessionDocument` |
| `UiStateStore._coerceOpenTabs` |
| `UiStateStore._coerceActiveRoute` |

#### Flow B - Restore The Routed Game Lazily
| `GameView.setup` |
| --- |
| `SavedGamesStore.restoreGames` |
| `GamesStore.insertGame` |
| `UiStateStore.setActiveGame` |

| `SavedGamesStore.restoreGames` |
| --- |
| `SerializationService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |
| `SavedGameIndexService.getLatestSaveEntryForGame` |
| `SerializationService.readGameDocument` |

| `GamesStore.insertGame` |
| --- |
| `GamesStore._repairDuplicateGameId` |
| `GamesStore._hydrateWorkspace` |

| `UiStateStore.setActiveGame` |
| --- |

#### Flow C - Resume Continuous Analysis After Restore
| `GameView._resumeVisibleAnalysisIfAllowed` |
| --- |
| `GamesStore.refreshAnalysis` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GamesStore._syncAnalysisPosition` |
| `GamesStore._registerAnalysisSubscription` |
| `GamesStore._startAnalysisSearch` |

| `GamesStore._syncAnalysisPosition` |
| --- |
| `EngineRuntimeService.syncPosition` |

| `GamesStore._registerAnalysisSubscription` |
| --- |
| `EngineRuntimeService.subscribeToAnalysis` |

| `GamesStore._startAnalysisSearch` |
| --- |
| `EngineRuntimeService.startAnalysis` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GamesStore._applyAnalysisUpdate` |

#### Flow D - Request Engine Turn After Restore
| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.requestPlayerMove` |
| `GamesStore._handlePlayerTurnMove` |

| `GamesStore.requestPlayerMove` |
| --- |
| `GamesStore._syncPlayerTurnPosition` |
| `GamesStore._startPlayerTurnSearch` |
| `GamesStore._awaitPlayerTurnMove` |

| `GamesStore._syncPlayerTurnPosition` |
| --- |
| `EngineRuntimeService.syncPosition` |

| `GamesStore._startPlayerTurnSearch` |
| --- |
| `EngineRuntimeService.startPlayerTurn` |

| `GamesStore._awaitPlayerTurnMove` |
| --- |
| `EngineRuntimeService.awaitPlayerTurnMove` |

| `GamesStore._handlePlayerTurnMove` |
| --- |
| `GamesStore.makeMove` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._resolveMoveContext` |
| `GamesStore._applyMoveByContext` |
| `GameView._requestPlayerMoveIfNeeded` |

- State/settings coverage: `gameSession.restorePreviousSession` is the gate for reusing the stored game-session snapshot and active route, but the read happens lazily from `HomeView.setup` rather than a startup bootstrap. Because session restore depends on prior tabs being reopenable, accepted settings coerce `gameSession.autosaveOnClose = true` whenever `gameSession.restorePreviousSession = true`. When the restored route resolves to a game, `GameView.setup` lazily restores only the requested remembered `gameId` values from that session snapshot, asks `SavedGamesStore.restoreGames(...)` for the latest available managed save payload for each one, then feeds each payload into `GamesStore.insertGame(...)`. `analysis.resumeLiveAnalysisAfterRestore` still gates whether continuous analysis restarts after the restored game state is visible.
- Restore ownership coverage: `SerializationService.deserialiseGame` validates the canonical persisted shape and selector paths only. `SavedGamesStore.restoreGames(...)` owns restore lookup and document reads, while `GamesStore.insertGame(...)` rebuilds `$.parent` and resolves the current hydrated live or visible nodes before any node-based runtime interaction can resume.
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
| `UserSettingService.getSystemTheme` |
| `SettingsStore._buildAppearanceProjection` |

| `SettingsStore.getSettings` |
| --- |
| `UserSettingService.getSettingsOrDefault` |

| `UserSettingService.getSettingsOrDefault` |
| --- |
| `SerializationService.readSettingsDocument` |
| `UserSettingService._createDefaultSettingsSnapshot` |
| `UserSettingService._cacheAcceptedSettings` |

| `UiStateStore.getLayoutStateOrDefault` |
| --- |
| `SerializationService.readUiLayoutDocument` |
| `UiStateStore._resetInvalidLayoutState` |

| `UiStateStore.getGameSessionOrDefault` |
| --- |
| `SerializationService.readGameSessionDocument` |
| `UiStateStore._resetInvalidGameSession` |

| `RecentGameStore.getRecentGames` |
| --- |
| `SerializationService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |
| `RecentGameStore._skipInvalidRecentTarget` |

#### Flow B - Corrupt Restored Game Payload
| `GameView.setup` |
| --- |
| `SavedGamesStore.restoreGames` |

| `SavedGamesStore.restoreGames` |
| --- |
| `SavedGameIndexService.getLatestSaveEntryForGame` |
| `SerializationService.readGameDocument` |
| `SavedGamesStore._skipCorruptDocument` |

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

| `UiStateStore.openTab` |
| --- |
| `UiStateStore._coerceOpenTabs` |

| `UiStateStore.setActiveGame` |
| --- |

| `UiStateStore.saveGameSession` |
| --- |
| `SerializationService.writeGameSessionDocument` |

- Requirement verification: `Pass`. The game becomes active immediately, and session-route persistence remains decoupled from workspace creation.

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
| `GamesStore._resolveInitialGameState` |
| `GamesStore._validateAssignedPlayers` |
| `GamesStore._validateAssignedEngines` |
| `GamesStore._initialiseClockSnapshot` |
| `GamesStore._seedAnalysisAssignment` |

| `UiStateStore.hideModal` |
| --- |

#### Flow B - Start Continuous Analysis For The New Workspace
| `NewGameModal.createRequested` |
| --- |
| `GamesStore.refreshAnalysis` |

| `GamesStore.refreshAnalysis` |
| --- |
| `GamesStore._syncAnalysisPosition` |
| `GamesStore._registerAnalysisSubscription` |
| `GamesStore._startAnalysisSearch` |

| `GameView._handleAnalysisRuntimeUpdate` |
| --- |
| `GamesStore._applyAnalysisUpdate` |

#### Flow C - Request The Opening Engine Turn
| `GameView._requestPlayerMoveIfNeeded` |
| --- |
| `GamesStore.getGame` |
| `GamesStore.requestPlayerMove` |
| `GamesStore._handlePlayerTurnMove` |

| `GamesStore.requestPlayerMove` |
| --- |
| `GamesStore._syncPlayerTurnPosition` |
| `GamesStore._startPlayerTurnSearch` |
| `GamesStore._awaitPlayerTurnMove` |

| `GamesStore._handlePlayerTurnMove` |
| --- |
| `GamesStore.makeMove` |

| `GamesStore.makeMove` |
| --- |
| `GamesStore._assertMoveAllowed` |
| `GamesStore._resolveMoveContext` |
| `GamesStore._applyMoveByContext` |
| `GameView._requestPlayerMoveIfNeeded` |

- UI surface coverage: the custom creation flow uses `NewGameModal` inside the shared dialog shell, with named form sections, shared dialog-row create or cancel actions, and a live-game-only `Show Live Analysis Moves` toggle.
- State/settings coverage: any request with both sides assigned becomes a live state, while any request with either side unassigned becomes a non-live analysis state. At the low-level request boundary, that unassigned state is encoded by omitting the relevant player-type or engine-id field. When the request creates a live game, it also captures the per-game `showLiveAnalysisMoves` choice. `GameView._requestPlayerMoveIfNeeded` is evaluated immediately after creation whenever the resulting live game starts on an active non-local side to move, including `PlayerType.Engine/PlayerType.Engine`.
- Requirement verification: `Pass`. Invalid time control or missing required engines are blocked before workspace creation, any partially or fully unassigned player request resolves into non-live analysis, and `PlayerType.Engine/PlayerType.Engine` reuses the same live engine-turn gate as any other engine-controlled start.

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
| `UserSettingService.getSettingsOrDefault` |

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
- State/settings coverage: `gameSession.autoPauseOnMenu` applies only to timed `LiveWhiteTurn` and `LiveBlackTurn` contexts with `resultState = ongoing`. The stored pause owner prevents settings return from auto-resuming a manually paused game or a game paused for another reason such as live analysis. While that menu-owned pause is active, the game surface is interaction-locked and any player-engine move that becomes ready remains deferred until the return path revalidates it. Accepted appearance updates reproject the root semantic CSS variables immediately, and system-theme subscription updates remain active only while `appearance.themeMode = ThemeMode.System`.
- Requirement verification: `Pass`. Auto-pause remains policy-driven, dirty-form prompts stay in `UiStateStore` through the typed `AppModalKind.SettingsDirtyLeave` modal contract, the paused game surface stays inert during the interruption, and return routing does not depend on a still-valid game always existing.

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
| `SavedGamesStore.loadRecentGame` |
| `GamesStore.insertGame` |
| `UiStateStore.openTab` |
| `UiStateStore.setActiveGame` |

| `SavedGamesStore.loadRecentGame` |
| --- |
| `SavedGamesStore._resolveRecentTarget` |
| `SerializationService.readGameDocument` |

| `GamesStore.insertGame` |
| --- |
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
| `SavedGamesStore.loadRecentGame` |
| `GamesStore.insertGame` |
| `UiStateStore.openTab` |
| `UiStateStore.setActiveGame` |

| `SavedGamesStore.loadRecentGame` |
| --- |
| `SavedGamesStore._resolveRecentTarget` |
| `SerializationService.readGameDocument` |

| `GamesStore.insertGame` |
| --- |
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
- Ownership coverage: `SavedGamesStore` owns recent-target resolution and saved-document load, `GamesStore.insertGame(...)` owns turning that payload into the live session workspace, and `RecentGameStore` remains limited to on-demand recent-list projection.
- Requirement verification: `Pass`. Recent selection stays optional, hidden when empty, autosave and manual-file entries share one deduped list, and stale references disappear on the next recent-list query without needing eager cleanup writes.



