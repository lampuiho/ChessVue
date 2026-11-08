# Startup And Navigation Flows

## Scope
This document covers `SCN-SESSION-01` to `SCN-NAV-03` together with the shared shell flows they depend on: application bootstrap, platform selection, the session route checkpoint, the navigation frame and the game menu interruption boundary.

Storage calls are written against `IStorageAdapter`; their NW.js and browser implementations diverge only below that interface and are expanded in [Platform Storage Branches](PersistenceAndAdministration.md#platform-storage-branches). Engine-turn and analysis expansion after a game is inserted lives in [GameplayAndControl.md](GameplayAndControl.md), [AnalysisAndSetup.md](AnalysisAndSetup.md) and [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md). Route shape and view ownership are described in [Router](../Architecture/Presentation/Router.md) and the [view documents](../Architecture/Presentation/Views/index.md).

## Shared Startup And Shell Flows

### Bootstrap

#### Flow A - Create And Mount The Application
| `main.ts` bootstrap |
| --- |
| `createApp(App)` |
| `app.use(createPinia())` |
| `app.use(router)` |
| `app.mount('#app')` |

| `App` setup |
| --- |
| `useModalProvider` |
| `App._applyAppearance` |
| `onMounted(App startup callback)` |
| `router.afterEach(App route checkpoint)` |
| `onScopeDispose(removeRouteCheckpoint)` |

| `App._applyAppearance` |
| --- |
| `SettingsStore.appearanceProjection` |
| `App._applyThemeProfile` (light profile) |
| `App._applyThemeProfile` (dark profile) |

- `App` renders only a loading mark until `startupComplete`, `settings`, `gameSession` and `layoutState` all exist, so no route component mounts before the startup callback below has finished. The first `_applyAppearance` call runs during setup with `defaultLightThemeProfile`, `defaultDarkThemeProfile` and `ThemeMode.System`, so the loading surface is already themed.
- `_applyAppearance` writes both `--theme-light-*` and `--theme-dark-*` variable banks, the three root font-size variables from `appearance.uiScalePercent`, `data-theme-mode`, `data-app-mode` (true only for the NW.js target) and the `color-scheme` and `theme-color` meta tags. CSS `color-scheme` and `light-dark()` select the bank in system mode; neither `App` nor `SettingsStore` queries or subscribes to the host theme. The rationale for replacing the earlier appearance `watchEffect` with explicit calls is recorded in the [watcher disposition](../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition).

#### Flow B - Select The Platform Service
| `PlatformService.ts` `usePlatformService` initialiser |
| --- |
| `getPlatformTarget` |
| `defineNwjsPlatformServiceStore(getNwjs())` (NW.js target) |

| `PlatformService.ts` `usePlatformService` initialiser |
| --- |
| `getPlatformTarget` |
| `useBrowserPlatformService` (browser target) |

- `getPlatformTarget` returns the build-time `__CHESSVUE_PLATFORM__` value when `CHESSVUE_PLATFORM` is `nwjs` or `browser`; with the default `auto` it selects NW.js only when a real or injected `nw.Window` exists. The selection happens once at module evaluation; every layer-2 service then calls `usePlatformService()` to reach the single Pinia platform store.
- The NW.js store composes `NwjsStorageAdapter`, `NwjsSystemThemeAdapter` and two `NwjsProcessManager` instances (`EngineClientType.Uci` with `NwjsUciEngineClient`, `EngineClientType.UciWorker` with `BrowserUciEngineClient`). The browser store composes `BrowserStorageAdapter` over `BrowserFileSystem`, `BrowserSystemThemeAdapter` and `BrowserProcessManager` for `EngineClientType.UciWorker` only. The browser build is the GitHub Pages deployment. There is no packaged NW.js build: `npm run desktop` runs NW.js against a loopback Vite development server, and `auto` detection selects the NW.js store.

### Application Startup

#### Flow A - Load, Restore And Checkpoint
| `App` startup callback (`onMounted`) |
| --- |
| `SettingsStore.loadSettings` |
| `UiStateStore.loadGameSession` |
| `UiStateStore.loadLayoutState` |
| `App._applyAppearance` |
| `App._restoreWorkspace` |
| `SavedGamesStore.registerAutosaveOnClose` |
| `UiStateStore.setActiveGame` or `UiStateStore.setActiveRoute` |
| `App._saveSession` |

| `SettingsStore.loadSettings` |
| --- |
| `UserSettingService.getSettingsOrDefault` |
| `UserSettingService.getLoadWarning` |
| `SettingsStore._acceptSettings` |

| `UserSettingService.getSettingsOrDefault` |
| --- |
| `UserSettingService._readSettingsDocument` |
| `UserSettingService._cacheAcceptedSettings` |

| `UserSettingService._readSettingsDocument` |
| --- |
| `IStorageAdapter.readTextFile(BuildConfig.persistence.settingsPath)` |
| `UserSettingService._deserialiseSettings` |

| `UiStateStore.loadGameSession` |
| --- |
| `SerializationService.readGameSessionDocument(BuildConfig.persistence.gameSessionPath)` |
| `UiStateStore._coerceGameSessionSnapshot` |

| `SerializationService.readGameSessionDocument` |
| --- |
| `IStorageAdapter.readTextFile` |
| `SerializationService.deserialiseGameSession` |

| `UiStateStore.loadLayoutState` |
| --- |
| `SerializationService.readUiLayoutDocument(BuildConfig.persistence.layoutStatePath)` |

| `SerializationService.readUiLayoutDocument` |
| --- |
| `IStorageAdapter.readTextFile` |
| `SerializationService.deserialiseUiLayoutState` |

| `SavedGamesStore.registerAutosaveOnClose` |
| --- |
| `SavedGamesStore.disposeAutosaveOnClose` |
| `PlatformEventService.subscribeToAppCloseRequested` |

| `UiStateStore.setActiveGame` |
| --- |

| `UiStateStore.setActiveRoute` |
| --- |

| `App._saveSession` |
| --- |
| `UiStateStore.saveGameSession` |

| `UiStateStore.saveGameSession` |
| --- |
| `UiStateStore.loadGameSession` |
| `SerializationService.writeGameSessionDocument(BuildConfig.persistence.gameSessionPath)` |

| `SerializationService.writeGameSessionDocument` |
| --- |
| `SerializationService.serialiseGameSession` |
| `IStorageAdapter.writeTextFile` (`overwrite: true`) |

- The three loads run together through `Promise.all`. Each is idempotent: it returns immediately once loaded and shares its in-flight promise, so a later caller such as `EngineProfileView._load` never triggers a second read. `UserSettingService` reads and writes the settings document itself through its private helpers; `SerializationService.readSettingsDocument` and `writeSettingsDocument` are not on this path.
- `_isCommittedRoute` accepts `/home`, `/game/:id`, `/saved-games/load`, `/saved-games/load/:name`, `/saved-games/save/:name` and the four `/settings/:category` paths. A `/game/:id` path calls `setActiveGame`; any other committed path calls `setActiveRoute`. Engine child routes under `/settings/engines/...` are not committed routes, so they are never written to the session snapshot.
- Startup restore, the remembered-route branch and the invalid direct-game branch are split out under `SCN-SESSION-02` and `SCN-NAV-02`. Close-trigger autosave registration is expanded under [SCN-SAVE-01](PersistenceAndAdministration.md#scn-save-01---autosave-internal-save-entry).

### Session Route Checkpoint

#### Flow A - Checkpoint A Committed Game Route
| `App` route checkpoint (`router.afterEach` callback) |
| --- |
| `UiStateStore.setActiveGame` |
| `App._saveSession` |

#### Flow B - Checkpoint Any Other Committed Route
| `App` route checkpoint (`router.afterEach` callback) |
| --- |
| `UiStateStore.setActiveRoute` |
| `App._saveSession` |

- The callback returns without effect for a navigation failure, an unchanged path (duplicate or query-only navigation), any navigation before startup is ready, and any path `_isCommittedRoute` rejects. Startup performs its own initial checkpoint, so each successful committed path change is written exactly once.
- `App._saveSession` clears `sessionSaveError` after a successful write. A rejected write sets a recoverable notice and reopens the dismissed warning; the in-memory session and open games stay usable and the next successful checkpoint clears the notice. The router hook replaced an earlier session-route watcher; see the [watcher disposition](../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition).

### Navigation Frame

#### Flow A - Toggle Desktop Expansion
| `NavigationFrame` desktop toggle click handler |
| --- |
| `UiStateStore.toggleNavigationExpanded` |

#### Flow B - Open The Mobile Navigation Drawer
| `NavigationFrame._openDrawer` |
| --- |
| `useModal().open(NavigationMenuModal, { content }, onClosed)` |

| `NavigationMenuModal` click, overlay or Escape handler |
| --- |
| `emit('dismissed')` |

| `NavigationFrame` `onBeforeUnmount` |
| --- |
| `IModalHandle.close` |

- `NavigationFrame` owns layout only. `MenuBar` (inside `GameView`), `SavedGamesView` and `SettingsView` supply its `brand`, default and `footer` slots; `HomeView` uses its own action cards and has no frame. The drawer renders the same slot functions, so every action keeps its owning handler, and any click inside the drawer dismisses it after that handler runs. `UiStateStore.navigationExpanded` is a transient preference shared across views and is not persisted.

### Game Menu Interruption

#### Flow A - Leave The Board From The Game Menu
| `GameView` menu-event handler (`homeRequested`, `loadGameRequested`, `saveGameRequested` or `settingsRequested`) |
| --- |
| `GameView._run` |
| `GameView._handleMenuInterruptionRequested` |

| `GameView._handleMenuInterruptionRequested` |
| --- |
| `OperationOwner.cancel` (analysis-line playback) |
| `GamesStore.pauseGame(game, PauseReason.Menu)` |
| `router.push(target)` |

#### Flow B - Complete The Menu Pause On Activation
| `GameView._activateGame` |
| --- |
| `OperationOwner.cancel` (analysis-line playback) |
| `GameView._closeContinuation` |
| `GamesStore.getGame` |
| `GameView._handleMenuInterruptionCompleted` |

| `GameView._handleMenuInterruptionCompleted` |
| --- |
| `GamesStore.resumeGame(game, PauseReason.Menu)` |

- `GamesStore.pauseGame` runs only when the accepted `gameSession.autoPauseOnMenu` is true, and `GameClockComposable.pauseGame` then pauses only an ongoing timed game with a running clock, or adds `PauseReason.Menu` to a game that is already paused; untimed games keep running. The clock rules for timed live states and the paused-turn deferral are expanded in [SCN-TIME-05](GameplayAndControl.md#scn-time-05---menu-actions-auto-pause-timed-games). Targets are `/home`, `/saved-games/load`, `/saved-games/save/:id` and `/settings/session`.
- `GameView` calls `_activateGame` from `onMounted` and from `onBeforeRouteUpdate`, so returning to a game from any route, or switching tabs, completes only a pause whose reason list contains `PauseReason.Menu`. Manual pauses and pauses restored from a saved document (which `GameWorkspaceComposable._hydrateAndInsertGame` marks `PauseReason.Manual`) remain paused. The activation action replaced the earlier game-ID watcher.

## App And Session Start

### SCN-SESSION-01 - Fresh Launch with No Saved State

#### Flow A - Start With Empty Storage
| `App` startup callback (`onMounted`) |
| --- |
| `SettingsStore.loadSettings` |
| `UiStateStore.loadGameSession` |
| `UiStateStore.loadLayoutState` |
| `App._applyAppearance` |
| `App._restoreWorkspace` |
| `SavedGamesStore.registerAutosaveOnClose` |
| `UiStateStore.setActiveRoute('/home')` |
| `App._saveSession` |

| `UserSettingService.getSettingsOrDefault` |
| --- |
| `UserSettingService._readSettingsDocument` |
| `UserSettingService._createDefaultSettingsSnapshot` |
| `UserSettingService._cacheAcceptedSettings` |

| `UiStateStore.loadGameSession` |
| --- |
| `SerializationService.readGameSessionDocument` |
| `UiStateStore._createDefaultGameSession` |

| `UiStateStore.loadLayoutState` |
| --- |
| `SerializationService.readUiLayoutDocument` |
| `UiStateStore._createDefaultLayoutState` |

| `App._restoreWorkspace` |
| --- |
| `SavedGamesStore.restoreGames([])` |
| `GamesStore.listGames` |

#### Flow B - Home Route Setup
| `HomeView` `onMounted` |
| --- |
| `HomeView._refreshRecentGames` |

| `HomeView._refreshRecentGames` |
| --- |
| `RecentGameStore.getRecentGames` |

| `RecentGameStore.getRecentGames` |
| --- |
| `UserSettingService.getSettingsOrDefault` |
| `RecentGameStore._listManagedSaveGroups` |
| `SavedGameIndexService.getLatestSaveEntry` |
| `SerializationService.readGameDocument` |

| `RecentGameStore._listManagedSaveGroups` |
| --- |
| `SerializationService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |

| `SerializationService.listManagedSaveEntries` |
| --- |
| `IStorageAdapter.listDirectory(saveRootPath)` |
| `IStorageAdapter.listDirectory(gameFolderPath)` |

- A missing settings, session or layout document is a `PlatformErrorKind.NotFound` read, which resolves to the built-in default without a recovery warning. The default settings enable session restore, set `saveRootPath = 'saves'`, `autosaveAfterMoveCount = 1`, `autosaveOnClose = true` and `autoPauseOnMenu = true`, seed the engine inventory and the Black default player with the bundled Stockfish worker profile, enable random colours, and use `ThemeMode.System`. Defaults are cached in memory only; nothing is written until an explicit settings Apply, Save or Reset.
- A missing save root makes `listManagedSaveEntries` return an empty map, so `projectSaveGroups` yields no groups and no game documents are read. The session snapshot is the only document written by a fresh launch, through the startup checkpoint.
- UI surface coverage: `HomeView` shows four action cards: Quick game (`useQuickGame.start`), Custom game (`HomeView._openCustomGame`), Load game (`router.push('/saved-games/load')`) and Settings (`router.push('/settings/session')`). It shows "Looking for recent games…" while the first query runs, and the Recent games section only when at least one entry exists.
- Requirement verification: `Pass`. Fresh launch uses the ordinary startup path with no special-case bootstrap branch, the empty install lands on `/home` without creating a workspace, and every read reaches storage through layer-2 services.

### SCN-SESSION-02 - Restore Previous Session

#### Flow A - Reopen The Remembered Games
| `App._restoreWorkspace` |
| --- |
| `SavedGamesStore.restoreGames(openGameIds)` |
| `GamesStore.insertGame` (each restored outcome) |
| `UiStateStore.addRecoveryWarning` (insert rejected) |
| `GamesStore.listGames` |
| `UiStateStore.closeTab` (each unrestored id) |
| `UiStateStore.addRecoveryWarning` (each unrestored id) |

| `SavedGamesStore.restoreGames` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SavedGamesStore._restoreGame` (each id) |

| `SavedGamesStore.listSavedGames` |
| --- |
| `SavedGamesStore._getSaveRootPath` |
| `SavedGamesStore._listManagedSaveGroups` |

| `SavedGamesStore._getSaveRootPath` |
| --- |
| `UserSettingService.getSettingsOrDefault` |

| `SavedGamesStore._listManagedSaveGroups` |
| --- |
| `SerializationService.listManagedSaveEntries` |
| `SavedGameIndexService.projectSaveGroups` |

| `SavedGamesStore._restoreGame` |
| --- |
| `SavedGameIndexService.getLatestSaveEntryForGame` |
| `SerializationService.readGameDocument` |

| `SerializationService.readGameDocument` |
| --- |
| `IStorageAdapter.readTextFile` |
| `SerializationService.deserialiseGame` |

| `GamesStore.insertGame` |
| --- |
| `GameWorkspaceComposable.insertGame` |

| `GameWorkspaceComposable.insertGame` |
| --- |
| `GameWorkspaceComposable._hydrateAndInsertGame` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| `UserSettingService.getSettingsOrDefault` |
| `GameAnalysisComposable.refreshAnalysisForGame` |

| `GameWorkspaceComposable._hydrateAndInsertGame` |
| --- |
| `GameWorkspaceComposable._repairDuplicateGameId` |
| `GamePositionComposable.hydrateGame` |
| `GamePlayerTurnComposable.normalisePlayers` |
| `GameWorkspaceComposable._replaceGame` |
| `GameClockComposable.refreshRuntimeRegistrations` |

| `UiStateStore.closeTab` |
| --- |

| `UiStateStore.addRecoveryWarning` |
| --- |

#### Flow B - Restore Disabled
| `App._restoreWorkspace` |
| --- |
| `UiStateStore.closeTab` (each remembered id) |
| `UiStateStore.setActiveRoute('/home')` |

#### Flow C - Return To The Remembered Route
| `App` startup callback (`onMounted`) |
| --- |
| `router.replace(restoredRoute)` |
| `UiStateStore.setActiveGame` or `UiStateStore.setActiveRoute` |
| `App._saveSession` |

- Restore gate: `settings.gameSession.restorePreviousSession`. Accepted settings coerce `gameSession.autosaveOnClose = true` whenever restore is enabled, so every reopenable tab also has a close-trigger autosave; `SettingsView` disables that toggle accordingly. When restore is disabled, tabs are removed from the session but saved documents remain loadable from the library.
- Restore ownership: `SavedGamesStore.restoreGames` lists the save root once and returns one isolated `GameRestoreOutcome` per id (`restored` with the latest document, or `failed` with its error); a rejection of the whole call is treated as no outcomes. `App` feeds each restored payload to `GamesStore.insertGame` in session order, then closes any requested id that is not in `GamesStore.listGames()` and adds a warning naming it. `UiStateStore.closeTab` repairs `activeGameId` and `activeRoute`, so the persisted session no longer references a game that failed to load.
- Insertion: `_hydrateAndInsertGame` rebuilds parent links and node caches through `GamePositionComposable.hydrateGame`, replaces a saved paused state's missing runtime owner with `PauseReason.Manual` so a restored pause needs an explicit resume, normalises player runtime and registers focus-return clock reconciliation. `insertGame` then requests the next live turn (expanded in [Live Player Turn Request And Engine Moves](GameplayAndControl.md#live-player-turn-request-and-engine-moves)) and refreshes analysis only when `analysis.resumeLiveAnalysisAfterRestore` is true, the game is not in `GameState.BoardEdit` and it has analysis seats (expanded in [SCN-ANALYSIS-01](AnalysisAndSetup.md#scn-analysis-01---start-single-engine-analysis)). It resolves only after those seats have started; each seat's start failure is caught and shown on that seat. Startup therefore keeps the loading surface until every restored game's analysis engines have started.
- Remembered route: `App` replaces the current route with the restored `activeRoute` only when the browser path is `/` or `/home`, the restored route is committed and it is not `/home`. A direct link to any other path therefore wins over the remembered route. The restored route has already been coerced by `UiStateStore` against the surviving tabs.
- Requirement verification: `Pass`. Restore is gated by the accepted setting, isolates every game, repairs the session before the first checkpoint, and reaches storage only through `SavedGamesStore` and layer-2 services.

### SCN-SESSION-03 - Startup with Corrupt Persisted Data

#### Flow A - Corrupt Settings Document
| `UserSettingService.getSettingsOrDefault` |
| --- |
| `UserSettingService._readSettingsDocument` |
| `UserSettingService._createDefaultSettingsSnapshot` |
| `UserSettingService._cacheAcceptedSettings` |

| `SettingsStore.loadSettings` |
| --- |
| `UserSettingService.getSettingsOrDefault` |
| `UserSettingService.getLoadWarning` |
| `SettingsStore._acceptSettings` |

#### Flow B - Corrupt Session Or Layout Document
| `UiStateStore.loadGameSession` |
| --- |
| `SerializationService.readGameSessionDocument` |
| `UiStateStore.addRecoveryWarning` |
| `UiStateStore._createDefaultGameSession` |

| `UiStateStore.loadLayoutState` |
| --- |
| `SerializationService.readUiLayoutDocument` |
| `UiStateStore.addRecoveryWarning` |
| `UiStateStore._createDefaultLayoutState` |

#### Flow C - Corrupt Remembered Game
| `App._restoreWorkspace` |
| --- |
| `SavedGamesStore.restoreGames` |
| `GamesStore.listGames` |
| `UiStateStore.closeTab` |
| `UiStateStore.addRecoveryWarning` |

| `SavedGamesStore._restoreGame` |
| --- |
| `SavedGameIndexService.getLatestSaveEntryForGame` |
| `SerializationService.readGameDocument` |

#### Flow D - Corrupt Recent Target
| `RecentGameStore.getRecentGames` |
| --- |
| `RecentGameStore._listManagedSaveGroups` |
| `SavedGameIndexService.getLatestSaveEntry` |
| `SerializationService.readGameDocument` |

| `HomeView._refreshRecentGames` |
| --- |
| `RecentGameStore.getRecentGames` |

#### Flow E - Present The Recovery Notice
| `App` recovery-notice "Saved games" click handler |
| --- |
| `router.push('/saved-games/load')` |

| `App` recovery-notice "Settings" click handler |
| --- |
| `router.push('/settings/session')` |

- Settings: any read failure other than `NotFound` logs, records `UserSettingService.getLoadWarning()` and caches the defaults. The corrupt file is retained until an explicit Apply, Save or Reset writes a new document. `_deserialiseSettings` validates with `settingsSnapshotSchema` before coercion.
- Session and layout: `SerializationService` rejects malformed JSON, `schemaVersion` other than 1, schema failures and an `activeGameId` missing from `openGameIds`. `UiStateStore` logs, adds a warning and uses the default snapshot; the default session is written by the startup checkpoint, while the corrupt layout file stays until a fold change writes a new layout.
- Games: `SerializationService.deserialiseGame` validates the canonical schema, the move-tree `mainlineChildIndex` values and that `renderedPath` and `livePath` resolve. A failed remembered game closes its tab with a warning. An insert rejection adds its own warning; when the game never entered the workspace, the following membership check also closes the tab and adds the second, generic warning. A corrupt recent target is logged and skipped, and a failed listing makes `HomeView` show an empty list.
- The notice concatenates `SettingsStore.recoveryWarning`, `UiStateStore.recoveryWarnings` and the session-write error, and offers Saved games, Settings and Dismiss. On the browser target an invalid `chessvue:files:v1` index fails every read with `PlatformErrorKind.InvalidDocument`, so all three warnings appear and the libraries are empty until the index is repaired; the adapter never rewrites it implicitly.
- Requirement verification: `Pass`. Each artefact falls back independently, valid documents remain usable, and no corrupt source file is silently overwritten except the session snapshot repaired by the checkpoint.

## Game Creation And Navigation

### SCN-GAME-01 - Quick New Game from Menu

#### Flow A - Create From Accepted Defaults
| `useQuickGame.start` (HomeView Quick game card, MenuBar Quick game button) |
| --- |
| `SettingsStore.settings` (accepted `gameDefaults`) |
| `OperationOwner.run` |
| `useQuickGame._validateRequiredEngines` |
| `GamesStore.createGame` |
| `UiStateStore.openTab` |
| `router.push('/game/' + id)` |

| `useQuickGame._validateRequiredEngines` |
| --- |
| `EngineRuntimeService.getOptions` (each engine player) |

| `GamesStore.createGame` |
| --- |
| `GameWorkspaceComposable.createGame` |

| `GameWorkspaceComposable.createGame` |
| --- |
| `GameWorkspaceComposable._createGameMetadata` |
| `GameClockComposable.initialiseClockSnapshot` |
| `GameWorkspaceComposable._createPlayers` |
| `MoveHistoryService.createMoveTree` |
| `GameClockComposable.startClock` (live request) |
| `GameAnalysisComposable.createAnalysisSeat` (each analysis profile) |
| `GameWorkspaceComposable._hydrateAndInsertGame` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` |
| `GameAnalysisComposable.refreshAnalysisForGame` (seats exist) |

| `GameWorkspaceComposable._createPlayers` |
| --- |
| `Math.random` (random-colour request) |
| `GameWorkspaceComposable._assignPlayer` (White seat) |
| `GameWorkspaceComposable._assignPlayer` (Black seat) |

| `GameWorkspaceComposable._assignPlayer` |
| --- |
| `GamePlayerTurnComposable.createPlayerSnapshot` |

| `UiStateStore.openTab` |
| --- |

#### Flow B - Required Engine Unavailable
| `useQuickGame.start` |
| --- |
| `useQuickGame._validateRequiredEngines` |
| `EngineRuntimeService.getOptions` |

| `HomeView` or `MenuBar` "Edit game defaults" click handler |
| --- |
| `router.push('/settings/gameplay')` |

#### Flow C - Leave While Creation Is Pending
| `useQuickGame._cancel` (`onBeforeRouteLeave`, `onBeforeRouteUpdate`) |
| --- |
| `OperationOwner.cancel` |

- Request construction: `start` returns immediately while `isWorking` or before settings exist, then validates and copies the accepted defaults with `getGameCreationError` and `copyGameRequest` from `GameCreationUtility`. When either seat is unassigned the copied request sets `showLiveAnalysisMoves = true`; the user's live-game preference in settings is unchanged. A validation or readiness failure sets `errorMessage`, creates nothing, and shows the "Edit game defaults" link.
- Random player side: `_createPlayers` swaps the two requested players with probability one half when `randomiseColours` is true and both seats are assigned. Local players still carrying the default names White and Black are renamed Player 1 and Player 2 after the participant who was entered in each slot, so the labels do not contradict the drawn colours. Unassigned or single-seat requests never swap.
- Readiness and cancellation: required live player engines are checked with `EngineRuntimeService.getOptions` using a temporary seat id equal to the player colour; its temporary session owns its own cleanup. The `OperationOwner` prevents duplicate starts and is cancelled when the hosting route is left or updated and disposed with the component scope. `abortable` stops waiting for `createGame` on cancellation, and the signal checks prevent tab opening and navigation; a creation that had already started still inserts its game into `GamesStore`, matching the post-insertion semantics recorded in [QuickGameDefaultsDesign](../../ArchivedPlans/QuickGameDefaultsDesign.md#ownership-and-creation-flows).
- Engine startup: `createGame` awaits `refreshAnalysisForGame` when the request has analysis profiles, so navigation follows analysis-seat start; the opening player turn is requested without waiting.
- Route checkpoint: `router.push` commits `/game/:id`, `GameView` activates the game, and the [route checkpoint](#session-route-checkpoint) calls `UiStateStore.setActiveGame` and saves the session.
- Requirement verification: `Pass (layer exception)`. The game is created from accepted snapshots and becomes the active tab after routing. The readiness check is a deliberate presentation-to-domain call to `EngineRuntimeService.getOptions`, reused instead of adding a store pass-through; its rationale is in [QuickGameDefaultsDesign](../../ArchivedPlans/QuickGameDefaultsDesign.md#ownership-and-creation-flows).

### SCN-GAME-02 - Custom New Game with User Options

#### Flow A - Open From Home
| `HomeView._openCustomGame` |
| --- |
| `useModal().open(GameCreationModal, {})` |

#### Flow B - Open From The Game Menu
| `GameView` `customNewGameRequested` handler |
| --- |
| `GameView._run` |
| `GameView._openCustomGame` |

| `GameView._openCustomGame` |
| --- |
| `GameView._handleMenuInterruptionRequested` |
| `useModal().open(GameCreationModal, {}, onClosed)` |

| `GameView._openCustomGame` `onClosed` callback |
| --- |
| `GameView._handleMenuInterruptionCompleted` |

#### Flow C - Submit The Creation Form
| `GameCreationModal._submit` |
| --- |
| `useModalAction.run` |
| `GameCreationModal._validateRequiredEngines` |
| `GamesStore.createGame` |
| `UiStateStore.openTab` |
| `router.push('/game/' + id)` |
| `emit('dismissed')` |

| `GameCreationModal._validateRequiredEngines` |
| --- |
| `EngineRuntimeService.getOptions` (each engine player) |

| `GamesStore.createGame` |
| --- |
| `GameWorkspaceComposable.createGame` |

- Form ownership: each opening mounts a fresh `GameCreationModal` whose `_initialForm` copies the accepted `SettingsStore.settings.gameDefaults`; an unsaved settings draft never seeds a game. Player and analysis choices come from `EnginesStore.listConfiguredEngines`, which reads the accepted engine inventory. The live/analysis mode switch and `_effectiveRequest` omit both players in analysis mode, which makes `GameWorkspaceComposable.createGame` start a free-analysis workspace with `showLiveAnalysisMoves = true`; the random-colour toggle is disabled until both seats are assigned.
- Async ownership: `useModalAction.run` rejects duplicate submissions, disables dismissal while working and shows failures inline. The modal checks its `signal` after readiness and after creation, so a dismissal or replacement prevents tab opening and navigation. `dismissed` is emitted only after a successful action, and `ModalComposable` then unmounts the owner and runs its `onClosed` callback once. The design is recorded in [ModalComponentDesign](../../ArchivedPlans/ModalComponentDesign.md).
- Menu pause: the game-menu entry pauses the displayed game before the modal opens. Its `onClosed` callback resumes that game only when it is still displayed; creating a game navigates away, and returning to the interrupted game later completes the pause through `GameView._activateGame`.
- Setup branch: `GameControlPanel` opens the same modal with a `gameId` for a prepared board, and `_submit` then calls `GamesStore.startGameFromSetup` instead of creating a game. That flow belongs to [SCN-FREE-ANALYSIS-03](AnalysisAndSetup.md#scn-free-analysis-03---start-a-real-game-from-free-analysis--setup).
- Opening engine turn: `GameWorkspaceComposable.createGame` calls `requestPlayerMoveIfNeeded` immediately after insertion for every live game, including engine against engine; see [Live Player Turn Request And Engine Moves](GameplayAndControl.md#live-player-turn-request-and-engine-moves).
- Requirement verification: `Pass (layer exception)`. Validation blocks invalid clocks, names, missing engine paths and more than four or duplicate analysis engines before creation; unassigned seats produce free analysis. The required-engine readiness call is the same recorded presentation-to-domain exception as `SCN-GAME-01`.

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility

#### Flow A - Select A Tab
| `GameTabs._run` (tab click) |
| --- |
| `useGameTabActions.select(id)` |

| `useGameTabActions.select` |
| --- |
| `router.push('/game/' + id)` |

| `GameView` `onBeforeRouteUpdate` |
| --- |
| `GameView._activateGame` |

| `App` route checkpoint (`router.afterEach` callback) |
| --- |
| `UiStateStore.setActiveGame` |
| `App._saveSession` |

#### Flow B - Close A Tab Or The Displayed Game
| `GameTabs._run` (tab close), `MenuBar._closeGame` or `GameResultModal._exit` |
| --- |
| `useGameTabActions.close(id)` |

| `useGameTabActions.close` |
| --- |
| `UiStateStore.gameSession` (open-tab membership) |
| `GamesStore.getGame` |
| `GamesStore.clearPremoves` |
| `UiStateStore.closeTab` |
| `router.push('/game/' + activeGameId)` or `router.push('/home')` |

| `GamesStore.clearPremoves` |
| --- |
| `GamePremoveComposable.clearPremoves` |

| `UiStateStore.closeTab` |
| --- |

- Visibility: `GameTabs` derives its tabs from `GamesStore.listGames()` filtered by `UiStateStore.gameSession.openGameIds` and renders the strip only when more than one tab exists. The active tab is the routed `id`, so selection is published only after a successful route commit; a rejected or redirected navigation leaves the previous tab selected.
- Close: the tab close button, the menu's Close game action and the game-over prompt's Exit action share this action. `close` ignores an id that is not open or already closing. `closeTab` removes the id, re-selects the first remaining tab when the active tab closed, and coerces `activeRoute`; the view then routes to the new active game or `/home`, and the route checkpoint saves the session. Closing does not delete saves and does not remove or dispose the canonical game: it stays in `GamesStore.listGames()` with its turn and analysis runtime, is still included in close-trigger autosave and package-reference checks, and is reused by a Home recent-game reopen.
- Requirement verification: `Pass`. Tab membership and selection are derived from the session snapshot and route, `MenuBar` and `GameTabs` share one close action, and invalid targets fall back through `SCN-NAV-02`.

### SCN-NAV-01 - Route to Settings and Back to Active Game

#### Flow A - Enter Settings From A Game
| `GameView` `settingsRequested` handler |
| --- |
| `GameView._run` |
| `GameView._handleMenuInterruptionRequested` |
| `router.push('/settings/session')` |

| `App` route checkpoint (`router.afterEach` callback) |
| --- |
| `UiStateStore.setActiveRoute` |
| `App._saveSession` |

#### Flow B - Switch Settings Category
| `SettingsView._changeCategory` |
| --- |
| `router.push('/settings/' + category)` |

| `SettingsView` `onBeforeRouteUpdate` |
| --- |
| `SettingsView._loadEnginePackages` (engines category) |

| `SettingsView._loadEnginePackages` |
| --- |
| `EnginesStore.refreshPackages` |

#### Flow C - Return Without Pending Changes
| `SettingsView._requestReturn` |
| --- |
| `router.push(returnRoute)` |

| `GameView` `onMounted` |
| --- |
| `GameView._run` |
| `GameView._activateGame` |

| `GameView._activateGame` |
| --- |
| `GameView._handleMenuInterruptionCompleted` |

| `GameView._handleMenuInterruptionCompleted` |
| --- |
| `GamesStore.resumeGame(game, PauseReason.Menu)` |

#### Flow D - Leave With Pending Changes
| `SettingsView._requestReturn` or `SettingsView` `onBeforeRouteLeave` |
| --- |
| `SettingsView._requestDiscardChanges` |

| `SettingsView._requestDiscardChanges` |
| --- |
| `useModal().open(ConfirmationModal, …)` |

| `SettingsView._discardChangesAndNavigate` (confirm callback) |
| --- |
| `SettingsStore.discardPendingSettings` |
| `router.push(targetRoute)` |

- Entry points: Home's Settings card and the recovery notice route to `/settings/session` without a pause; the Quick game error routes to `/settings/gameplay`. `/settings` redirects to `/settings/session`, and the route pattern accepts only `session`, `gameplay`, `appearance` and `engines`; anything else falls through to the catch-all `/home` redirect.
- Settings were loaded during startup, so `SettingsView` reads `SettingsStore.draftSettings` immediately. The draft is shared across category route updates; `onBeforeRouteLeave` fires only when the Settings route record itself is left, and engine child routes keep the parent mounted. Apply, Save and Reset are expanded in [SCN-SETTINGS-01](PersistenceAndAdministration.md#scn-settings-01---update-visualui-preferences) and [SCN-SETTINGS-02](PersistenceAndAdministration.md#scn-settings-02---reset-settings-to-defaults).
- Return: `returnRoute` is `/game/:activeGameId` when the session has an active game, otherwise `/home`. The returned `GameView` activation completes only a `PauseReason.Menu` pause; with `autoPauseOnMenu` disabled, or for an untimed game, no pause was taken. While the menu pause is active the board is interaction-locked and a player-engine move that becomes ready is held in `deferredPlayerMove` until `resumeGame` flushes it, as described in [SCN-TIME-05](GameplayAndControl.md#scn-time-05---menu-actions-auto-pause-timed-games).
- Dirty leave: the guard cancels the navigation and opens a confirmation offering Keep editing or Discard changes. Discard restores the draft from the accepted snapshot and repeats the navigation, which the guard then allows. No implicit Save choice is offered.
- Requirement verification: `Pass`. Pause and resume are owned by `GameView` actions rather than settings code, dirty leave is explicit, and return routing falls back to Home when no active game remains.

### SCN-NAV-02 - Invalid Game Route Handling

#### Flow A - Direct Link At Startup
| `App` startup callback (`onMounted`) |
| --- |
| `GamesStore.getGame(routeId)` |
| `GamesStore.getGame` (each remembered open id) |
| `router.replace('/game/' + fallbackId)` or `router.replace('/home')` |

#### Flow B - Mount On An Unknown Game
| `GameView` `onMounted` |
| --- |
| `GameView._run` |
| `GameView._activateGame` |
| `router.replace(fallback)` |

| `GameView._activateGame` |
| --- |
| `GamesStore.getGame(id)` |
| `UiStateStore.gameSession` (open ids) |
| `GamesStore.getGame` (each open id) |

#### Flow C - Route Update To An Unknown Game
| `GameView` `onBeforeRouteUpdate` |
| --- |
| `GameView._activateGame` |

- The fallback is the first remembered open id that is still in `GamesStore`, otherwise `/home`. In a route update the returned fallback path is the guard's redirect result; a known game returns nothing and the navigation proceeds. `GameView` renders nothing until both the game and its position exist, so it never binds to missing state.
- Unknown paths of any other shape hit the router's `/:pathMatch(.*)*` redirect to `/home`. If a checkpoint still receives a `/game/:id` whose id is not an open tab, `UiStateStore.setActiveGame` clears `activeGameId` and coerces the stored route.
- Requirement verification: `Pass`. Unknown game routes are redirected before the view binds, both at startup and during in-app navigation.

### SCN-NAV-03 - Reopen Recent Game from Home

#### Flow A - Reactivate A Game Already In The Workspace
| `HomeView._openRecent` |
| --- |
| `GamesStore.getGame` |
| `UiStateStore.openTab` |
| `router.push('/game/' + id)` |

#### Flow B - Load The Latest Managed Save
| `HomeView._openRecent` |
| --- |
| `GamesStore.getGame` |
| `SavedGamesStore.loadRecentGame` |
| `GamesStore.insertGame` |
| `UiStateStore.openTab` |
| `router.push('/game/' + id)` |

| `SavedGamesStore.loadRecentGame` |
| --- |
| `SavedGamesStore.listSavedGames` |
| `SavedGameIndexService.getLatestSaveEntryForGame` |
| `SavedGamesStore._readManagedGame` |

| `SavedGamesStore._readManagedGame` |
| --- |
| `SerializationService.readGameDocument` |

| `GamesStore.insertGame` |
| --- |
| `GameWorkspaceComposable.insertGame` |

#### Flow C - Recent Target No Longer Opens
| `HomeView._openRecent` |
| --- |
| `SavedGamesStore.loadRecentGame` |
| `HomeView._refreshRecentGames` |

- Projection: `RecentGameStore.getRecentGames` reads the latest entry of each managed save group, takes the display name from that document and its `lastSavedAtUtc` from the file timestamp (falling back to `metadata.updatedAt`), and sorts newest first. Autosave and named saves compete in one list per game; `sourceKind` records which won. `HomeView` shows at most three entries, labelled Autosaved or Saved, and a View all link to `/saved-games/load`.
- Reopen: a game already in `GamesStore`, including one whose tab was closed, is reactivated without reading storage, so unsaved in-memory progress is never replaced. Otherwise the managed group's folder name is written into the loaded document's `metadata.id` before insertion. While one entry is opening, its card is disabled.
- Failure: a missing or unreadable target shows the error and re-queries the list, so a stale entry disappears without any cleanup write.
- Requirement verification: `Pass`. Recent entries are query-derived, `SavedGamesStore` owns the document read, and `GamesStore.insertGame` owns workspace insertion.
