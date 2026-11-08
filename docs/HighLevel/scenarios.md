# ChessVue User Scenarios

## Purpose
This document translates high-level product features into actionable user scenarios.

The goal is to map **user actions -> branch paths -> implementation ownership implications** so low-level design can define concrete contracts with fewer gaps.

This is a design artifact only. It introduces no runtime code/API changes.

While writing journeys, compare each scenario and branch with the current implementation, owning contracts and the user's clarified product intent. This catalogue may contain gaps, ambiguous policies and stale implementation labels. Follow the [journey drift review](../ArchivedPlans/JourneyTestPlan.md#scenario-drift-review-while-writing-journeys) and record unresolved design questions in [docs/questions](../questions/README.md); neither current code nor scenario wording alone settles unclear product behaviour.

Recording scope, clarified by the user on 15 October 2026: recorded analysis belongs only to actual moves played in games. Exploratory moves remain temporary and are not recorded-analysis entries. Existing pruning under SCN-HIST-04 is accepted; see the [resolved decision](../questions/analysis/Q-ANALYSIS-002-VariationRetention.md). This does not change the separate workspace-restoration or historical-rewrite rules.

Last reconciled with the implementation at `30e9ed6` on 8 November 2026. Statuses, branches and touchpoints below were checked against `src/`, the [journey catalogue](../../journeys/Catalogue.json), the journey [scenario reviews](../../journeys/definitions/) and the unit suites under `src/**/__tests__`.

## Conventions
- **Scenario ID**: stable identifier, e.g. `SCN-GAME-01`. IDs are never renumbered; new scenarios append the next free number in their area.
- **Branch ID**: stable identifier, e.g. `BR-GAME-01-CANCEL`.
- **Status**:
  - `Current`: expected in baseline core flows.
  - `Planned`: documented target behavior for later implementation.
  - `Idea`: speculative flow for review, not committed scope.
  - A `Current` scenario may name individual `Planned` branches; only those branches remain unimplemented.
- **Analysis Contexts**:
  - `Free analysis / setup`: no live game progression, board editing allowed, can transition into a started game.
  - `In-game analysis mode`: entered explicitly from an active game, board editing not allowed, user can explore moves without progressing the live game while actual play continues independently.
  - `Finished review`: a live game whose result is recorded. History navigation and analysis moves remain available; live gameplay controls are not offered.
- **Hosts**: unless a scenario or branch names a host, it applies to both the NW.js desktop app and the ordinary browser build. [SCN-PLATFORM-01](#scn-platform-01---use-chessvue-in-an-ordinary-browser) and [SCN-PLATFORM-02](#scn-platform-02---use-chessvue-as-the-nwjs-desktop-app) record the host differences.
- **Implementation Touchpoints** name the current owners: `GamesStore` actions, the `src/state/game/*Composable.ts` helpers that implement them, other stores, domain services, and presentation views, components, modals and composables. Private helpers keep their underscore names. Presentation ownership is described under [Presentation](../LowLevel/Architecture/Presentation/index.md).

## Rewrite Baseline
- `Current` and `Planned` scenarios are rewrite input.
- `Idea` scenarios are not rewrite input.
- Deferred concepts referenced by `Idea` scenarios are also catalogued in [ideas.md](ideas.md).

## Contract Traceability
The high-level contracts used by this document are:

- `STATE`: [state_model.md](state_model.md)
- `PERSIST`: [persistence_contract.md](persistence_contract.md)
- `ENGINE`: [engine_runtime.md](engine_runtime.md)
- `SETTINGS`: [settings_contract.md](settings_contract.md)
- `LAYOUT`: [ui_layout.md](ui_layout.md), used only where a scenario is shaped by the responsive navigation structure rather than game, persistence, engine or settings state.

## Current and Planned Scenario Contract Map
This matrix is the authoritative trace from each committed scenario to the contracts that define its implementation-shaping behaviour.

| Scenario | Contracts |
| --- | --- |
| `SCN-SESSION-01` | `PERSIST`, `SETTINGS` |
| `SCN-SESSION-02` | `STATE`, `PERSIST`, `SETTINGS` |
| `SCN-SESSION-03` | `PERSIST` |
| `SCN-PLATFORM-01` | `PERSIST`, `ENGINE`, `SETTINGS` |
| `SCN-PLATFORM-02` | `PERSIST`, `ENGINE`, `SETTINGS` |
| `SCN-GAME-01` | `STATE`, `PERSIST`, `SETTINGS` |
| `SCN-GAME-02` | `STATE`, `ENGINE`, `SETTINGS` |
| `SCN-GAME-03` | `STATE`, `PERSIST` |
| `SCN-GAME-04` | `STATE`, `SETTINGS` |
| `SCN-NAV-01` | `STATE`, `SETTINGS` |
| `SCN-NAV-02` | `STATE` |
| `SCN-NAV-03` | `PERSIST` |
| `SCN-NAV-04` | `LAYOUT` |
| `SCN-MOVE-01` | `STATE`, `ENGINE` |
| `SCN-MOVE-02` | `STATE` |
| `SCN-MOVE-03` | `STATE`, `SETTINGS` |
| `SCN-MOVE-04` | `STATE`, `ENGINE`, `PERSIST` |
| `SCN-HIST-01` | `STATE`, `ENGINE` |
| `SCN-HIST-02` | `STATE`, `SETTINGS` |
| `SCN-HIST-03` | `STATE`, `SETTINGS` |
| `SCN-HIST-04` | `STATE`, `PERSIST` |
| `SCN-FREE-ANALYSIS-01` | `STATE`, `ENGINE` |
| `SCN-FREE-ANALYSIS-02` | `STATE`, `ENGINE`, `SETTINGS` |
| `SCN-FREE-ANALYSIS-03` | `STATE`, `ENGINE`, `SETTINGS` |
| `SCN-ANALYSIS-01` | `STATE`, `ENGINE` |
| `SCN-ANALYSIS-02` | `ENGINE` |
| `SCN-ANALYSIS-03` | `ENGINE` |
| `SCN-ANALYSIS-04` | `STATE`, `ENGINE`, `SETTINGS` |
| `SCN-ANALYSIS-05` | `STATE`, `ENGINE` |
| `SCN-TIME-01` | `STATE` |
| `SCN-TIME-02` | `STATE` |
| `SCN-TIME-03` | `STATE`, `SETTINGS` |
| `SCN-TIME-04` | `STATE` |
| `SCN-TIME-05` | `STATE`, `SETTINGS` |
| `SCN-CTRL-01` | `STATE`, `SETTINGS` |
| `SCN-CTRL-02` | `STATE`, `PERSIST` |
| `SCN-CTRL-03` | `STATE`, `ENGINE` |
| `SCN-CTRL-04` | `STATE`, `ENGINE` |
| `SCN-CTRL-05` | `STATE` |
| `SCN-CTRL-06` | `STATE`, `PERSIST` |
| `SCN-SAVE-01` | `PERSIST`, `SETTINGS` |
| `SCN-SAVE-02` | `PERSIST`, `SETTINGS` |
| `SCN-SAVE-03` | `PERSIST` |
| `SCN-LOAD-01` | `PERSIST`, `ENGINE`, `SETTINGS` |
| `SCN-EXPORT-01` | `PERSIST`, `SETTINGS` |
| `SCN-IMPORT-01` | `PERSIST`, `ENGINE` |
| `SCN-IMPORT-02` | `PERSIST` |
| `SCN-SETTINGS-01` | `SETTINGS`, `PERSIST` |
| `SCN-SETTINGS-02` | `SETTINGS`, `PERSIST` |
| `SCN-SETTINGS-03` | `SETTINGS`, `ENGINE` |
| `SCN-ENGINE-01` | `ENGINE`, `SETTINGS` |
| `SCN-ENGINE-02` | `ENGINE`, `SETTINGS` |
| `SCN-ENGINE-03` | `STATE`, `ENGINE` |
| `SCN-ENGINE-04` | `ENGINE`, `SETTINGS` |
| `SCN-ENGINE-05` | `ENGINE`, `SETTINGS` |
| `SCN-LIFECYCLE-01` | `STATE`, `PERSIST` |
| `SCN-LIFECYCLE-02` | `STATE`, `PERSIST` |
| `SCN-LIFECYCLE-03` | `PERSIST` |

## Scenario Template
Each scenario in this document uses the same structure:

- `Scenario ID`
- `Status (Current/Planned/Idea)`
- `Goal`
- `Preconditions`
- `Entry Points`
- `Main Steps`
- `Branch Paths`
- `Postconditions`
- `Implementation Touchpoints`

---

## App and Session Start

### SCN-SESSION-01 - Fresh Launch with No Saved State
- **Status**: Current
- **Goal**: Start app from a clean state and reach a usable first screen.
- **Preconditions**: No persisted games/UI/settings state exists.
- **Entry Points**: App startup.
- **Main Steps**:
  1. User launches app.
  2. `main.ts` installs Pinia and the router; `App.vue` shows a loading mark while it loads settings, the game session and the layout state.
  3. App loads default settings. The built-in Quick game defaults are a local player against the bundled Stockfish profile with randomised colours, untimed, takebacks allowed and live analysis moves shown; the engine inventory contains that Stockfish profile.
  4. App applies the default `system` theme mode: it installs both built-in theme profiles as CSS variables and lets CSS `color-scheme`/`light-dark()` select the light or dark profile. The app does not query or subscribe to the OS theme for styling.
  5. App shows the centred `HomeView` with four action cards: Quick game, Custom game, Load game and Settings.
  6. Because no saved games exist yet, the recent games list stays hidden.
- **Branch Paths**:
  - `BR-SESSION-01-INIT-FAIL`: If any persisted read fails unexpectedly, app falls back to safe defaults and logs recoverable error.
  - `BR-SESSION-01-HOME-FALLBACK`: If the preferred home screen cannot be restored, app still shows a neutral landing state without auto-creating a game.
- **Postconditions**: User can start a new game, load a game, or open settings without restart.
- **Implementation Touchpoints**:
  - `App.vue` `onMounted` startup and `_applyAppearance`
  - `SettingsStore.loadSettings`
  - `UiStateStore.loadLayoutState`
  - `UiStateStore.loadGameSession`
  - `UserSettingService.getSettingsOrDefault`
  - `HomeView._refreshRecentGames` / `RecentGameStore.getRecentGames`

### SCN-SESSION-02 - Restore Previous Session
- **Status**: Current
- **Goal**: Resume prior UI/game context after restart.
- **Preconditions**: Persisted game-session `openGameIds`, `activeGameId`, `activeRoute`, and independent UI layout/preferences exist.
- **Entry Points**: App startup.
- **Main Steps**:
  1. User launches app.
  2. App loads persisted settings and UI state.
  3. App installs the light and dark theme profiles as CSS variables and publishes `appearance.themeMode` to the document; CSS resolves the effective colour scheme, including `system` mode.
  4. If Restore previous session is enabled, app loads only the remembered open games from their latest managed snapshots, preserving tab order.
  5. App removes unrestorable IDs with a recovery warning, repairs selection and, when the app is opened at its `/` or `/home` route, restores the remembered game, Settings or library route after the required games load. A direct deep link keeps its own route. Disabled restore closes the remembered tabs and opens Home; saved documents remain loadable.
  6. Eligible analysis resumes when `analysis.resumeLiveAnalysisAfterRestore` is enabled; a restored running live game requests its next actual turn. Paused player turns and board-edit analysis remain inactive until the corresponding user action.
- **Branch Paths**:
  - `BR-SESSION-02-MISSING-GAME`: Persisted `activeGameId` cannot be restored -> route to an available game or Home and persist the repaired session.
  - `BR-SESSION-02-PARTIAL-STATE`: UI state exists but games do not -> keep UI preferences, reset active game.
  - `BR-SESSION-02-CHECKPOINT-FAIL`: Startup or later route checkpoint cannot be written -> keep the usable in-memory workspace and show a recoverable notice; a later successful navigation checkpoint persists the current shell state.
- **Postconditions**: Prior session context is restored where valid; invalid pieces are safely repaired.
- **Implementation Touchpoints**:
  - `App._restoreWorkspace`
  - `UiStateStore.loadLayoutState`
  - `UiStateStore.loadGameSession`
  - `UiStateStore.closeTab` / `UiStateStore.addRecoveryWarning`
  - `SavedGamesStore.restoreGames`
  - `GamesStore.insertGame`
  - `GamesStore.listGames`
  - `UiStateStore.setActiveGame` / `UiStateStore.setActiveRoute`
  - `App.vue` `router.afterEach` route checkpoint and `App._saveSession` / `UiStateStore.saveGameSession`
  - `SerializationService.readGameSessionDocument`

### SCN-SESSION-03 - Startup with Corrupt Persisted Data
- **Status**: Current
- **Goal**: Prevent startup crash when stored JSON/state is corrupt.
- **Preconditions**: At least one persisted payload is malformed.
- **Entry Points**: App startup.
- **Main Steps**:
  1. User launches app.
  2. App attempts to deserialize persisted state.
  3. Corrupt payload is rejected and isolated; valid independent settings, layout and saved games remain available.
  4. App continues with defaults and displays recoverable warning.
- **Branch Paths**:
  - `BR-SESSION-03-SETTINGS-CORRUPT`: Settings payload invalid -> in-memory default settings with a recoverable warning; the corrupt file is retained until an explicit settings save/reset.
  - `BR-SESSION-03-GAME-VERSION`: Unsupported saved-game schema version -> reject the payload and continue the recoverable startup flow.
- **Postconditions**: App remains usable; bad persistence does not block launch. The notice can be dismissed or open Saved games/Settings. Repaired session state is checkpointed without silently erasing corrupt settings/layout/game source files.
- **Implementation Touchpoints**:
  - `SerializationService.readGameDocument`
  - `UiStateStore.loadGameSession`
  - `UiStateStore.loadLayoutState`
  - `SettingsStore.loadSettings` / `SettingsStore.recoveryWarning`
  - `UserSettingService.getSettingsOrDefault` / `UserSettingService.getLoadWarning`
  - `App.vue` recovery notice

### SCN-PLATFORM-01 - Use ChessVue in an Ordinary Browser
- **Status**: Current
- **Goal**: Run the same application flows in a normal browser tab, including the GitHub Pages deployment.
- **Preconditions**: No NW.js runtime is present, or the build forces `CHESSVUE_PLATFORM=browser`.
- **Entry Points**: Opening the hosted app URL, a direct app route, or `npm run dev`.
- **Main Steps**:
  1. `getPlatformTarget` selects the browser target and `usePlatformService` resolves `useBrowserPlatformService`.
  2. Settings, session, layout and managed-save documents are stored at their logical paths in same-origin `localStorage` through `BrowserFileSystem`; the save root names a virtual folder.
  3. Import opens a browser file chooser restricted to `.json`; Export downloads the canonical document as `<game id>.json`.
  4. The bundled Stockfish profile runs as a Browser UCI Worker loading the single-threaded lite WASM build from the app's own files. Imported engine packages ([SCN-ENGINE-04](#scn-engine-04---install-a-browser-engine-package)) are stored in IndexedDB and started through `WorkerScriptLoader`.
  5. `pagehide` and a hidden `visibilitychange` raise the app-close checkpoint used by autosave-on-close; window focus and a visible tab raise focus return for clock synchronisation.
  6. The GitHub Pages workflow builds with the site base path and copies `index.html` to `404.html` so direct app URLs load the application.
- **Branch Paths**:
  - `BR-PLATFORM-01-STORAGE-REJECTED`: The browser rejects a storage write (for example a quota error) -> the operation reports a typed failure; accepted settings and documents remain unchanged and an explicit retry can succeed.
  - `BR-PLATFORM-01-NATIVE-ENGINE`: A profile or copied assignment targets a desktop executable or an unusable URL -> the Desktop executable interface is unavailable for new browser profiles, and an existing assignment fails with an actionable engine error and Retry/Remove controls.
  - `BR-PLATFORM-01-TAB-CLOSE`: The tab closes while an asynchronous autosave is still running -> only writes completed before closing are guaranteed; close autosave is best effort.
  - `BR-PLATFORM-01-SECOND-PAGE`: Another page at the same origin opens -> it reads the same persisted documents; there is no live cross-tab synchronisation.
- **Postconditions**: Browser users can play, analyse, save, restore and transfer games with documents kept in their own browser origin. Native executable engines require the desktop app.
- **Implementation Touchpoints**:
  - `getPlatformTarget` / `usePlatformService`
  - `useBrowserPlatformService`, `defineBrowserStorageAdapterStore`, `BrowserFileSystem`
  - `BrowserProcessManager` / `BrowserUciEngineClient` / `WorkerScriptLoader`
  - `PlatformEventService.subscribeToAppCloseRequested` / `PlatformEventService.subscribeToAppFocusReturned`
  - `.github/workflows/deploy-pages.yml`
  - [Platform services](../LowLevel/Architecture/PlatformAbstraction/PlatformServices.md)

### SCN-PLATFORM-02 - Use ChessVue as the NW.js Desktop App
- **Status**: Current
- **Goal**: Run the application as a desktop window with local files, native dialogs and native UCI executables.
- **Preconditions**: A real NW.js runtime exposes `nw.Window`, or the build forces `CHESSVUE_PLATFORM=nwjs`.
- **Entry Points**: `npm run desktop` or a packaged NW.js launch.
- **Main Steps**:
  1. `getPlatformTarget` selects the NW.js target and `usePlatformService` resolves the NW.js platform service.
  2. Settings, session, layout and managed saves are JSON files on disk; the save root accepts a relative or absolute local path.
  3. Import, Export and the engine-profile Browse action use the native open/save dialogs.
  4. Desktop executable profiles run as native child processes through the NW.js process manager and UCI client; Browser UCI Worker profiles, including the bundled Stockfish, run as Workers.
  5. Closing the native window awaits the registered close checkpoints, including autosave-on-close, drains owned engine processes and quits the application.
- **Branch Paths**:
  - `BR-PLATFORM-02-DIALOG-CANCEL`: A native open/save dialog is cancelled -> the owning flow settles without writing or importing.
  - `BR-PLATFORM-02-PACKAGE-IMPORT`: The user visits the engine package import route -> the view explains that package import is a browser feature; desktop profiles point at an executable or an unpacked script instead.
- **Postconditions**: Desktop users keep their saves and settings as ordinary files and can use native engines alongside worker engines.
- **Implementation Touchpoints**:
  - `getPlatformTarget` / `usePlatformService`
  - `defineNwjsPlatformServiceStore`, `defineNwjsStorageAdapterStore`, `NwjsProcessManager`, `NwjsUciEngineClient`
  - `EnginePackageService.canInstall`
  - [Platform services](../LowLevel/Architecture/PlatformAbstraction/PlatformServices.md), [process ownership](../ArchivedPlans/NwjsProcessOwnershipFixPlan.md)

---

## Game Creation and Navigation

### SCN-GAME-01 - Quick New Game from Menu
- **Status**: Current
- **Goal**: Start a game quickly with the saved Quick game defaults.
- **Preconditions**: App is open; settings are loaded.
- **Entry Points**: Game menu `Quick game` and the Home `Quick game` card.
- **Main Steps**:
  1. User clicks `Quick game`.
  2. App copies the accepted `gameDefaults` snapshot (name, players, clock, takeback and live-analysis preferences, analysis engines and `randomiseColours`) into a creation request; an unsaved Settings draft never seeds creation. A free-analysis result forces live analysis moves on.
  3. App validates the defaults and checks that each required player engine can start.
  4. Game is created in memory, assigned to a new tab and opened immediately.
  5. App routes to `/game/:id`.
- **Branch Paths**:
  - `BR-GAME-01-CANCEL`: The user leaves or updates the route while engine readiness is pending -> creation is cancelled and no game, tab or navigation follows. Quick game has no confirmation dialog.
  - `BR-GAME-01-INVALID-DEFAULTS`: Saved defaults fail creation validation -> show the error with an `Edit game defaults` action and create nothing.
  - `BR-GAME-01-ENGINE-UNAVAILABLE`: A required player engine cannot start -> show an actionable error with `Edit game defaults` and create nothing.
- **Postconditions**: New game context becomes active unless cancelled or rejected. Repeated clicks while work is pending create one game.
- **Implementation Touchpoints**:
  - `useQuickGame().start`
  - `copyGameRequest` / `getGameCreationError` (`GameCreationUtility`)
  - `EngineRuntimeService.getOptions`
  - `GamesStore.createGame`
  - `UiStateStore.openTab`
  - Rationale: [Quick game defaults design](../ArchivedPlans/QuickGameDefaultsDesign.md)

### SCN-GAME-02 - Custom New Game with User Options
- **Status**: Current
- **Goal**: Create game with custom time control and player/engine settings.
- **Preconditions**: Settings are loaded; the custom game dialog is available.
- **Entry Points**: Game menu `Custom` and the Home `Custom game` card.
- **Main Steps**:
  1. User opens `GameCreationModal` ("Set up a new board"), initialised from the accepted Quick game defaults.
  2. User chooses `Play a game` or `Free analysis` and edits the name, players (Unassigned, Local player, Keep the saved engine, or Use profile), `Randomly assign colours`, clock preset or Custom minutes/increment, `Allow takebacks`, `Show live analysis moves` for live games, and up to four analysis-engine snapshots.
  3. User may assign either side to `none`, which means the flow starts in `free analysis / setup` context instead of a live game.
  4. User confirms with `Create workspace`.
  5. App validates options, checks required player engines and creates configured game.
  6. If the created workspace is a live game and the side to move is engine-controlled, the normal live engine-turn loop starts from that side without a separate engine-vs-engine mode.
- **Branch Paths**:
  - `BR-GAME-02-INVALID-TIME`: Invalid time settings (minutes outside 1-600, increment outside 0-300 seconds) -> inline validation, block submit.
  - `BR-GAME-02-ENGINE-MISSING`: Selected required engine unavailable -> block creation until the setup is corrected.
  - `BR-GAME-02-FREE-ANALYSIS-START`: If either side is assigned `none`, or `Free analysis` is chosen, initialise free analysis/setup permissions with live analysis moves enabled, and start analysis when engines were configured at creation.
  - `BR-GAME-02-CANCEL`: User cancels or dismisses the dialog -> no game is created; a game interrupted by the menu resumes its menu pause.
- **Postconditions**: Game starts with validated custom settings, including the persisted per-game live-analysis move preference when the result is a live game.
- **Implementation Touchpoints**:
  - `MenuBar.customNewGameRequested` / `GameView._openCustomGame`
  - `HomeView._openCustomGame`
  - `useModal().open`
  - `GameCreationModal._submit` / `GameCreationModal._validateRequiredEngines`
  - `GamePlayerField`, `GameClockFields`, `AnalysisSnapshotFields`
  - `GamesStore.createGame`
  - `UiStateStore.openTab`

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility
- **Status**: Current
- **Goal**: Switch between game contexts while keeping route and active game state in sync.
- **Preconditions**: Two or more active games exist.
- **Entry Points**: Tab click, tab close, game menu `Close game`, route change, recent game action.
- **Main Steps**:
  1. User opens/creates multiple games.
  2. User switches game via tab.
  3. App updates active route and current game ID.
  4. Game view rebinds board/history/analysis to selected game. Closing a tab or using `Close game` clears that game's premoves, removes its tab and routes to the next active game, or Home after the last tab, without deleting its managed saves.
- **Branch Paths**:
  - `BR-GAME-03-ONE-TAB`: If only one game remains, tab bar hides.
  - `BR-GAME-03-INVALID-TARGET`: If selected game no longer exists, fallback to first valid game/home.
- **Postconditions**: Navigation remains deterministic; hidden-tab rule is respected.
- **Implementation Touchpoints**:
  - `useGameTabActions().select` / `useGameTabActions().close`
  - `GameTabs`, `MenuBar._closeGame`
  - `UiStateStore.closeTab`
  - `UiStateStore.setActiveGame`
  - `GameView._activateGame`
  - `GamesStore.getGame`
  - `GamesStore.listGames`

### SCN-GAME-04 - Randomly Assign Player Colours
- **Status**: Current
- **Goal**: Let two chosen participants be assigned to White and Black at random when a game starts.
- **Preconditions**: Both seats are assigned (local or engine) in Quick game defaults, the custom game dialog or the start-from-setup dialog.
- **Entry Points**: `Randomly assign colours` in Settings > Gameplay, Custom game and Start game.
- **Main Steps**:
  1. User enables `Randomly assign colours`; the seat labels change to `Player 1` and `Player 2`.
  2. User creates or starts the game.
  3. The game workspace draws once whether to swap the participants, then assigns each copied player snapshot to its resolved colour. Default local names become `Player 1` and `Player 2`.
  4. Play starts normally from the side to move; an engine drawn as the side to move starts its turn.
- **Branch Paths**:
  - `BR-GAME-04-PARTIAL`: Either seat is unassigned -> the option is disabled and the request keeps its fixed seats.
  - `BR-GAME-04-RESTORE`: The game is saved and restored -> only the resolved assignments are persisted, so no new draw occurs.
- **Postconditions**: Each new game has an independent draw; existing games keep their resolved colours.
- **Implementation Touchpoints**:
  - `GameWorkspaceComposable._createPlayers` (used by `GamesStore.createGame` and `GamesStore.startGameFromSetup`)
  - `ICreateGameRequest.randomiseColours`
  - Rationale: [random player colours](../ArchivedPlans/QuickGameDefaultsDesign.md#random-player-colours)

### SCN-NAV-01 - Route to Settings and Back to Active Game
- **Status**: Current
- **Goal**: Let user configure preferences and return to gameplay context.
- **Preconditions**: At least one game may be active.
- **Entry Points**: Game menu `Settings`, Home `Settings` card, the recovery notice, `/settings` and `/settings/:category` (`session`, `gameplay`, `appearance`, `engines`).
- **Main Steps**:
  1. User navigates to settings.
  2. If a timed game is active and auto-pause-on-menu is enabled, app pauses the game before leaving the game screen.
  3. Settings shows the shared draft for the selected category; the Engines category refreshes the browser package list.
  4. User applies, saves, or resets settings, including appearance settings such as `themeMode`.
  5. Accepted appearance changes update the active app theme without restart.
  6. User navigates back to prior game route with `Back to game` (or `Back to home`), the brand, or `Cancel`.
  7. If the pause came from this auto-pause flow, app auto-resumes on return.
- **Branch Paths**:
  - `BR-NAV-01-DIRTY-LEAVE`: Unsaved form edits + navigation -> offer Keep editing or Discard changes. Apply/Save commits explicitly from Settings.
  - `BR-NAV-01-NO-GAME-RETURN`: No active game available on return -> route to home/default.
  - `BR-NAV-01-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, settings open without pausing the clock.
- **Postconditions**: Settings are persisted or intentionally discarded; navigation context remains clear.
- **Implementation Touchpoints**:
  - `MenuBar.settingsRequested`
  - `GameView._handleMenuInterruptionRequested` / `GameView._handleMenuInterruptionCompleted`
  - `SettingsView._requestReturn` / `SettingsView._requestDiscardChanges` / `onBeforeRouteLeave`
  - `SettingsStore.saveSettings`
  - `SettingsStore.applySettings`
  - `SettingsStore.resetSettings`
  - `SettingsStore.discardPendingSettings`
  - `UiStateStore.saveGameSession`

### SCN-NAV-02 - Invalid Game Route Handling
- **Status**: Current
- **Goal**: Gracefully handle `/game/:id` when `id` is unknown.
- **Preconditions**: User deep-links to invalid game ID.
- **Entry Points**: URL route or internal navigate call.
- **Main Steps**:
  1. User opens invalid game route.
  2. App startup and `GameView` validate the game ID on mount and on each route-parameter change.
  3. App redirects to valid fallback route.
- **Branch Paths**:
  - `BR-NAV-02-HAS-GAMES`: Redirect to first available open game.
  - `BR-NAV-02-NO-GAMES`: Redirect to Home.
- **Postconditions**: User never lands in broken game view.
- **Implementation Touchpoints**:
  - `GameView._activateGame` (mount and `onBeforeRouteUpdate`)
  - `App.vue` startup fallback
  - `GamesStore.getGame`
  - `UiStateStore.gameSession.openGameIds`

### SCN-NAV-03 - Reopen Recent Game from Home
- **Status**: Current
- **Goal**: Reopen a recently accessed game from the centred `HomeView` recent games list.
- **Preconditions**: One or more recent game entries exist for the home screen.
- **Entry Points**: `HomeView` recent games list.
- **Main Steps**:
  1. User lands on `HomeView`.
  2. App shows the action cards and, below them, up to three recent games with a `View all` link to the library.
  3. User selects a recent game entry.
  4. App activates an already-open workspace without replacing its unsaved state; otherwise it loads the latest managed save for the selected group.
  5. App opens the loaded game as the active context and routes to it.
- **Branch Paths**:
  - `BR-NAV-03-MISSING-ENTRY`: The selected recent entry no longer resolves -> show the error, reload the recent list and keep the user on `HomeView`.
  - `BR-NAV-03-LOAD-FAIL`: Referenced game file is invalid or unreadable -> show the load error inline and reload the recent list.
- **Postconditions**: A valid recent entry opens as the active game; invalid recent entries are removed without breaking the home screen.
- **Implementation Touchpoints**:
  - `HomeView._openRecent`
  - `RecentGameStore.getRecentGames`
  - `SavedGamesStore.loadRecentGame`
  - `SavedGameIndexService.getLatestSaveEntryForGame`
  - `GamesStore.insertGame`
  - `SerializationService.readGameDocument`
  - `UiStateStore.openTab`

### SCN-NAV-04 - Use the Navigation Rail or Mobile Drawer
- **Status**: Current
- **Goal**: Reach route actions from a compact desktop rail or, on narrow screens, an overlay drawer.
- **Preconditions**: A game, library or settings route is shown.
- **Entry Points**: The menu toggle in `NavigationFrame`.
- **Main Steps**:
  1. On desktop, the user toggles the left rail between icons and labelled actions.
  2. At narrow widths, the icon-only top bar opens a navigation drawer containing the same brand, actions and footer.
  3. Selecting a drawer action closes the drawer and runs the action through its normal owner, including timed-game menu interruption.
- **Branch Paths**:
  - `BR-NAV-04-DISMISS`: Backdrop, Escape or the close action dismisses the drawer without running an action.
  - `BR-NAV-04-REPLACED`: Another modal opens -> it replaces the drawer.
- **Postconditions**: Route actions remain reachable at every supported width. The expanded rail preference lasts for the current launch only.
- **Implementation Touchpoints**:
  - `NavigationFrame._openDrawer`
  - `NavigationMenuModal`
  - `UiStateStore.toggleNavigationExpanded` / `UiStateStore.navigationExpanded`

---
## Move Execution and History Branching

### SCN-MOVE-01 - Legal Move on Board
- **Status**: Current
- **Goal**: Execute a legal player move and update all dependent state.
- **Preconditions**: Active game in playable state; user turn.
- **Entry Points**: Chessboard click-click or drag-drop.
- **Main Steps**:
  1. User selects piece.
  2. UI highlights legal destinations.
  3. User submits destination square.
  4. Move legality is validated.
  5. Game state, history, clocks and the captured material shown in each player strip update.
  6. Analysis is queued/refreshed for resulting position.
- **Branch Paths**:
  - `BR-MOVE-01-STALE-POS`: If the board position or input permission changed before submission (race), the stale board callback is ignored, the selection clears and legal targets are regenerated for the new position.
  - `BR-MOVE-01-GAME-OVER`: If a move causes checkmate, stalemate or insufficient material, record the rule-resolved result, stop both live clocks, transition to finished review and announce the result ([SCN-CTRL-06](#scn-ctrl-06---announce-the-game-result)). Retain checkmate as detailed-move and derived-position check state when applicable. History review preserves the recorded result; finished review offers history navigation but no Takeback control (see [SCN-CTRL-01](#scn-ctrl-01---takeback-action)).
- **Postconditions**: Move is committed once, reflected across board/history/clock/analysis.
- **Implementation Touchpoints**:
  - `Chessboard.moveAttempted`
  - `GameRuleUtility.genLegalMovesForPiece`
  - `GameView._requestMoves`
  - `GamesStore.makeMove`
  - `GameMoveComposable.resolveMove`
  - `GamePlayerTurnComposable.attemptPlayerMove`
  - `GameMoveComposable.commitLiveMove`
  - `MoveHistoryService.addMainlineMove`
  - `TimeControlService.applyMove`
  - `GameAnalysisComposable.refreshAnalysisForGame`
  - `GameAnalysisComposable._subscribeToAnalysis` callback (subsequent engine response)

### SCN-MOVE-02 - Illegal Move Attempt
- **Status**: Current
- **Goal**: Reject illegal input without mutating game state.
- **Preconditions**: Active game; user attempts non-legal move.
- **Entry Points**: Chessboard move attempt.
- **Main Steps**:
  1. User attempts invalid target.
  2. Legality check fails.
  3. The board clears the selection without submitting; a rejected store submission shows a notice.
  4. Board/history/clocks remain unchanged.
- **Branch Paths**:
  - `BR-MOVE-02-SAME-SQUARE`: Click source again -> cancel selection.
  - `BR-MOVE-02-OUT-OF-TURN`: Attempt while not player turn -> in a human-versus-engine game the input becomes a premove ([SCN-MOVE-04](#scn-move-04---queue-premoves-against-an-engine)); otherwise the off-turn side's pieces cannot be selected, the board is disabled during engine-only turns, and a forced store submission is rejected with a notice.
- **Postconditions**: No state mutation on invalid move.
- **Implementation Touchpoints**:
  - `Chessboard._selectSquare` / `Chessboard._commitTarget`
  - `GameRuleUtility.genLegalMovesForPiece`
  - `GamesStore.makeMove`
  - `GameMoveComposable.resolveMove`

### SCN-MOVE-03 - Pawn Promotion Resolution
- **Status**: Current
- **Goal**: Resolve promotion piece selection before finalising the move.
- **Preconditions**: Legal pawn move reaches final rank.
- **Entry Points**: Chessboard move attempt resulting in promotion.
- **Main Steps**:
  1. User moves pawn to promotion rank.
  2. The board opens `PromotionModal` ("Choose promotion") with named queen, rook, bishop and knight choices for the moving colour. The board, history, captured material and turn stay unchanged until a choice is made.
  3. User selects piece type and the board interaction completes the chosen raw move (`IMoveRaw`).
  4. App submits that raw move through the normal `GamesStore.makeMove` path, which resolves the detailed move and updates history/clock.
- **Branch Paths**:
  - `BR-MOVE-03-CANCEL`: User selects Cancel, Escape, the backdrop or the close action -> no move is submitted, selection clears and another move may be selected.
- **Postconditions**: Promotion move is explicit and deterministic. A board, mode or permission change closes a pending chooser without submitting.
- **Implementation Touchpoints**:
  - `Chessboard._commitTarget` / `pendingPromotionMoves`
  - `useModal().open` / `PromotionModal._choosePromotion`
  - `Chessboard._choosePromotion` / `_emitMove` / `_clearSelection`
  - `GameRuleUtility.genLegalMovesForPiece` / `toDetailedMove`
  - `GamesStore.makeMove`
  - Rationale: [promotion modal flow](../ArchivedPlans/ModalComponentDesign.md#mod-f06---promotion)

### SCN-MOVE-04 - Queue Premoves Against an Engine
- **Status**: Current. Implemented through the existing local-turn request on 23 October 2026; see [executed verification](../ArchivedPlans/PreMovePlan%28ToDo%29.md#implementation-verification---23-october-2026).
- **Goal**: Prepare raw own-piece intentions during an engine turn and play one on each ordinary local-turn request.
- **Preconditions**: Ongoing unpaused human-engine game; following the live gameplay board, outside explicit Analyse.
- **Main Steps**:
  1. Board/PV input offers possible premoves and completed promotion. Append stores the supplied `IMoveRaw` reference and publishes, with no copy, projection or duplicate checks. Rendering separately derives final displaced pieces and red endpoints on one detached board.
  2. Actual opponent commits revalidate the whole FIFO. The existing local-turn request validates and shifts its head, then submits fresh actual details through existing `attemptPlayerMove`.
  3. The existing handler commits or holds genuinely paused output; existing finalisation requests the successor. Analysis/history review keeps its canonical selected board while actual play continues.
  4. Right-click, touch tap on a premoved piece or owned Escape clears all remaining intentions without changing actual history.
- **Branch Paths**:
  - Actual progression invalidating an accepted dependency or due head clears the entire FIFO. Possible targets belong to input/rule generation, so append does not reject or recheck supplied moves.
  - Manual/Menu pauses retain intentions/held output and keep the existing Resume flush. Explicit paused analysis remains available.
  - Hotseat/engine-engine exclude premoves. Actual structural/result changes and explicit tab close clear the affected queue; temporary navigation and in-memory save retain it. Restored games have no queue.
- **Postconditions**: No speculative history, clock/increment, capture totals, analysis position or persisted data. Only actual commits produce those effects.
- **Implementation Touchpoints**:
  - `GamesStore.makeMove` / `GamePremoveComposable.appendPremove`
  - `GamePremoveComposable.revalidatePremoves` / `GamePremoveComposable.clearPremoves`
  - `GamePlayerTurnComposable._tryPremove` / `GamePlayerTurnComposable.attemptPlayerMove`
  - `GamePositionComposable.getPremoveProjection` (via `GameView` `renderedBoard`)
  - `Chessboard.premovesCancelled` / `GamesStore.clearPremoves`
  - [14 flows and 25 scenario specifications](../ArchivedPlans/PreMovePlan%28ToDo%29.md#function-flow), [runtime FIFO design](../ArchivedPlans/PremoveDataStructure.md). Turn registration, resolution, completion and engine delivery remain the existing mechanism.

### SCN-HIST-01 - Navigate Move History Node
- **Status**: Current
- **Goal**: Review any prior position from move tree.
- **Preconditions**: Game has at least one move.
- **Entry Points**: History panel node click, `Start position` and `Live position`, and the control-panel First/Previous/Next/Last move buttons in in-game analysis, free analysis and finished review.
- **Main Steps**:
  1. User clicks node in history tree or a navigation button.
  2. App navigates board state to selected node.
  3. Analysis panel switches to selected FEN context while live play and its clock continue independently.
  4. The sidebar shows current-position evaluation or analysis without a separate recorded-analysis list. Actual-move records remain in saved game data. Start position selects the root; Live position returns to the actual live node even after restoring a reviewed branch. Next/Last follow the mainline child.
- **Branch Paths**:
  - `BR-HIST-01-NODE-MISSING`: Selected node is stale or missing from the current hydrated tree -> ignore it without changing the selection.
  - `BR-HIST-01-ENGINE-DATA-MISS`: No analysis for that node -> show empty/queued state.
  - `BR-HIST-01-PAUSED`: Manual/Menu pauses block ordinary history navigation; explicit paused analysis permits it while actual play remains paused.
- **Postconditions**: Board and analysis context match the selected history node without changing the live clock.
- **Implementation Touchpoints**:
  - `HistoryPanel.nodeSelected` / `GameControlPanel.nodeSelected`
  - `GameView._navigateToNode`
  - `GamesStore.navigateToNode` / `GameMoveComposable.navigateToNode`
  - `MoveHistoryService.getMoveSequence` / `MoveApplicationService.genPosition`
  - `GamesStore.getVisibleAnalysis`
  - `GamesStore.getGame`

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)
- **Status**: Current
- **Goal**: Convert review position into new active mainline when rules allow takeback.
- **Preconditions**: User is on a prior node of the actual live line; the current game's takeback policy allows live-mainline rewrite.
- **Entry Points**: Move made from a non-terminal historical node, by board input or the first move of a selected PV.
- **Main Steps**:
  1. User navigates to old node.
  2. User makes legal move from old node.
  3. App asks "Continue from this position?"; confirming treats the action as mainline continuation.
  4. App clears premoves and the old actual turn, moves the live anchor to the selected node, restarts the clock from that node's snapshot and promotes the new continuation to the main branch.
  5. The old future line remains in the move tree as a visible variation.
- **Branch Paths**:
  - `BR-HIST-02-CONFIRM-REWRITE`: Require confirmation before changing which continuation is marked as mainline.
  - `BR-HIST-02-DECLINE-REWRITE`: User declines rewrite -> move canceled, remain in review.
- **Postconditions**: Mainline pointer changes to the new continuation, while the old continuation remains visible as a variation.
- **Implementation Touchpoints**:
  - `GameView._requestMoves` / `GameView._confirmContinuation`
  - `useModal().open` (`ConfirmationModal`)
  - `GamesStore.makeMove` / `GamesStore._commitHistoryRewriteMove`
  - `GameMoveComposable.commitHistoryMove`
  - `MoveHistoryService.addMainlineMove`

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)
- **Status**: Current
- **Goal**: Allow history exploration without altering live game progression.
- **Preconditions**: User on prior node; takeback disabled.
- **Entry Points**: Explicit Analyse on the selected historical move, then a move.
- **Main Steps**:
  1. User navigates to old node. Board and PV input stay disabled in ordinary history review.
  2. User presses Analyse, then makes a legal move.
  3. App records move as analysis branch only.
  4. User can return to live game node.
- **Branch Paths**:
  - `BR-HIST-03-AUTO-RETURN`: Explicit Analyse never auto-exits; return requires Exit or Live position. The Gameplay setting `analysisBranchExitBehaviour` ("After exploring history") is stored but has no runtime consumer.
  - `BR-HIST-03-STAY-BRANCH`: App remains on branch until user explicitly returns.
- **Postconditions**: Live game line preserved; analysis branch captured separately.
- **Implementation Touchpoints**:
  - `GameControlPanel.analysisRequested` / `GamesStore.enterInGameAnalysis`
  - `GamesStore.makeMove` / `GameMoveComposable.commitLiveAnalysisMove`
  - `MoveHistoryService.addAnalysisMove`
  - `GamesStore.navigateToNode`
  - `GamesStore.exitInGameAnalysis`

### SCN-HIST-04 - Automatic Pruning After Live Move From The Latest Node
- **Status**: Current
- **Goal**: Run the automatic pruning action that removes exploratory in-game-analysis continuations from the latest live node once real play resumes from that same node.
- **Preconditions**: User entered in-game analysis from the latest live node, created at least one analysis-only continuation, and then exited back to the live node.
- **Entry Points**: Real move committed from the latest live node after leaving in-game analysis.
- **Main Steps**:
  1. User enters in-game analysis while already on the latest live node.
  2. App records exploratory moves as analysis-only continuations without advancing the live game.
  3. User exits in-game analysis and app restores the live node while the exploratory continuation still remains visible as a variation.
  4. User makes a real live move from that same latest node.
  5. App runs the automatic pruning action, discarding the superseded analysis-only descendants before committing the new live continuation.
- **Branch Paths**:
  - `BR-HIST-04-NO-CLEANUP`: Analysis did not originate from the latest live node, live play resumed from a different node, or the selected board is still on a branch below that node (an active analysis branch while actual play continues) -> no automatic cleanup path runs.
  - `BR-HIST-04-NO-ANALYSIS-CHILDREN`: No exploratory descendants remain at the node -> commit the live move without pruning first.
- **Postconditions**: Prompt-free analysis exit is preserved, temporary latest-node analysis continuations remain inspectable until superseded, and real play resumes on a clean live continuation after the automatic pruning action runs. Historical rewrites covered by `SCN-HIST-02` retain previously played continuations as variations.
- **Recording boundary**: These exploratory continuations do not create recorded-analysis entries. Pruning them must preserve actual game moves and their associated analysis records; exploratory retention is not a prerequisite for the recording feature.
- **Capture baseline**: An actual move copies available pre-move engine analysis onto its own node at commit, including engine identity, timestamp, depth, scores and principal variations, but only when the live position is the selected board. No available output means no record; analysis from another rendered position is never copied. Review and save/reload retain these independent snapshots.
- **Implementation Touchpoints**:
  - `MoveHistoryService.pruneFutureMoves`
  - `GameMoveComposable.commitLiveMove`
  - `GameAnalysisComposable.captureMoveAnalysis`
  - `GamesStore.exitInGameAnalysis`
  - `GamesStore.makeMove`

---
## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context
- **Status**: Current
- **Goal**: Open a non-live chess workspace where the user can explore positions before starting a real game.
- **Preconditions**: User creates a flow with at least one side unassigned, reassigns one side of an existing live game to `none`, or opens a dedicated setup path.
- **Entry Points**: Custom game `Free analysis` or an unassigned side, Quick game with an unassigned default seat, or player reassignment to `none` from a live game.
- **Main Steps**:
  1. User enters free analysis / setup context.
  2. App gives the user move control for both colors.
  3. If analysis engines are assigned, app refreshes analysis after each committed move.
  4. User explores legal moves without progressing a live game.
- **Branch Paths**:
  - `BR-FREE-ANALYSIS-01-ENGINE-NOT-RUNNING`: Engine start fails -> keep the setup context usable and show actionable error.
  - `BR-FREE-ANALYSIS-01-NO-ENGINES`: If no engines were configured, free analysis remains available without evaluation lines.
- **Postconditions**: User can explore, analyze, and prepare a starting position before a real game begins.
- **Implementation Touchpoints**:
  - `GamesStore.createGame`
  - `GamesStore.reassignPlayer`
  - `GamesStore.makeMove` / `GameMoveComposable.commitStandaloneAnalysisMove`
  - `GamesStore.getVisibleAnalysis`
  - `GameAnalysisComposable.refreshAnalysisForGame`

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup
- **Status**: Current
- **Goal**: Let the user directly edit the board position and clear move history while in free analysis / setup.
- **Preconditions**: Free analysis / setup context is active.
- **Entry Points**: Control panel `Edit board`.
- **Main Steps**:
  1. User enters board-editing mode from free analysis / setup; running analysis stops.
  2. User picks a colour and piece in the position editor, then clicks squares to toggle pieces, drags to relocate, right-clicks to remove, or uses Clear/Reset.
  3. Entering without an effective edit preserves history. On the first actual board edit, app clears existing move history, including when its root is selected, and treats the edited visible board as the new root position. Reset always replaces the root with the standard start position.
  4. Later board edits in the same board-edit session continue mutating that new root directly.
  5. User selects Finish editing; app returns to free analysis with the visible position's side to move.
  6. If analysis engines are assigned, including assignments added during editing, app requests analysis for the edited position after board editing ends.
- **Branch Paths**:
  - `BR-FREE-ANALYSIS-02-FIRST-EDIT-CLEAR`: If history exists, the first actual board edit discards it immediately as the edited board becomes the new root.
  - `BR-FREE-ANALYSIS-02-ENGINE-REFRESH-FAIL`: If engines cannot refresh on the edited position, keep the edited board and show evaluation as unavailable.
- **Postconditions**: The edited position becomes the current free-analysis root through direct board edits, old move history is removed on the first edit, and analysis resumes after board editing ends. History, player selection, refresh/retry and gameplay actions are unavailable while editing.
- **Implementation Touchpoints**:
  - `GameControlPanel._toggleBoardEdit`
  - `GamesStore.enterBoardEdit`
  - `GamesStore.toggleChessPiece`
  - `GamesStore.moveChessPiece`
  - `GamesStore.deleteChessPiece`
  - `GamesStore.clearBoard`
  - `GamesStore.resetBoardToStartPosition`
  - `GameBoardEditComposable._applyEdit`
  - `GameMoveComposable.replaceWithAnalysisRoot`
  - `GameAnalysisComposable.refreshAnalysisForGame`

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup
- **Status**: Current
- **Goal**: Turn the current free-analysis position into the starting point of a real game.
- **Preconditions**: Free analysis / setup context is active.
- **Entry Points**: Control panel `Start game` in free analysis / setup.
- **Main Steps**:
  1. User finishes preparing a position in free analysis / setup.
  2. App opens `GameCreationModal` ("Start from this position"). Both seats are required and start as Local; the name, assistance preferences and analysis assignments come from the prepared game, and the clock from the accepted defaults.
  3. User selects time control, players, random colours and the per-game live-analysis move preference.
  4. App keeps the current board position as the starting position of the new game.
  5. App preserves the prior analysis history in the move tree.
  6. App transitions into normal live-game behaviour for the started game.
- **Branch Paths**:
  - `BR-FREE-ANALYSIS-03-INVALID-ENGINE`: If a required engine for the started game is unavailable, block the transition until setup is corrected.
  - `BR-FREE-ANALYSIS-03-CANCEL`: User cancels start-game flow -> remain in free analysis / setup.
- **Postconditions**: A real game begins from the prepared position, and the earlier free-analysis history remains available.
- **Implementation Touchpoints**:
  - `GameControlPanel._requestSetupStart`
  - `useModal().open`
  - `GameCreationModal._submit` / `GameCreationModal._validateRequiredEngines`
  - `GamesStore.startGameFromSetup`
---
## Analysis and Engine Interaction

### SCN-ANALYSIS-01 - Start Single Engine Analysis
- **Status**: Current
- **Goal**: Start evaluation for current position with one engine.
- **Preconditions**: Engine configured and available.
- **Entry Points**: Analysis panel `Refresh analysis`, `Add engine`, the game-result `Start analysis` action, or automatic refresh after a move, navigation, creation or restore when analysis engines are assigned.
- **Main Steps**:
  1. User starts analysis manually, or analysis is auto-triggered after a move.
  2. `GameAnalysisComposable.refreshAnalysisForGame` clears each target seat's rendered lines and ensures the relevant engine sessions are running.
  3. `EngineRuntimeService` ensures the process lifecycle through the host's process manager (native process or Worker, by the profile's `EngineClientType`) and starts the ongoing engine search through the UCI engine client.
  4. `EngineRuntimeService` receives typed updates from the engine client and passes them back to the game-owned analysis flow.
  5. App stores updated best lines and scores each time the engine reports an improvement or deeper search result.
  6. Analysis panel refreshes over time to show score and search progress for that engine, plus up to `3` visible lines when the current workspace context allows rendered move targets. Each line shows a truncated move preview that expands to the full line.
- **Branch Paths**:
  - `BR-ANALYSIS-01-ENGINE-NOT-RUNNING`: Engine start fails -> show actionable error and keep UI responsive.
  - `BR-ANALYSIS-01-PARSE-FAIL`: Output parse fails -> skip bad line and continue listening.
  - `BR-ANALYSIS-01-AUTO-ON-MOVE`: If analysis engines are assigned, refresh analysis automatically after each committed move in either free analysis / setup or in-game analysis mode.
  - `BR-ANALYSIS-01-LIVE-SCORE-ONLY`: In an ongoing `liveGame` context, the current game's live-analysis preference may select compact Evaluations rows with engine names and scores, without folds or PV moves. Engine searches continue. Finished review always shows move lines.
  - `BR-ANALYSIS-01-POSITION-CHANGED`: If the board position changes while the engine is still searching, stop or supersede the old search and begin streaming updates for the new position.
  - `BR-ANALYSIS-01-ENGINE-FOLDED`: If the user folds that engine group, new results continue updating in the background and become visible again when expanded.
  - `BR-ANALYSIS-01-PAUSED`: If live play is paused after analysis search has already started, the current search may finish and update the seat's rendered results. Paused state still blocks move commits and, outside explicit paused analysis, move-target clicks, but non-gameplay analysis controls such as refresh, retry, stop, and engine-roster management remain allowed.
  - `BR-ANALYSIS-01-TERMINAL-POSITION`: The selected board is the live position of a game ended by checkmate or stalemate -> refresh stops the seats instead of searching a position with no legal move.
- **Postconditions**: The latest valid eval for the active position is available on the game-owned analysis data, and it may continue to improve while the engine keeps searching even when the panel renders score-only rows.
- **Implementation Touchpoints**:
  - `AnalysisPanel` `Refresh analysis` action
  - `GamesStore.refreshAnalysis`
  - `GameAnalysisComposable.refreshAnalysisForGame` / `GameAnalysisComposable._subscribeToAnalysis`
  - `EngineRuntimeService.startAnalysis`
  - `GamesStore.getVisibleAnalysis`
  - `ExpandableText`

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis
- **Status**: Current
- **Goal**: Compare multiple engines on same position concurrently.
- **Preconditions**: Two or more engines configured.
- **Entry Points**: Assigning two or more analysis engines at creation, in Quick game defaults, or through Add engine.
- **Main Steps**:
  1. User enables selected engines.
  2. App starts each selected engine session.
  3. App dispatches position to all selected engines.
  4. Each engine continues searching and emits updated best lines over time.
  5. Each assigned engine retains unrestricted runtime lines. Its game subscription replaces the seat's rendered results with the best three lines in engine rank order. Position changes clear those results and supersede the service operation; no analysis position key or visible-result filter is used.
  6. Analysis panel renders one row/group per engine, always shows score/status, shows up to `3` visible lines only when the current workspace context allows rendered move targets, and updates each row independently as new output arrives.
- **Branch Paths**:
  - `BR-ANALYSIS-02-PARTIAL-FAIL`: One engine fails, others continue with per-engine error badge.
  - `BR-ANALYSIS-02-TOO-MANY`: Four analysis engines are assigned -> disable Add and reject any additional assignment; existing engines continue independently.
  - `BR-ANALYSIS-02-DESYNC`: Engines report at different rates/depths -> panel keeps latest result from each engine without waiting for synchronized updates.
  - `BR-ANALYSIS-02-LIVE-SCORE-ONLY`: In live-game contexts where `showLiveAnalysisMoves = false`, compact Evaluations rows still update independently without rendering move lists, folds or status/depth summaries.
  - `BR-ANALYSIS-02-FOLD-ONE`: Folding one engine group hides only that engine's visible lines and does not affect the other engine groups.
  - `BR-ANALYSIS-02-PAUSED`: If live play is paused after multi-engine search has already started, each current search may finish independently and update its seat's rendered results, while move-target clicks remain blocked until resume unless the user explicitly enters paused analysis.
- **Postconditions**: Partial availability does not block full analysis feature, and each engine can improve its displayed line independently over time.
- **Implementation Touchpoints**:
  - `EnginesStore.listConfiguredEngines`
  - `GamesStore.refreshAnalysis`
  - `GameAnalysisComposable._subscribeToAnalysis` callback
  - `GamesStore.getVisibleAnalysis`
  - `EngineRuntimeService.startAnalysis`
  - `EngineRuntimeService.subscribeToAnalysis`
  - `UiStateStore.setAnalysisEngineExpanded` / `UiStateStore.setSectionCollapsed`

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis
- **Status**: Current
- **Goal**: Handle runtime engine interruptions safely.
- **Preconditions**: Active analysis session exists.
- **Entry Points**: Unexpected process exit or the per-engine `Stop engine` action.
- **Main Steps**:
  1. Engine exits or user stops it.
  2. User Stop marks the search stopped and keeps the reusable process or Worker. Unexpected exits surface when the next engine operation checks or uses that process handle.
  3. Existing cached evaluations remain visible as the last known result for that engine.
  4. User can restart a stopped seat with Refresh, or use Retry on a failed seat.
- **Branch Paths**:
  - `BR-ANALYSIS-03-RETRY-SUCCESS`: Restart succeeds and analysis resumes.
  - `BR-ANALYSIS-03-RETRY-FAIL`: Restart fails repeatedly -> the seat stays failed with its error; Retry and Remove engine remain available. No automatic reconnect is attempted.
- **Postconditions**: Engine failures are isolated and recoverable, and the last streamed best line remains visible until replaced by a new search.
- **Implementation Touchpoints**:
  - `AnalysisPanel._stop` / `AnalysisPanel._retry`
  - `GamesStore.stopAnalysis`
  - `EngineRuntimeService.stopAnalysis`
  - `GamesStore.retryAnalysis`
  - `GamesStore.getVisibleAnalysis`

### SCN-ANALYSIS-04 - Click Suggested Move from Analysis Panel
- **Status**: Current
- **Goal**: Let the user inspect or apply engine moves from the analysis panel according to the current workspace context.
- **Preconditions**: At least one analysis line is available in a context that renders move targets.
- **Entry Points**: A line preview in the analysis panel; its expanded full line exposes each move as a button.
- **Main Steps**:
  1. User opens a line preview to show the full line, then clicks a move inside it.
  2. In `freeAnalysisSetup`, app plays move animation through the suggested moves up to the selected move and applies them as analysis moves.
  3. In `liveGame + inGameAnalysis`, app does the same only when that live game enables rendered move targets, and the live node still does not advance.
  4. In `liveGame + livePlay`, app submits only the first move of the selected prefix as the current live turn, even when a later PV move was clicked, and only when that live game enables rendered move targets.
  5. In `liveGame + historyReview`, app reuses the ordinary history-move policy only when that live game enables rendered move targets: with takeback allowed, the first move asks for rewrite confirmation ([SCN-HIST-02](#scn-hist-02---continue-from-historical-node-takeback-allowed)).
  6. Board, history, clocks, and analysis update according to the resulting context.
- **Branch Paths**:
  - `BR-ANALYSIS-04-MOVE-STALE`: Selected prefix is no longer legal from the current node -> reject the entire prefix before applying any move and show a notice asking the user to Refresh analysis.
  - `BR-ANALYSIS-04-LIVE-SCORE-ONLY`: In an ongoing live game where `showLiveAnalysisMoves = false`, including in-game analysis, no move target is rendered from the analysis panel. Finished review renders move targets.
  - `BR-ANALYSIS-04-HISTORY-ANALYSIS-ONLY`: In `liveGame + historyReview` with `game.gameplayOptions.allowTakeback = false`, PV targets stay disabled; after explicit Analyse the selected continuation is applied as an analysis-only branch and the live node stays unchanged.
  - `BR-ANALYSIS-04-APPLY-AS-BRANCH`: In free analysis, in-game analysis and finished review, the played prefix is kept as an analysis branch.
  - `BR-ANALYSIS-04-PAUSED`: Ordinary paused suggestions remain read-only; explicit paused analysis permits full-prefix playback while actual play stays paused.
  - `BR-ANALYSIS-04-PREMOVE`: During the engine's turn in a human-versus-engine game, a clicked own-colour move that is a possible premove from the projected board is appended to the premove queue ([SCN-MOVE-04](#scn-move-04---queue-premoves-against-an-engine)); opponent-colour moves are ignored.
- **Postconditions**: Suggested moves are interactive only where the workspace policy allows them, `freeAnalysisSetup` always retains move inspection, live-game clicks reuse the same context-specific move rules as ordinary move entry, and no separate panel-only rewrite rule is introduced. Route, mode and game changes cancel an unfinished playback.
- **Implementation Touchpoints**:
  - `ExpandableText` / `AnalysisPanel._selectMoves` / `AnalysisPanel.moveSelected`
  - `GameView._playAnalysisLine` / `GameView._requestMoves` / `GameView._applyMoves`
  - `GameRuleUtility.isMoveLegal`
  - `GamesStore.makeMove`
  - `MoveHistoryService.addAnalysisMove`
  - `GamesStore.getGame`

### SCN-ANALYSIS-05 - Add or Remove Per-Game Analysis Engine During Game
- **Status**: Current
- **Goal**: Manage the current game's ordered analysis-engine rows from the analysis panel without changing other games.
- **Preconditions**: Active game exists; at least one configured engine profile may be available.
- **Entry Points**: Analysis panel title-row `Add engine` (`+`) action or the empty-state `Add engine` button; per-engine `Remove engine` action.
- **Main Steps**:
  1. User clicks `Add engine`.
  2. App opens `AnalysisEngineSelectionModal` ("Add analysis engine") scoped to the current game.
  3. User selects an accepted engine profile that is not already present, by display name, in the current game's copied analysis-engine rows.
  4. App records a new copied per-game analysis-engine row.
  5. If the current `gameState` allows analysis, app starts analysis for that engine on the highlighted position.
  6. User may later click `Remove engine` on that engine group's title row.
  7. App stops that engine's runtime for the current game, removes that engine from the current game's ordered analysis rows only, and removes its stored fold state.
- **Branch Paths**:
  - `BR-ANALYSIS-05-DUPLICATE`: Selected engine is already present on this game -> it is not offered, and a duplicate add is rejected with current rows unchanged.
  - `BR-ANALYSIS-05-LIMIT`: Adding the engine would exceed the supported limit of four concurrent analysis engines, or every profile is already assigned -> Add is disabled and a direct add is rejected.
  - `BR-ANALYSIS-05-START-FAIL`: Added engine cannot start for the current position -> keep the assignment with unavailable feedback and allow retry or removal.
  - `BR-ANALYSIS-05-BOARD-EDIT`: Current workspace is in `boardEdit` -> the seat is added without starting; analysis starts after board editing ends.
  - `BR-ANALYSIS-05-PAUSED`: Current workspace is paused live -> keep move-target clicks blocked outside explicit paused analysis, but still allow add, remove, refresh, retry, and stop actions because those analysis controls are treated as non-gameplay management.
- **Postconditions**: The current game's ordered copied analysis-engine rows update independently from other games, and those copied engines begin or end analysis accordingly.
- **Implementation Touchpoints**:
  - `AnalysisPanel._addEngine` / `AnalysisPanel._remove`
  - `useModal().open`
  - `AnalysisEngineSelectionModal._confirmAnalysisEngine`
  - `GamesStore.addAnalysisEngine`
  - `GamesStore.retryAnalysis`
  - `GamesStore.removeAnalysisEngine`
  - `UiStateStore.setLayoutState` / `UiStateStore.saveLayoutState`

---

## Time Control and Game Controls

### SCN-TIME-01 - Clock Ticks During Play
- **Status**: Current
- **Goal**: Decrease active side clock in real time.
- **Preconditions**: Time control enabled; game not paused/ended.
- **Entry Points**: Game in progress.
- **Main Steps**:
  1. Turn begins for active side.
  2. The `GameView` 250 ms timer acts only as render cadence and requests an authoritative remaining-time read.
  3. `TimeControlService` recalculates the remaining time from the stored clock snapshot and current timestamp.
  4. The UI renders that authoritative remaining-time read, with tenths below ten seconds.
  5. Move submission transfers active timer ownership through the normal move-commit path.
- **Branch Paths**:
  - `BR-TIME-01-BACKGROUND-THROTTLE`: App tab or window inactive -> on focus return, the registered focus callback synchronises the clock from timestamps.
  - `BR-TIME-01-SYNC-DRIFT`: Drift detected -> normalize to authoritative relative time model.
- **Postconditions**: Clock remains consistent through normal and throttled runtime conditions.
- **Implementation Touchpoints**:
  - `GameView` clock timer and `GameView._reconcileGameEnd`
  - `TimeControlService.getRemainingTime`
  - `TimeControlService.applyMove`
  - `GameClockComposable.refreshRuntimeRegistrations` / `PlatformEventService.subscribeToAppFocusReturned`
  - `PlayerPanel.clockText`

### SCN-TIME-02 - Pause and Resume Clocks
- **Status**: Current
- **Goal**: Temporarily stop game timing and resume safely.
- **Preconditions**: Timed game in progress with a running clock. Untimed games expose no Pause control.
- **Entry Points**: Game control `Pause` in live play or in-game analysis; `Resume game` while paused.
- **Main Steps**:
  1. User clicks `Pause`.
  2. App freezes the clock snapshot, marks paused state and blocks board/history/gameplay mutations. Existing analysis output, engine management and explicit Analyse/Exit analysis remain available.
  3. User clicks `Resume game`.
  4. App restores active timer without losing elapsed data.
  5. If an already validated player-engine move became ready while paused, app commits it after pause clears only when the live turn is still ready; otherwise app discards it. It does not repeat legality validation or pondering because pause did not change the live position and the engine-boundary work has already completed.
  6. A restored paused game requires explicit Resume. Restored paused analysis reconstructs Manual only; explicit Resume restarts actual play while analysis remains selected. Exit never resumes actual play.
- **Branch Paths**:
  - `BR-TIME-02-DOUBLE-PAUSE`: Pause clicked while already paused -> no-op.
  - `BR-TIME-02-RESUME-GAME-OVER`: Resume attempt after game end -> blocked. A clock that expired while paused finalises the timeout instead of resuming.
  - `BR-TIME-02-ANALYSIS-READY-WHILE-PAUSED`: An analysis engine finishes while paused -> latest evaluation may update read-only, but no gameplay mutation occurs.
- **Postconditions**: Pause state is explicit and non-destructive, the game surface stays locked while paused, and any engine output produced during pause is deferred or read-only until resume.
- **Implementation Touchpoints**:
  - `GameControlPanel._setPaused`
  - `GamesStore.pauseGame` / `GameClockComposable.pauseGame`
  - `GamesStore.resumeGame` / `GameClockComposable.resumeClockState`
  - `GamePlayerTurnComposable.flushDeferredPlayerMove`
  - `TimeControlService.pauseClock` / `TimeControlService.resumeClock`
  - `TimeControlService.getRemainingTime`

### SCN-TIME-03 - Increment Applied After Move
- **Status**: Current
- **Goal**: Apply the configured per-move increment correctly.
- **Preconditions**: Incremental time control configured.
- **Entry Points**: Successful move commit.
- **Main Steps**:
  1. User completes legal move.
  2. App calculates elapsed time for mover.
  3. App adds the configured increment exactly once to the mover and starts the opponent's clock.
  4. UI updates both clocks.
- **Branch Paths**:
  - `BR-TIME-03-NO-INCREMENT`: Preset has zero increment -> skip add step. Named presets (Bullet, Blitz, Rapid, Classical) have zero increment; only Custom sets one.
  - `BR-TIME-03-INVALID-CONFIG`: Invalid increment config -> creation and settings validation reject it ("Enter an increment between 0 and 300 seconds."), so no game starts with it; there is no silent fallback.
- **Postconditions**: Clock math follows selected time-control policy.
- **Implementation Touchpoints**:
  - `TimeControlService.applyMove` / `GameClockComposable.applyMove`
  - `GamesStore.makeMove`
  - `getGameClockError` (`GameCreationUtility`)

### SCN-TIME-04 - Timeout Ends Game
- **Status**: Current
- **Goal**: Finish game automatically when a player runs out of time.
- **Preconditions**: Clock reaches zero for active side.
- **Entry Points**: Timer tick, focus return or move processing.
- **Main Steps**:
  1. A UI timer tick or move-processing boundary asks for an authoritative remaining-time read.
  2. If the time-control service reports expiry, the store clears the pending actual turn and finalises timeout once.
  3. App marks game result by time and announces it ([SCN-CTRL-06](#scn-ctrl-06---announce-the-game-result)).
  4. Further live moves and Resume cannot revive the finished turn; subsequent moves are review-only analysis.
  5. History and result metadata are stored on the game and included in later saves, autosaves and session restore.
- **Branch Paths**:
  - `BR-TIME-04-LAG-COMPENSATE`: Negative time due to render lag -> clamp to zero and finalize once.
  - `BR-TIME-04-ANALYSIS-ONLY`: Analysis mode still allowed after timeout while game result remains fixed.
- **Postconditions**: Timeout result is deterministic and prevents further live play.
- **Implementation Touchpoints**:
  - `GameView` clock timer and `GameView._reconcileGameEnd`
  - `TimeControlService.getRemainingTime` / `TimeControlService.hasExpired`
  - `GamesStore.syncClock` / `GameClockComposable.reconcileTimeout`
  - `GameStatusComposable.flagResultNotification`
  - `useModal().open` (`GameResultModal`)


### SCN-TIME-05 - Menu Actions Auto-Pause Timed Games
- **Status**: Current
- **Goal**: Prevent clocks from continuing to run while the user opens interrupting menus or modals from a timed game.
- **Preconditions**: Timed game is active; an interrupting menu or modal is triggered from the game screen.
- **Entry Points**: Game menu brand (Home), `Custom`, `Load`, `Save` and `Settings`. `Quick game` and `Close game` are not interruptions.
- **Main Steps**:
  1. User opens an interrupting menu or modal from active play.
  2. App checks whether auto-pause-on-menu is enabled for timed games.
  3. If enabled, app pauses the game before opening the interrupted flow.
  4. User completes or cancels the menu/modal flow.
  5. While paused, the game surface remains non-interactive apart from the eventual resume path, although any already running engine search may still finish under paused rules.
  6. Returning to the game route, or dismissing the Custom game dialog on the same game, removes only Menu ownership and resumes when no Manual owner remains. Selecting another game tab does not itself request a menu pause.
- **Branch Paths**:
  - `BR-TIME-05-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, the menu action proceeds without changing the clock state.
  - `BR-TIME-05-NON-TIMED-GAME`: If the game has no active clock, no pause action is required.
  - `BR-TIME-05-ALREADY-PAUSED`: If the game is already paused, menu flow continues without changing pause state.
  - `BR-TIME-05-ENGINE-READY-WHILE-AWAY`: A player engine or analysis engine finishes during the interruption -> keep analysis output read-only and defer any already validated player move until the paired resume path confirms that the live turn is ready; do not repeat the engine-boundary work merely because the UI was away.
- **Postconditions**: Menu-driven interruptions do not accidentally consume clock time when auto-pause-on-menu is enabled, the paused game surface remains inert during the interruption, and normal play resumes automatically on return. A game interrupted by Custom game that then creates another workspace stays paused until the user returns to it.
- **Implementation Touchpoints**:
  - `MenuBar.homeRequested` / `customNewGameRequested` / `loadGameRequested` / `saveGameRequested` / `settingsRequested`
  - `GameView._handleMenuInterruptionRequested`
  - `GameView._handleMenuInterruptionCompleted`
  - `GamesStore.pauseGame` / `GamesStore.resumeGame`
  - `TimeControlService.getRemainingTime`
  - `UiStateStore.saveGameSession`

### SCN-CTRL-01 - Takeback Action
- **Status**: Current
- **Goal**: Rewind one or more moves.
- **Preconditions**: At least one reversible move exists.
- **Entry Points**: Control panel `Takeback` in live play, in-game analysis and free analysis.
- **Main Steps**:
  1. User clicks `Takeback`.
  2. App applies takeback count policy: in a human-versus-engine game it rewinds to before the local player's latest move, including the engine reply; otherwise one ply. Free analysis takes back one ply from the selected node.
  3. App clears premoves and the pending actual turn and stops player engines.
  4. Board/history/clocks move back to target node. Every continuation below the retained node, including variations, is removed. A live game restarts the clock from that node's snapshot and requests the next turn.
- **Branch Paths**:
  - `BR-CTRL-01-NO-MOVES`: No moves available -> disable button/no-op.
  - `BR-CTRL-01-POLICY-BLOCK`: Takeback disabled by mode/rules -> the button is disabled and a direct request is rejected with a notice.
  - `BR-CTRL-01-PAUSED`: Game is paused -> block takeback until resume, including during explicit paused analysis.
  - `BR-CTRL-01-FINISHED`: The game has a recorded result -> finished review does not render Takeback. `GamesStore.takeBack` itself still rewinds a finished live game, and JRN-CLOCK-08 still expects to reopen a timed-out game through the UI Takeback control; that conflict is unresolved.
- **Postconditions**: Game state matches selected rewind point.
- **Implementation Touchpoints**:
  - `GameControlPanel.takeBackRequested`
  - `GamesStore.takeBack`
  - `GameMoveComposable.getTakeBackMoveCount` / `GameMoveComposable.rewind`
  - `MoveHistoryService.takeBack`
  - `TimeControlService.startClock` (restart from the retained node's snapshot)

### SCN-CTRL-02 - Resign Game
- **Status**: Current
- **Goal**: End game by resignation with confirmation.
- **Preconditions**: Active non-ended game.
- **Entry Points**: Control panel `Resign` in live play.
- **Main Steps**:
  1. User clicks `Resign`.
  2. App requests confirmation for the side to move on the live position.
  3. On confirm, game result set to resignation.
  4. App clears the pending actual turn and premoves, stops the clocks, disables live moves and announces the result ([SCN-CTRL-06](#scn-ctrl-06---announce-the-game-result)).
- **Branch Paths**:
  - `BR-CTRL-02-CANCEL`: User cancels confirmation -> game continues.
  - `BR-CTRL-02-ALREADY-ENDED`: Resign action blocked if game already ended.
  - `BR-CTRL-02-PAUSED`: Game is paused -> resign action is blocked until resume.
- **Postconditions**: Result is final and clearly visible; it is persisted by later saves, autosaves and session restore.
- **Implementation Touchpoints**:
  - `GameControlPanel._requestResignation`
  - `useModal().open` (`ConfirmationModal`)
  - `GamesStore.resignGame` / `GameStatusComposable.finaliseResignation`

### SCN-CTRL-03 - Draw Offer Flow
- **Status**: Current for the local-local confirmation and response flow, non-local outgoing offers and withdrawal, and acceptance of a recorded incoming offer. Adapter-delivered incoming offers and `BR-CTRL-03-REPEAT-OFFER` remain `Planned`.
- **Goal**: Support offering and resolving draw outcomes.
- **Preconditions**: Active non-ended game.
- **Entry Points**: Control panel `Offer draw` (labelled `Resolve draw` while an offer is pending) in live play.
- **Main Steps**:
  1. User clicks `Offer draw`.
  2. If the current game is local player versus local player, app opens a shared confirmation dialog for the offer intent.
  3. After a confirmed local-local offer, the store records the offer and app opens `DrawResponseModal` for the opposing local side; it cannot be dismissed without Accept or Decline.
  4. If the opponent is non-local, app records the unresolved offer without using a dialog-hosted response step, and the draw control shows a small LED-like pending-offer indicator while that outgoing offer remains unresolved.
  5. `Planned`: When a non-local draw offer is received while no unresolved offer is pending, the game workspace records that incoming offer and the same indicator lights. No adapter currently delivers offers; an incoming offer exists only in restored game data.
  6. If the user presses the draw control while the lit non-local indicator represents an incoming offer, app accepts immediately and the game is drawn.
  7. If the user presses the draw control while the lit non-local indicator represents an outgoing offer, app withdraws the outstanding offer and the game continues.
- **Branch Paths**:
  - `BR-CTRL-03-CANCEL`: User cancels the local-local offer confirmation -> no draw offer is recorded.
  - `BR-CTRL-03-DECLINED`: Local opponent declines in the draw-resolution dialog -> game continues.
  - `BR-CTRL-03-NON-LOCAL-NO-RESPONSE`: The current non-local adapter exposes no draw-response callback -> keep game ongoing until the user withdraws the outgoing offer, accepts an incoming offer through the lit indicator path, or another result path resolves it.
  - `BR-CTRL-03-REPEAT-OFFER`: `Planned`: repeated offer in short window -> throttled/blocked. No throttling exists.
  - `BR-CTRL-03-PAUSED`: Game is paused -> offer, accept, and withdraw draw actions are blocked until resume.
- **Postconditions**: Draw resolution is explicit; an accepted draw is announced ([SCN-CTRL-06](#scn-ctrl-06---announce-the-game-result)) and persisted by later saves.
- **Implementation Touchpoints**:
  - `GameControlPanel._handleDraw` / `GameControlPanel._offerDraw`
  - `useModal().open` (`ConfirmationModal`, `DrawResponseModal`)
  - `GamesStore.offerDraw`
  - `GamesStore.acceptDrawOffer`
  - `GamesStore.declineDrawOffer`
  - `GamesStore.withdrawDrawOffer`

### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode
- **Status**: Current
- **Goal**: Explicitly explore both sides from the selected move while actual play progresses independently.
- **Preconditions**: Active live workspace is open, including genuinely paused play; terminal review preserves its result.
- **Entry Points**: Control panel `Analyse` from a live game, or the paused `Analyse` button; `Exit analysis` to return.
- **Main Steps**:
  1. User enters in-game analysis mode.
  2. App gives the user move control for both colors.
  3. If analysis engines are assigned, app refreshes analysis after each committed move.
  4. User explores positions without exploratory input changing actual play. Actual turns/time continue unless genuinely paused.
  5. User exits in-game analysis mode and app returns to the live node immediately without prompting.
- **Branch Paths**:
  - `BR-CTRL-04-LATEST-NODE-VARIATION`: When analysis started from the latest live node, exploratory continuations may remain visible as variations until a later real live move supersedes them.
  - `BR-CTRL-04-LIVE-CONFLICT`: User board/PV input is analysis-only; actual provider replies continue against the live position without moving the selected board.
  - `BR-CTRL-04-PAUSED`: Allow entry, exploratory moves/history and Exit while preserving the actual pause and held output. Resume remains explicit.
- **Postconditions**: Mode boundaries are explicit, the user can explore from either side, and leaving the mode always returns the screen to the live game position without a keep-or-discard prompt.
- **Implementation Touchpoints**:
  - `GameControlPanel.analysisRequested` / `GameControlPanel.exitAnalysisRequested`
  - `GamesStore.enterInGameAnalysis` / `GameMoveComposable.enterInGameAnalysis`
  - `GameMoveComposable.commitLiveAnalysisMove` / `MoveHistoryService.addAnalysisMove`
  - `GamesStore.exitInGameAnalysis`
  - `GamesStore.navigateToNode`
  - `GamesStore.makeMove`

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode
- **Status**: Current. `BR-CTRL-05-GO-TO-SETUP` remains `Planned`.
- **Goal**: Prevent board editing tools from being used inside in-game analysis mode.
- **Preconditions**: A game with a live path is open, in live play, in-game analysis or finished review.
- **Entry Points**: Board-edit action attempted from in-game analysis mode.
- **Main Steps**:
  1. User looks for board editing while inside in-game analysis mode or finished review.
  2. App offers no `Edit board` control outside free analysis / setup, and `GamesStore.enterBoardEdit` ignores any game with a live path.
  3. `GameControlPanel._toggleBoardEdit` explains with a message dialog that board editing is only available in free analysis if invoked during in-game analysis; no current control reaches that path.
- **Branch Paths**:
  - `BR-CTRL-05-GO-TO-SETUP`: `Planned`: If the product offers a shortcut, user may leave the live game context and open free analysis / setup instead. No shortcut exists.
  - `BR-CTRL-05-CANCEL`: User dismisses the explanation and remains in in-game analysis mode.
- **Postconditions**: Live-game analysis remains move-based only; board editing stays isolated to free analysis / setup.
- **Implementation Touchpoints**:
  - `GameControlPanel._toggleBoardEdit`
  - `GamesStore.enterBoardEdit` / `GameBoardEditComposable.enterBoardEdit`
  - `useModal().open` (`MessageModal`)

### SCN-CTRL-06 - Announce the Game Result
- **Status**: Current
- **Goal**: Tell the user once that a game has ended and offer the next step.
- **Preconditions**: A live game ends by checkmate, stalemate, insufficient material, timeout, resignation or draw agreement.
- **Entry Points**: The result-producing action or the clock timeout.
- **Main Steps**:
  1. The finalising store action records the result and arms a one-shot runtime notification on the game.
  2. While that game is displayed, the `GameView` timer consumes the notification and opens `GameResultModal` ("Game over"), e.g. "Black wins by checkmate." or "Draw by agreement.".
  3. The dialog has no backdrop, Escape or close dismissal. The user chooses `Exit` (close this game's tab), `Start analysis` (refresh the game's analysis engines and stay on the final position) or `Save for analysis` (open the save route for this game).
- **Branch Paths**:
  - `BR-CTRL-06-RESTORED-RESULT`: A finished game is restored or loaded -> the notification is runtime-only, so no dialog appears.
  - `BR-CTRL-06-BACKGROUND-GAME`: The game ends while another game is displayed -> the notification stays armed and the dialog opens when that game is next displayed.
  - `BR-CTRL-06-ANALYSIS-FAIL`: `Start analysis` fails -> the error shows inline and the dialog stays open.
- **Postconditions**: Each ending is announced once; the finished board remains available for review.
- **Implementation Touchpoints**:
  - `GameStatusComposable.flagResultNotification` (from `updateGameResultFromLivePosition`, `finaliseResignation`, `finaliseDrawAgreement`) and `GameClockComposable` timeout finalisation
  - `GameView._reconcileGameEnd`
  - `useModal().open` / `GameResultModal`
  - `useGameTabActions().close` / `GamesStore.refreshAnalysis`

---
## Persistence, File I/O, Settings, and Engine Management

### SCN-SAVE-01 - Autosave Internal Save Entry
- **Status**: Current
- **Goal**: Update the dedicated internal autosave entry for the current game without routing to the save/load views.
- **Preconditions**: Active game exists; at least one autosave trigger is enabled.
- **Entry Points**: Configured move-count threshold reached or close flow begins.
- **Main Steps**:
  1. User commits moves or starts a close flow.
  2. App counts committed moves per in-memory game, including analysis moves, against `gameSession.autosaveAfterMoveCount`, and separately checks `gameSession.autosaveOnClose` when the host raises its app-close checkpoint. Save on close is forced on while Restore previous session is enabled.
  3. When a trigger applies, app snapshots the current game workspace state, including active position/history node, clocks, and result state.
  4. App serializes the canonical saved-game payload.
  5. App writes or replaces the `auto.json` entry in that game's folder beneath the configured save root. Close autosave writes every workspace game.
- **Branch Paths**:
  - `BR-SAVE-01-MOVE-COUNT-DISABLED`: `gameSession.autosaveAfterMoveCount = 0` -> move commits do not write an autosave entry.
  - `BR-SAVE-01-CLOSE-DISABLED`: `gameSession.autosaveOnClose = false` -> close flow does not write an autosave entry.
  - `BR-SAVE-01-WRITE-FAIL`: Autosave write fails -> keep in-memory state and show an "Automatic save failed" notice; a later trigger retries.
- **Postconditions**: The autosave entry is refreshed only when the configured trigger fires, and a later restore can reproduce the same game workspace state without depending on UI or engine runtime snapshots.
- **Implementation Touchpoints**:
  - `GameRecordComposable.moveCommitted` / `GamesStore.onAutosaveFailed`
  - `SavedGamesStore.registerAutosaveOnClose`
  - `SavedGamesStore.saveGame`
  - `SavedGameIndexService.getAutosaveFilePath`
  - `SerializationService.writeGameDocument`
  - `UserSettingService.getSettings`

### SCN-SAVE-02 - Open Internal Save View
- **Status**: Current
- **Goal**: Route to the ChessVue save view so the user can browse the current game's saves and stage an internal save.
- **Preconditions**: Active game exists.
- **Entry Points**: Game menu `Save`, the library navigation `Save` mode, and the game-result `Save for analysis` action.
- **Main Steps**:
  1. User chooses save action.
  2. If a timed game is active and auto-pause-on-menu is enabled, app pauses the game before entering the save flow.
  3. App routes to `/saved-games/save/:name` using the app-owned current game ID.
  4. The save view opens directly in the selected game's save-list screen rather than a transient dialog.
  5. The save list shows the autosave entry first, then a `Named saves` separator when autosave exists, then the remaining saves with save-name and date columns.
  6. The right panel shows a board preview and details for the selected save entry.
  7. The save-name text box receives focus on open, prefilled from the game name.
  8. The bottom-right action row shows `Cancel` and `Save game`; the navigation frame offers `Import file` and `Export`.
  9. While the save flow is open, the paused game surface stays inert and any player-engine move that becomes ready remains deferred until return.
  10. When the user returns to the game screen, app auto-resumes if the pause came from this save flow.
- **Branch Paths**:
  - `BR-SAVE-02-CANCEL`: User leaves the save view -> no save is written.
  - `BR-SAVE-02-NO-CURRENT-GAME`: If no current game exists, the route shows a usable empty state with Save and Export disabled.
  - `BR-SAVE-02-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, save proceeds without pausing the clock.
- **Postconditions**: The user reaches a consistent route-level save surface without leaving the app context, and the save screen is ready for creating or replacing a save entry for the current game.
- **Implementation Touchpoints**:
  - `MenuBar.saveGameRequested`
  - `GameView._handleMenuInterruptionRequested`
  - `router.push` (`save-game` route)
  - `SavedGamesView._refreshGroups` / `SavedGamesView._loadDetails`
  - `SavedGamesStore.listSavedGames` / `SavedGamesStore.loadGame`
  - `GamesStore.getGame`
  - `SavedGameIndexService.projectSaveGroups`

### SCN-SAVE-03 - Confirm Internal Save Write
- **Status**: Current
- **Goal**: Write the current game to an internal save file, including overwrite confirmation when the chosen save name already exists.
- **Preconditions**: The save view is open at `/saved-games/save/:name` with a valid selected game.
- **Entry Points**: Save view `Save game` button or Enter in the save-name field.
- **Main Steps**:
  1. User enters or selects a save name.
  2. `SavedGamesView` validates that the value is a non-reserved single file-name segment and enables `Save game` only while it is valid.
  3. User clicks `Save game`, and app resolves the target game folder beneath `gameSession.saveRootPath` from the app-owned game identity and validated name.
  4. If the chosen save name matches an existing save entry for that game, or storage reports that the file already exists, app asks for overwrite confirmation ("Replace this save?").
  5. On confirm or when no collision exists, app snapshots the current game workspace state.
  6. App serializes the canonical saved-game payload and writes the internal save file.
  7. App refreshes the save list and visible details, selects the written save and stays on the save route.
- **Branch Paths**:
  - `BR-SAVE-03-COLLISION-CANCEL`: User declines overwrite confirmation -> no write occurs and the save view stays open.
  - `BR-SAVE-03-IO-ERROR`: Save write fails -> show the typed error and keep the save view open for retry.
  - `BR-SAVE-03-INVALID-NAME`: Save name is blank, reserved (including `auto`), or path-like -> show inline validation, block save, and keep focus in the text box without calling `SavedGamesStore`.
- **Postconditions**: The selected game has a new or replaced internal save entry in its game folder, and the same canonical payload is available for later internal load.
- **Implementation Touchpoints**:
  - `SavedGamesView._saveGame` / `SavedGamesView._requestOverwrite` / `SavedGamesView._writeSave`
  - `useModal().open` (`ConfirmationModal`)
  - `SavedGamesStore.saveGame`
  - `SavedGameIndexService.getNamedSaveFilePath`
  - `SerializationService.writeGameDocument`

### SCN-LOAD-01 - Load Valid Game from Internal Save View
- **Status**: Current
- **Goal**: Open a ChessVue-managed save from the route-level load view and make it the active game context.
- **Preconditions**: At least one valid internal save file exists.
- **Entry Points**: Game menu `Load`, Home `Load game` and `View all`, the recovery notice `Saved games`.
- **Main Steps**:
  1. User chooses load action.
  2. If a timed game is active and auto-pause-on-menu is enabled, app pauses the game before entering the load flow.
  3. App routes to `/saved-games/load`.
  4. The load view shows the grouped game list, with the current game selected when one exists, and a board preview of the selected game's latest save with its ply count.
  5. Single-clicking a game selects it only.
  6. Double-clicking a game immediately loads that game's latest save file.
  7. The bottom-right action row shows `Cancel`, `Delete game` and `Select game`.
  8. Choosing `Select game`, or the row's open action, routes to `/saved-games/load/:name` for the selected game.
  9. The game-save listing screen shows that game's saves with a board preview and metadata (save time, plies, players, clock and result) for the selected snapshot, and replaces the bottom-right `Select game` action with `Load selected`.
  10. User selects a save entry and clicks `Load selected` or the row's `Load`, double-clicks it, or arrives by double-click latest-save behaviour from the grouped list.
  11. App resolves the selected internal save to a concrete save entry, `SavedGamesStore` reads the raw save document, checks its schema version and deserialises the payload inside the saved-game boundary, and presentation then passes that payload into `GamesStore.insertGame(...)` to restore the active workspace state immediately.
  12. Game is loaded into store, assigned a tab and opened.
  13. If engines are available for the restored context and `analysis.resumeLiveAnalysisAfterRestore` is enabled, app resumes live analysis for the restored position after the game state is restored.
  14. While the load flow is open, any already-running player-engine search from the previously active timed game may finish but must not mutate that paused game until return.
  15. When the user returns to the game screen, app auto-resumes if the pause came from this load flow.
- **Branch Paths**:
  - `BR-LOAD-01-CANCEL`: User leaves either load route or presses `Cancel` -> no load occurs.
  - `BR-LOAD-01-DUPLICATE-ID`: Loaded managed-group ID collides with a game already in the workspace -> remap ID before insert.
  - `BR-LOAD-01-SCHEMA-VERSION`: Unsupported schema version detected -> reject the saved game without inserting a partial workspace.
  - `BR-LOAD-01-IO-ERROR`: Enumeration or document read fails, including a removed selection -> settle loading, show the failure, preserve open workspaces and allow reselection or reopening the library to retry.
  - `BR-LOAD-01-NO-SELECTION`: No game is selected on `/saved-games/load` -> `Select game` is disabled and the user stays on the grouped game list.
  - `BR-LOAD-01-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, load proceeds without pausing the clock.
- **Postconditions**: The selected internal save opens as an active game, whether reached through direct double-click latest-load or the nested `/saved-games/load/:name` save-list route, and live analysis resumes afterwards when engines are available.
- **Implementation Touchpoints**:
  - `MenuBar.loadGameRequested`
  - `GameView._handleMenuInterruptionRequested`
  - `router.push` (`load-games` / `load-game` routes)
  - `SavedGamesView._refreshGroups` / `SavedGamesView._summariseGame` / `SavedGamesView._genPreviewPosition` / `SavedGamesView._loadGame`
  - `SavedGamesStore.listSavedGames`
  - `SavedGamesStore.loadGame`
  - `SavedGameIndexService.projectSaveGroups` / `SavedGameIndexService.getLatestSaveEntry`
  - `SerializationService.readGameDocument`
  - `GamesStore.insertGame`
  - `UiStateStore.openTab`
  - `UiStateStore.saveGameSession`

### SCN-EXPORT-01 - Export Game to External File
- **Status**: Current
- **Goal**: Export the active game to a user-selected external file through a standard OS save dialog.
- **Preconditions**: Active game exists.
- **Entry Points**: Save view navigation `Export` (reached from the game menu `Save`).
- **Main Steps**:
  1. User chooses export action.
  2. If a timed game is active and auto-pause-on-menu is enabled, app pauses the game before entering the save view.
  3. App snapshots the current game workspace state.
  4. App opens a normal OS save dialog suggesting `<game id>.json`. In the browser the document downloads with that name instead ([SCN-PLATFORM-01](#scn-platform-01---use-chessvue-in-an-ordinary-browser)).
  5. User selects destination and file name.
  6. App serialises and writes the external file and shows "Game exported.".
  7. While the export flow is open, the paused game surface stays inert and any player-engine move that becomes ready remains deferred until return.
  8. When the user returns to the game screen, app auto-resumes if the pause came from this export flow.
- **Branch Paths**:
  - `BR-EXPORT-01-CANCEL`: User cancels the OS save dialog -> no write.
  - `BR-EXPORT-01-IO-ERROR`: File write fails -> show the error and allow retry.
  - `BR-EXPORT-01-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, export proceeds without pausing the clock.
- **Postconditions**: Export either succeeds once or fails with a clear recovery path, and the external file contains the same canonical payload shape used by internal save files.
- **Implementation Touchpoints**:
  - `MenuBar.saveGameRequested`
  - `GameView._handleMenuInterruptionRequested`
  - `SavedGamesView._exportCurrent`
  - `SavedGamesStore.exportGame`
  - `SerializationService.selectExportFile`
  - `SerializationService.writeGameDocument`

### SCN-IMPORT-01 - Import Valid Game from External File
- **Status**: Current
- **Goal**: Import a saved game from an external file and open it as the active context.
- **Preconditions**: Valid supported game file is available.
- **Entry Points**: Saved games navigation `Import file`, in both load and save modes.
- **Main Steps**:
  1. User chooses import action.
  2. App opens a normal OS file picker, or the browser file chooser for `.json` files.
  3. User selects a file.
  4. `SavedGamesStore` resolves the selected external file path, reads the raw document, checks its schema version and deserialises the payload inside the saved-game boundary.
  5. `SavedGamesStore` replaces the imported metadata ID with a fresh app-generated game ID before returning it to presentation, so external metadata cannot become a managed save-folder name.
  6. App restores the saved game workspace state immediately, including current position/history node, clock state, and result state.
  7. Game is loaded into store, assigned a tab and opened.
  8. If engines are available for the restored context and analysis resume is enabled, app resumes live analysis for the restored position after the game state is restored.
- **Branch Paths**:
  - `BR-IMPORT-01-CANCEL`: User cancels the OS file picker -> no import occurs.
  - `BR-IMPORT-01-SCHEMA-VERSION`: Unsupported schema version detected -> reject the imported game without inserting a partial workspace.
- **Postconditions**: Imported game is available and routable, the user first sees the restored game state from the selected file, and live analysis resumes afterwards when engines are available.
- **Implementation Touchpoints**:
  - `SavedGamesView._importGame`
  - `SavedGamesStore.importGame`
  - `SerializationService.selectImportFile`
  - `SerializationService.readGameDocument`
  - `GamesStore.insertGame`
  - `UiStateStore.openTab`
  - `UiStateStore.saveGameSession`

### SCN-IMPORT-02 - Reject Invalid External Game File
- **Status**: Current
- **Goal**: Reject unsupported/corrupt import safely.
- **Preconditions**: User selected malformed or unsupported external file.
- **Entry Points**: Saved games navigation `Import file`.
- **Main Steps**:
  1. User selects file.
  2. App reads the raw document, then deserialization or validation fails inside the saved-game loading boundary before active-workspace insertion.
  3. App opens a "Could not import game" message dialog with the specific error and keeps current session intact.
- **Branch Paths**:
  - `BR-IMPORT-02-UNSUPPORTED`: Unsupported or unreadable document (invalid JSON, malformed UTF-8 or an unsupported schema) -> report it as unsupported or incomplete; the browser chooser offers only `.json` files.
  - `BR-IMPORT-02-INCOMPLETE`: Required canonical payload sections missing -> reject as invalid document and preserve current session state.
- **Postconditions**: No existing game data is overwritten by bad import.
- **Implementation Touchpoints**:
  - `SerializationService.selectImportFile`
  - `SerializationService.readGameDocument`
  - `SavedGamesStore.importGame`
  - `SavedGamesView._run`
  - `useModal().open` (`MessageModal`)

### SCN-SETTINGS-01 - Update Visual/UI Preferences
- **Status**: Current
- **Goal**: Change app colour-scheme mode, board display and UI scaling preferences. Board and piece theme customisation is deferred; only its supporting code structure belongs in the initial phase.
- **Preconditions**: User on settings view.
- **Entry Points**: `/settings`, `/settings/:category`.
- **Main Steps**:
  1. User edits one or more settings fields; Appearance offers System/Light/Dark theme, board orientation, coordinates, last-move highlight and an interface scale from 75% to 150%.
  2. User selects `Apply changes` to commit the pending changes without leaving the settings view, or `Save` to commit and return to the previous game or Home.
  3. App persists settings and applies theme/UI updates for the accepted changes.
  4. When `themeMode = system`, later OS theme changes make CSS select the corresponding saved light or dark profile without rewriting the persisted settings snapshot.
- **Branch Paths**:
  - `BR-SETTINGS-01-INVALID-VALUE`: Value fails schema validation -> block save and show field errors.
  - `BR-SETTINGS-01-APPLY-FAIL`: `Planned`: apply-on-save fails partially -> persist known-good subset. Acceptance is currently all-or-nothing; no subset policy is implemented.
  - `BR-SETTINGS-01-WRITE-FAIL`: Persistence rejects the draft before acceptance -> retain the previous accepted preferences and editable draft, show an error and allow explicit retry.
- **Postconditions**: Approved preferences are applied and persisted.
- **Implementation Touchpoints**:
  - `SettingsView._applySettings`
  - `SettingsStore.applySettings`
  - `SettingsStore.saveSettings`
  - `UserSettingService.saveSettings`
  - `SettingsView.appearanceChanged` / `App._applyAppearance`
  - `SettingsStore.appearanceProjection`

### SCN-SETTINGS-02 - Reset Settings to Defaults
- **Status**: Current
- **Goal**: Restore default settings quickly.
- **Preconditions**: User has modified settings.
- **Entry Points**: Settings navigation footer `Reset to defaults`.
- **Main Steps**:
  1. User clicks reset.
  2. App asks for confirmation ("Reset all settings?").
  3. On confirm, defaults are written, then accepted, and the appearance is reapplied.
- **Branch Paths**:
  - `BR-SETTINGS-02-CANCEL`: User cancels reset -> no change.
  - `BR-SETTINGS-02-PERSIST-FAIL`: Persisting the defaults fails -> the previous settings stay accepted and the confirmation shows the error for retry.
- **Postconditions**: Settings match defined default schema unless canceled.
- **Implementation Touchpoints**:
  - `SettingsView._requestResetSettings` / `SettingsView._resetSettings`
  - `SettingsStore.resetSettings`
  - `UserSettingService.resetSettings`
  - `useModal().open` (`ConfirmationModal`)

### SCN-SETTINGS-03 - Edit Quick Game Defaults
- **Status**: Current
- **Goal**: Choose the options used by Quick game and offered as the starting values for Custom game.
- **Preconditions**: User on the Gameplay settings category.
- **Entry Points**: `/settings/gameplay`, and the `Edit game defaults` action after a failed Quick game.
- **Main Steps**:
  1. User edits the game name, the White/Black (or Player 1/Player 2) players, `Randomly assign colours`, the clock, `Allow takebacks`, `Show live analysis moves` and up to four analysis-engine snapshots. `Use free analysis` unassigns both seats.
  2. Choosing an engine profile copies its configuration into the default snapshot. Saved snapshots stay selectable as `Keep <name> (saved configuration)`; current profiles appear as `Use profile: <name>`.
  3. User applies or saves Settings; the defaults are validated with the same rules as game creation.
  4. Later Quick and Custom games use the accepted snapshot; existing games keep their own copied options.
- **Branch Paths**:
  - `BR-SETTINGS-03-INVALID`: The defaults fail creation validation -> Apply and Save stay disabled and the error is shown.
  - `BR-SETTINGS-03-PROFILE-CHANGED`: The source profile is edited or deleted -> the saved snapshot is unchanged until the user explicitly chooses a profile again.
- **Postconditions**: Quick game, Custom game and start-from-setup seed from the same accepted defaults.
- **Implementation Touchpoints**:
  - `SettingsView` Gameplay category / `SettingsView._useFreeAnalysis`
  - `GamePlayerField`, `GameClockFields`, `AnalysisSnapshotFields`
  - `getGameCreationError` / `copyGameRequest` (`GameCreationUtility`)
  - `SettingsStore.applySettings` / `SettingsStore.saveSettings`
  - Rationale: [Quick game defaults design](../ArchivedPlans/QuickGameDefaultsDesign.md)

### SCN-ENGINE-01 - Add Engine Configuration
- **Status**: Current
- **Goal**: Register a new engine for analysis/gameplay.
- **Preconditions**: Settings engine section is available.
- **Entry Points**: `Add profile` on the Engines settings category (`/settings/engines/profiles/new`), and `Create profile` from a browser engine package.
- **Main Steps**:
  1. User opens the routed `EngineProfileView` within Settings.
  2. User enters the profile name and chooses the engine interface: Desktop executable or Browser UCI Worker.
  3. User chooses the entry: on desktop, a path or Browse; in the browser, an entry script from the installed package files; or `Use included Stockfish` for a worker.
  4. User may edit supported engine options through a name/value table inside the profile editor; values are stored as booleans, numbers or text.
  5. User adds the engine profile into the settings draft and returns to the Engines overview; profile save alone does not persist global settings.
  6. User applies or saves Settings to commit the draft.
  7. Engine appears in future assignment choices through `EnginesStore`.
- **Branch Paths**:
  - `BR-ENGINE-01-DUPLICATE`: Duplicate engine profile name -> block save until the name is made unique. An empty name is also rejected.
  - `BR-ENGINE-01-BROWSE-CANCEL`: The desktop file dialog is cancelled -> the form keeps its entries.
  - `BR-ENGINE-01-BROWSER-EXECUTABLE`: In the browser, the Desktop executable interface is unavailable and an existing executable profile shows a relink message.
- **Postconditions**: Accepted settings contain unique named profiles, exposed for assignment by `EnginesStore`. Existing seated engine participants inside already-open games remain unchanged until explicitly swapped. Saving a profile neither checks file availability nor starts an engine.
- **Implementation Touchpoints**:
  - `SettingsView._openEngineEditor` / `SettingsView._createPackageProfile`
  - `EngineProfileView._saveEngine` / `EngineProfileView._engineOptions` / `EngineProfileView._browseEngineFile` / `EngineProfileView._useIncludedEngine`
  - `EnginesStore.browseEngineFile` / `EnginesStore.refreshPackages` / `EnginesStore.listPackages`
  - `EnginesStore.listConfiguredEngines`
  - `SettingsStore.applySettings` / `SettingsStore.saveSettings`
  - `UserSettingService.saveSettings`
  - Rationale: [engine management UI design](../ArchivedPlans/EngineManagementUiDesign.md)

### SCN-ENGINE-02 - Update or Remove Engine Configuration
- **Status**: Current
- **Goal**: Maintain engine inventory as setups change.
- **Preconditions**: At least one engine exists.
- **Entry Points**: Copy, Edit and Delete actions on an engine profile row.
- **Main Steps**:
  1. User chooses copy, edit, or delete from an engine profile row.
  2. If editing, the app routes to `/settings/engines/profiles/:profileId/edit` and lets the user change general fields and option-table rows.
  3. If copying, the app routes to `/settings/engines/profiles/:profileId/copy` with a new identity and a unique `<name> copy` name.
  4. If deleting, the app removes the selected profile from the settings draft immediately.
  5. The profile editor rejects empty/duplicate names and stages valid profile saves or removals in the settings draft.
  6. User applies or saves Settings; schema validation runs before persistence.
  7. App persists the updated engine profile list for future assignments through `EnginesStore`.
- **Branch Paths**:
  - `BR-ENGINE-02-DUPLICATE-COPY`: Copied profile is renamed to a colliding name -> block save until renamed.
  - `BR-ENGINE-02-DELETE-IN-USE`: Deleting a profile already used by an open game leaves existing seated engine participants unchanged because their games already hold copied in-game engine payloads, while removing that profile from future assignment choices.
  - `BR-ENGINE-02-MISSING-PROFILE`: The routed profile ID is no longer in the draft -> show "Profile not found" with a return action.
- **Postconditions**: The saved engine profile list is updated for future assignments. Existing seated engine participants inside already-open games remain unchanged until explicitly swapped.
- **Implementation Touchpoints**:
  - `SettingsView._openEngineEditor` / `SettingsView._copyEngine` / `SettingsView._removeEngine`
  - `EngineProfileView._load` / `EngineProfileView._copyName` / `EngineProfileView._saveEngine`
  - `SettingsStore.applySettings` / `SettingsStore.saveSettings`
  - `UserSettingService.saveSettings`

### SCN-ENGINE-03 - Change Player Assignment During Game
- **Status**: Current
- **Goal**: Explicitly reassign one side to `none`, `local`, or a configured engine profile from the player strip.
- **Preconditions**: The current game has a baseline reassignable seat and presentation exposes the player-selection entry point. Board-edit mode and analysis-line playback do not expose player reassignment.
- **Entry Points**: Click the displayed player label in the player strip.
- **Main Steps**:
  1. User clicks the displayed player label for one side in the player strip.
  2. App opens a player-selection dialog scoped to that game and colour.
  3. User chooses `Keep <engine>` for a current engine seat, `Unassigned`, `Local player`, or one configured engine profile.
  4. If the user chooses an engine profile, presentation constructs an engine-backed `IPlayer` from the selected profile and passes that player into `GamesStore.reassignPlayer(...)`.
  5. If the resulting player setup leaves either side as `none`, app ends the current live game and converts the workspace into `free analysis / setup` from the currently visible position and branch context while preserving the visible move tree/history.
  6. That transition clears live-only result, draw offer, pause ownership and clock progression so the resulting setup workspace is no longer carrying active live-game timing or finality state.
  7. If the resulting player setup keeps both sides assigned inside the same live game, app preserves the current time control and clock state and continues play with the new seat assignment. Assigning both seats in free analysis keeps the workspace in free analysis until `Start game`.
  8. If that preserved live game is now on a non-local active side with no valid in-flight request already active for that seat and turn, the normal awaited-move loop starts from that side.
- **Branch Paths**:
  - `BR-ENGINE-03-SAME-SELECTION`: User selects the already assigned value -> keep the current seat unchanged and close the dialog.
  - `BR-ENGINE-03-TURN-IN-FLIGHT`: The replaced engine had an active turn search -> stop that turn-scoped session before the reassignment is committed.
  - `BR-ENGINE-03-ENGINE-UNAVAILABLE`: Selected engine cannot start for a newly due live turn -> keep the new assignment with unavailable feedback and allow a later retry or another reassignment. Current code retries the due turn automatically every 500 ms without a limit; see the known gap in [engine_runtime.md](engine_runtime.md#failure-and-retry-behaviour).
- **Postconditions**: Player reassignment updates only the current game. Live games preserve their existing time control and clock state when they stay live, while transitions to `free analysis / setup` preserve board and move-tree history for any later `start game from setup` flow.
- **Implementation Touchpoints**:
  - `PlayerPanel._selectPlayer`
  - `useModal().open`
  - `PlayerSelectionModal._confirmPlayerSelection` / `PlayerSelectionModal._assignedPlayer`
  - `GamesStore.reassignPlayer` / `GamePlayerTurnComposable.reassignPlayer`
  - `EngineRuntimeService.stopEngine`
  - `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` / `EngineRuntimeService.startPlayerTurn`

### SCN-ENGINE-04 - Install a Browser Engine Package
- **Status**: Current (browser host only)
- **Goal**: Add an engine's original package files to browser storage so a profile can run one of its scripts as a Worker.
- **Preconditions**: Browser host; Settings > Engines is open.
- **Entry Points**: `Install browser engine` on the Engines category (`/settings/engines/packages/import`).
- **Main Steps**:
  1. The import view reads the current engine folders, including the bundled Stockfish folder.
  2. User enters a unique engine (folder) name and chooses a ZIP archive.
  3. App reads the archive and lists its files, rejecting unsafe, duplicate or conflicting paths.
  4. User selects `Install engine`; the original files are saved immediately under that folder without an entry or interface choice.
  5. App refreshes the folder list and offers `Done` or `Create profile`, which opens the profile editor with the package as a hint ([SCN-ENGINE-01](#scn-engine-01---add-engine-configuration)).
- **Branch Paths**:
  - `BR-ENGINE-04-INVALID-NAME`: The name is empty, reserved, contains invalid characters or matches an existing folder -> inline error; Install stays disabled.
  - `BR-ENGINE-04-DISCOVERY-FAIL`: The folder list cannot be read -> show the error with `Refresh folders`; Install stays disabled until discovery succeeds.
  - `BR-ENGINE-04-INVALID-ARCHIVE`: The archive cannot be read or validated -> show the error; nothing is stored.
  - `BR-ENGINE-04-LEAVE`: User navigates away -> a pending read is cancelled; a started installation completes before navigation.
  - `BR-ENGINE-04-REFRESH-FAIL`: Files are saved but the folder list cannot be refreshed -> explain that installation completed and offer Refresh without reinstalling.
  - `BR-ENGINE-04-DESKTOP`: On the desktop host the view explains that package import is unavailable.
- **Postconditions**: Installed packages take effect independently of the settings draft; profiles remain a separate Apply/Save step.
- **Implementation Touchpoints**:
  - `SettingsView._openImport`
  - `EnginePackageImportView._refreshPackages` / `_validateEngineName` / `_chooseArchive` / `_install` / `_settleFileAction`
  - `EnginesStore.readArchive` / `EnginesStore.installPackage` / `EnginesStore.refreshPackages`
  - `EnginePackageService.readArchive` / `EnginePackageService.install` / `EnginePackageService.listPackages`
  - Rationale: [engine management UI design](../ArchivedPlans/EngineManagementUiDesign.md#browser-import), [engine installation rework](../ArchivedPlans/EngineInstallationReworkPlan.md)

### SCN-ENGINE-05 - Review or Remove an Installed Engine Package
- **Status**: Current (browser host)
- **Goal**: Inspect an engine folder's files and references, and remove imported files that are no longer used.
- **Preconditions**: Browser host; Settings > Engines lists the installed folders, always including the bundled Stockfish folder. On desktop the folder list is not shown and the details route opens only by direct URL.
- **Entry Points**: `Details` on an engine folder row (`/settings/engines/packages/details?packagePath=...`).
- **Main Steps**:
  1. The details view refreshes the folder list and shows the folder name, source (Included with ChessVue or Imported package) and files.
  2. It lists accepted and draft profiles, accepted and draft game defaults, open-game player engines and analysis seats whose worker entry lies inside the folder.
  3. User may choose `Create profile`, or `Remove files` for an imported browser folder.
  4. After confirmation, app rechecks the current references and deletes the folder's stored files, then returns to the Engines overview.
- **Branch Paths**:
  - `BR-ENGINE-05-REFERENCED`: A profile, default or open game still references the folder -> removal is rejected naming the references; nothing is deleted.
  - `BR-ENGINE-05-BUNDLED`: The bundled folder, or any folder on the desktop host -> `Remove files` is not offered.
  - `BR-ENGINE-05-MISSING`: The folder no longer exists -> show "Engine folder not found".
- **Postconditions**: Profiles and open games are never retargeted automatically; closed saved games may need the package again.
- **Implementation Touchpoints**:
  - `SettingsView._openPackage`
  - `EnginePackageDetailsView._load` / `_readReferences` / `_removePackage` / `_confirmRemovePackage`
  - `getGameEngineUsage` (`GameCreationUtility`)
  - `EnginesStore.getPackage` / `EnginesStore.removePackage`
  - `EnginePackageService.remove`

---

## Game Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Managed Save Entry
- **Status**: Current
- **Goal**: Remove a managed save target from the saved-games surface.
- **Preconditions**: A deletable managed save is selected in the saved-games UI.
- **Entry Points**: The `Delete save` action on a snapshot row, in load or save mode.
- **Main Steps**:
  1. User triggers delete on a managed save entry.
  2. App confirms deletion ("Delete this save?").
  3. Save target is removed from persistence.
  4. Saved-games list refreshes.
- **Branch Paths**:
  - `BR-LIFECYCLE-01-CANCEL`: User cancels deletion.
  - `BR-LIFECYCLE-01-NOT-FOUND`: Target missing at commit time -> no delete occurs; report the stale target, refresh and select a surviving snapshot.
  - `BR-LIFECYCLE-01-IO-ERROR`: Deletion fails -> close confirmation, refresh the selection, show the failure without claiming deletion and allow another explicit attempt.
- **Postconditions**: Deleted save target is no longer listed/selectable.
- **Implementation Touchpoints**:
  - `SavedGamesView._requestDelete` / `SavedGamesView._confirmDelete`
  - `SavedGamesStore.deleteSave`
  - `SavedGamesStore.listSavedGames`
  - `SerializationService.deleteDocument`
  - `useModal().open` (`ConfirmationModal`)

### SCN-LIFECYCLE-02 - Delete Selected Save and Switch Saved-Games Context
- **Status**: Current
- **Goal**: Remove the currently selected managed save without leaving invalid saved-games route or selection state.
- **Preconditions**: A selected game/save is active inside the saved-games route.
- **Entry Points**: Delete action on the selected save.
- **Main Steps**:
  1. User confirms deletion.
  2. App removes the selected managed save.
  3. App selects fallback saved-games context.
  4. Router and UI state update.
- **Branch Paths**:
  - `BR-LIFECYCLE-02-HAS-FALLBACK`: Another save entry exists in the group -> select its latest remaining save.
  - `BR-LIFECYCLE-02-LAST-GAME`: No save remains for the routed game -> replace the route with the grouped saved-games load view.
- **Postconditions**: No dangling selected-save route remains.
- **Implementation Touchpoints**:
  - `SavedGamesView._confirmDelete` / `SavedGamesView._refreshSelection`
  - `SavedGamesStore.deleteSave`
  - `SavedGamesStore.listSavedGames`
  - `router.replace`
  - `App.vue` route checkpoint / `UiStateStore.setActiveRoute`

### SCN-LIFECYCLE-03 - Delete a Saved Game and All Its Snapshots
- **Status**: Current
- **Goal**: Remove a whole game group from the library.
- **Preconditions**: A game is selected in the grouped load view.
- **Entry Points**: `Delete game` in the `/saved-games/load` action row.
- **Main Steps**:
  1. User selects a game and clicks `Delete game`.
  2. App confirms deletion of all of the game's snapshots and states that open workspaces stay open.
  3. App deletes each snapshot document in the group.
  4. App clears the selection and refreshes the library.
- **Branch Paths**:
  - `BR-LIFECYCLE-03-CANCEL`: User cancels -> nothing is deleted.
  - `BR-LIFECYCLE-03-IO-ERROR`: A deletion fails -> show the failure; snapshots not yet deleted remain listed after the refresh.
- **Postconditions**: The group no longer appears in the library or recent games; an open workspace of that game keeps its in-memory state and can be saved again.
- **Implementation Touchpoints**:
  - `SavedGamesView._requestDeleteGame` / `SavedGamesView._confirmDeleteGame`
  - `SavedGamesStore.deleteGame`
  - `SerializationService.deleteDocument`
  - `useModal().open` (`ConfirmationModal`)

---
## Additional User-Idea Scenarios (For Review)

> All scenarios in this section are `Idea` status, are outside the rewrite baseline, and should be read together with [ideas.md](ideas.md).

### SCN-IDEA-01 - Quick Game Preset from Home
- **Status**: Idea
- **Goal**: One-click start using named presets (Bullet/Blitz/Rapid/Classical).
- **Preconditions**: Home view available.
- **Entry Points**: Home quick-start button.
- **Main Steps**:
  1. User selects preset.
  2. App creates game with preset config.
  3. App routes directly to game.
- **Branch Paths**:
  - `BR-IDEA-01-MISSING-PRESET`: Preset missing -> fallback to default quick game.
- **Postconditions**: Faster entry into common play modes. The current Quick game uses one saved defaults snapshot ([SCN-SETTINGS-03](#scn-settings-03---edit-quick-game-defaults)) rather than per-preset buttons.
- **Implementation Touchpoints**:
  - `GamesStore.createGame`
  - `UiStateStore.openTab`

### SCN-IDEA-04 - Analysis Snapshot/Bookmark
- **Status**: Idea
- **Goal**: Save notable analysis positions for later revisit.
- **Preconditions**: Active game position with optional eval.
- **Entry Points**: Analysis panel bookmark action.
- **Main Steps**:
  1. User bookmarks current node/FEN.
  2. App saves snapshot metadata.
  3. User jumps back to bookmark from list.
- **Branch Paths**:
  - `BR-IDEA-04-DUPLICATE-BOOKMARK`: Same FEN already bookmarked -> merge or increment counter.
- **Postconditions**: Users can curate study points during play/analysis.
- **Implementation Touchpoints**:
  - `GamesStore`
  - `GameAnalysisComposable`
  - `SerializationService`

### SCN-IDEA-05 - Explain Evaluation Panel
- **Status**: Idea
- **Goal**: Augment numeric eval with plain-language rationale.
- **Preconditions**: Evaluation line available.
- **Entry Points**: Analysis row expand action.
- **Main Steps**:
  1. User expands eval row.
  2. App renders explanation text linked to line features.
  3. User collapses/compares explanations.
- **Branch Paths**:
  - `BR-IDEA-05-NO-EXPLANATION`: Engine lacks explain mode -> show score-only fallback.
- **Postconditions**: Better interpretability for non-expert users.
- **Implementation Touchpoints**:
  - `GamesStore.getVisibleAnalysis`
  - `AnalysisPanel`

### SCN-IDEA-06 - Undo/Redo Stack in Analysis Mode
- **Status**: Idea
- **Goal**: Rapidly traverse exploratory lines.
- **Preconditions**: Analysis mode active with local move sequence.
- **Entry Points**: Analysis toolbar undo/redo.
- **Main Steps**:
  1. User makes exploratory moves.
  2. User triggers undo/redo repeatedly.
  3. Board/history follow analysis stack pointer.
- **Branch Paths**:
  - `BR-IDEA-06-STACK-EMPTY`: Undo/redo unavailable at stack bounds.
- **Postconditions**: Exploration becomes faster than manual node clicking. The current First/Previous/Next/Last controls ([SCN-HIST-01](#scn-hist-01---navigate-move-history-node)) navigate the mainline, not an exploration stack.
- **Implementation Touchpoints**:
  - `GamesStore.navigateToNode`
  - `MoveHistoryService.addAnalysisMove`

### SCN-IDEA-07 - Auto-Reconnect Engine After Crash
- **Status**: Idea
- **Goal**: Reduce manual recovery after transient engine failure.
- **Preconditions**: Engine crash detected; reconnect policy enabled.
- **Entry Points**: Engine process exit event.
- **Main Steps**:
  1. App detects crash.
  2. App retries start with backoff.
  3. On success, app resumes analysis queue.
- **Branch Paths**:
  - `BR-IDEA-07-MAX-RETRY`: Retry limit reached -> disable engine and notify user.
- **Postconditions**: Better resilience for unstable engine binaries.
- **Implementation Touchpoints**:
  - `EngineRuntimeService.subscribeToAnalysis`
  - `GamesStore.refreshAnalysis`
  - `GamesStore.getVisibleAnalysis`

### SCN-IDEA-08 - Variant Rules Toggle
- **Status**: Idea
- **Goal**: Allow non-standard rule sets (e.g., Chess960).
- **Preconditions**: Variant settings surfaced in new game/setup.
- **Entry Points**: New game variant selector.
- **Main Steps**:
  1. User selects variant.
  2. App initializes variant position/rules.
  3. Move validation and notation adapt to variant.
- **Branch Paths**:
  - `BR-IDEA-08-UNSUPPORTED-ENGINE`: Selected engine cannot handle variant -> warn and continue without engine.
- **Postconditions**: Variant choice consistently affects rules, setup, and engine compatibility.
- **Implementation Touchpoints**:
  - `GameRuleUtility.isMoveLegal`
  - `GameRuleUtility.genLegalMoves`
  - `SerializationService.serialiseGame`
  - `EnginesStore.getEngine`

### SCN-IDEA-09 - Mobile Layout Panel Switching
- **Status**: Idea
- **Goal**: Make history/analysis/controls usable on small screens.
- **Preconditions**: App running in compact viewport.
- **Entry Points**: Responsive layout mode.
- **Main Steps**:
  1. User opens panel switcher.
  2. App swaps visible right-panel modules.
  3. User returns to board-focused layout.
- **Branch Paths**:
  - `BR-IDEA-09-PERSIST-PREF`: Panel preference save fails -> use in-memory-only layout state.
- **Postconditions**: Core tasks remain usable on mobile aspect ratios. The compact navigation drawer ([SCN-NAV-04](#scn-nav-04---use-the-navigation-rail-or-mobile-drawer)) and stacked board/sidebar layout are current; panel switching is not.
- **Implementation Touchpoints**:
  - `UiStateStore.togglePanel`
  - `UiStateStore.saveLayoutState`

### SCN-IDEA-10 - Batch Import/Export Games
- **Status**: Idea
- **Goal**: Handle multiple game files in one operation.
- **Preconditions**: File system adapter supports multi-select/packaging.
- **Entry Points**: File menu batch action.
- **Main Steps**:
  1. User selects multiple files (import) or games (export).
  2. App processes each item with progress feedback.
  3. Summary report shows successes/failures.
- **Branch Paths**:
  - `BR-IDEA-10-PARTIAL-BATCH-FAIL`: Some items fail; successful items still committed.
- **Postconditions**: Power users can transfer larger game sets efficiently.
- **Implementation Touchpoints**:
  - `SavedGamesStore`
  - `GamesStore`
  - `SerializationService`

### SCN-IDEA-11 - Tab Switching Auto-Pause
- **Status**: Idea
- **Goal**: Extend auto-pause behavior to tab switching in timed games.
- **Preconditions**: Multiple game tabs exist; timed game is active.
- **Entry Points**: User switches away from active game tab.
- **Main Steps**:
  1. User changes tabs during a timed game.
  2. App checks tab-switch auto-pause policy.
  3. If enabled, app pauses the game before completing the tab change.
- **Branch Paths**:
  - `BR-IDEA-11-DISABLED`: If tab-switch auto-pause is disabled, tab change does not affect the clock.
- **Postconditions**: Tab navigation can be reviewed later as an extension of menu auto-pause behavior.
- **Implementation Touchpoints**:
  - `useGameTabActions().select`
  - `GamesStore.pauseGame` (proposed tab policy)
  - `TimeControlService.getRemainingTime`

---

## Coverage Notes
- All major high-level features from `docs/HighLevel/plan.md` are represented by at least one scenario.
- Every scenario includes at least one explicit non-happy-path branch.
- All branch paths are tied to high-level implementation touchpoints for low-level design traceability.
- The contract map above provides the baseline trace from each `Current` and `Planned` scenario to its implementation-shaping contracts.
- `Idea` scenarios are isolated in a dedicated review section, are catalogued in `ideas.md`, and are not implied implementation commitments. `SCN-IDEA-02` (recent games, promoted to `SCN-NAV-03`) and `SCN-IDEA-03` (engine-versus-engine, replaced by the ordinary live-turn loop in `SCN-GAME-02`) are retired IDs and are not reused.
- Scenarios added on 8 November 2026 for implemented behaviour: `SCN-PLATFORM-01/02`, `SCN-GAME-04`, `SCN-NAV-04`, `SCN-CTRL-06`, `SCN-SETTINGS-03`, `SCN-ENGINE-04/05` and `SCN-LIFECYCLE-03`. No journey case references them yet.
