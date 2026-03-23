# ChessVue User Scenarios

## Purpose
This document translates high-level product features into actionable user scenarios.

The goal is to map **user actions -> branch paths -> low-level function implications** so low-level design can define concrete function contracts with fewer gaps.

This is a design artifact only. It introduces no runtime code/API changes.

## Conventions
- **Scenario ID**: stable identifier, e.g. `SCN-GAME-01`.
- **Branch ID**: stable identifier, e.g. `BR-GAME-01-CANCEL`.
- **Status**:
  - `Current`: expected in baseline core flows.
  - `Planned`: documented target behavior for later implementation.
  - `Idea`: speculative flow for review, not committed scope.
- **Analysis Contexts**:
  - `Free analysis / setup`: no live game progression, board editing allowed, can transition into a started game.
  - `In-game analysis mode`: entered from an active game, board editing not allowed, user can explore moves without progressing the live game.
- **Function Touchpoints** reference low-level modules/functions to guide implementation interfaces.

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

## Current and Planned Scenario Contract Map
This matrix is the authoritative trace from each committed scenario to the contracts that define its implementation-shaping behaviour.

| Scenario | Contracts |
| --- | --- |
| `SCN-SESSION-01` | `PERSIST`, `SETTINGS` |
| `SCN-SESSION-02` | `STATE`, `PERSIST`, `SETTINGS` |
| `SCN-SESSION-03` | `PERSIST` |
| `SCN-GAME-01` | `STATE`, `PERSIST`, `SETTINGS` |
| `SCN-GAME-02` | `STATE`, `ENGINE`, `SETTINGS` |
| `SCN-GAME-03` | `STATE`, `PERSIST` |
| `SCN-NAV-01` | `STATE`, `SETTINGS` |
| `SCN-NAV-02` | `STATE` |
| `SCN-NAV-03` | `PERSIST` |
| `SCN-MOVE-01` | `STATE`, `ENGINE` |
| `SCN-MOVE-02` | `STATE` |
| `SCN-MOVE-03` | `STATE`, `SETTINGS` |
| `SCN-HIST-01` | `STATE`, `ENGINE` |
| `SCN-HIST-02` | `STATE`, `SETTINGS` |
| `SCN-HIST-03` | `STATE`, `SETTINGS` |
| `SCN-HIST-04` | `STATE`, `PERSIST`, `SETTINGS` |
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
| `SCN-SAVE-01` | `PERSIST` |
| `SCN-SAVE-02` | `PERSIST`, `SETTINGS` |
| `SCN-LOAD-01` | `PERSIST`, `ENGINE` |
| `SCN-LOAD-02` | `PERSIST` |
| `SCN-SETTINGS-01` | `SETTINGS`, `PERSIST` |
| `SCN-SETTINGS-02` | `SETTINGS`, `PERSIST` |
| `SCN-ENGINE-01` | `ENGINE`, `SETTINGS` |
| `SCN-ENGINE-02` | `ENGINE`, `SETTINGS` |
| `SCN-ENGINE-03` | `STATE`, `ENGINE` |
| `SCN-LIFECYCLE-01` | `STATE`, `PERSIST` |
| `SCN-LIFECYCLE-02` | `STATE`, `PERSIST` |

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
- `Function Touchpoints`

---

## App and Session Start

### SCN-SESSION-01 - Fresh Launch with No Saved State
- **Status**: Current
- **Goal**: Start app from a clean state and reach a usable first screen.
- **Preconditions**: No persisted games/UI/settings state exists.
- **Entry Points**: App startup.
- **Main Steps**:
  1. User launches app.
  2. App initializes router and stores.
  3. App loads default settings.
  4. App resolves the effective app theme from built-in defaults and the current system theme when the default mode is `system`.
  5. App shows a centred home/default game area with a single-row action button group for quick new game, custom new game, load game, and settings.
  6. Because no recent metadata exists yet, the recent games list stays hidden.
- **Branch Paths**:
  - `BR-SESSION-01-INIT-FAIL`: If any persisted read fails unexpectedly, app falls back to safe defaults and logs recoverable error.
  - `BR-SESSION-01-HOME-FALLBACK`: If the preferred home screen cannot be restored, app still shows a neutral landing state without auto-creating a game.
- **Postconditions**: User can start a new game, load a game, or open settings without restart.
- **Function Touchpoints**:
  - `Router.createRouterInstance`
  - `Router.setupRoutes`
  - `SettingsStore.loadSettings`
  - `UiStateStore.loadLayoutState`
  - `UiStateStore.loadGameSession`
  - `RecentGameStore.loadRecentGames`
  - `StorageAdapter.getItem`

### SCN-SESSION-02 - Restore Previous Session
- **Status**: Planned
- **Goal**: Resume prior UI/game context after restart.
- **Preconditions**: Persisted `currentGameId`, game list, and UI preferences exist.
- **Entry Points**: App startup.
- **Main Steps**:
  1. User launches app.
  2. App loads persisted settings and UI state.
  3. App resolves the effective app theme from `appearance.themeMode` and the current system theme when required.
  4. App restores game collection.
  5. App routes to persisted active game if valid.
- **Branch Paths**:
  - `BR-SESSION-02-MISSING-GAME`: Persisted `currentGameId` not found -> route to first valid game or home.
  - `BR-SESSION-02-PARTIAL-STATE`: UI state exists but games do not -> keep UI preferences, reset active game.
- **Postconditions**: Prior session context is restored where valid; invalid pieces are safely repaired.
- **Function Touchpoints**:
  - `UiStateStore.loadLayoutState`
  - `UiStateStore.loadGameSession`
  - `GamesStore.loadGame`
  - `GamesStore.listGames`
  - `UiStateStore.setActiveGame`
  - `Router.beforeEachRouteGuard`
  - `StorageAdapter.getItem`

### SCN-SESSION-03 - Startup with Corrupt Persisted Data
- **Status**: Planned
- **Goal**: Prevent startup crash when stored JSON/state is corrupt.
- **Preconditions**: At least one persisted payload is malformed.
- **Entry Points**: App startup.
- **Main Steps**:
  1. User launches app.
  2. App attempts to deserialize persisted state.
  3. Corrupt payload is rejected and isolated.
  4. App continues with defaults and displays recoverable warning.
- **Branch Paths**:
  - `BR-SESSION-03-SETTINGS-CORRUPT`: Settings payload invalid -> `resetSettings` fallback.
  - `BR-SESSION-03-GAME-MIGRATE`: Legacy game shape detected -> migrate before load.
- **Postconditions**: App remains usable; bad persistence does not block launch.
- **Function Touchpoints**:
  - `SerializationService.deserialiseGame`
  - `SerializationService.migrateGame`
  - `SettingsStore.resetSettings`
  - `StorageAdapter.getItem`
  - `StorageAdapter.setSettingsSnapshot`

---

## Game Creation and Navigation

### SCN-GAME-01 - Quick New Game from Menu
- **Status**: Current
- **Goal**: Start a game quickly with default options.
- **Preconditions**: App is open; menu is accessible.
- **Entry Points**: Menu `New Game`.
- **Main Steps**:
  1. User clicks `New Game`.
  2. App uses default `NewGameOptions`.
  3. Game is created and persisted.
  4. App routes to new game and sets active tab.
- **Branch Paths**:
  - `BR-GAME-01-CANCEL`: If confirmation modal exists and user cancels, no game is created.
  - `BR-GAME-01-PERSIST-FAIL`: If save-on-create fails, game remains in memory and user is warned.
- **Postconditions**: New game context becomes active unless canceled.
- **Function Touchpoints**:
  - `MenuBar.quickNewGameRequested`
  - `GamesStore.createGame`
  - `UiStateStore.setActiveGame`
  - `GamesStore.saveGame`
  - `StorageAdapter.setGameSessionSnapshot`

### SCN-GAME-02 - Custom New Game with User Options
- **Status**: Planned
- **Goal**: Create game with custom time control and player/engine settings.
- **Preconditions**: New-game dialog/form is available.
- **Entry Points**: Menu `New Game` -> custom configuration flow.
- **Main Steps**:
  1. User opens new-game dialog.
  2. User edits options (players, time control preset/custom, sides, and engine assignment).
  3. User may assign either side to `none`, which means the flow starts in `free analysis / setup` context instead of a live game.
  4. User confirms creation.
  5. App validates options and creates configured game.
  6. If the created workspace is a live game and the side to move is engine-controlled, the normal live engine-turn loop starts from that side without a separate engine-vs-engine mode.
- **Branch Paths**:
  - `BR-GAME-02-INVALID-TIME`: Invalid time settings (negative/empty) -> inline validation, block submit.
  - `BR-GAME-02-ENGINE-MISSING`: Selected required engine unavailable -> block creation until the setup is corrected.
  - `BR-GAME-02-FREE-ANALYSIS-START`: If either side is assigned `none`, initialize free analysis/setup permissions and enable engine analysis on moves when engines were configured at creation.
- **Postconditions**: Game starts with validated custom settings.
- **Function Touchpoints**:
  - `MenuBar.customNewGameRequested`
  - `NewGameModal.createRequested`
  - `GamesStore.createGame`
  - `EnginesStore.getEngine`
  - `UiStateStore.showModal`
  - `UiStateStore.hideModal`

### SCN-GAME-03 - Multi-Game Tab Navigation and Visibility
- **Status**: Current
- **Goal**: Switch between game contexts while keeping route and active game state in sync.
- **Preconditions**: Two or more active games exist.
- **Entry Points**: Tab click, route change, recent game action.
- **Main Steps**:
  1. User opens/creates multiple games.
  2. User switches game via tab.
  3. App updates active route and current game ID.
  4. Game view rebinds board/history/analysis to selected game.
- **Branch Paths**:
  - `BR-GAME-03-ONE-TAB`: If only one game remains, tab bar hides.
  - `BR-GAME-03-INVALID-TARGET`: If selected game no longer exists, fallback to first valid game/home.
- **Postconditions**: Navigation remains deterministic; hidden-tab rule is respected.
- **Function Touchpoints**:
  - `GameTabs.tabSelected`
  - `UiStateStore.setActiveGame`
  - `UiStateStore.getCurrentGameId`
  - `Router.beforeRouteEnterGuard`
  - `Router.beforeEachRouteGuard`
  - `GamesStore.getGame`
  - `GamesStore.listGames`

### SCN-NAV-01 - Route to Settings and Back to Active Game
- **Status**: Current
- **Goal**: Let user configure preferences and return to gameplay context.
- **Preconditions**: At least one game may be active.
- **Entry Points**: Menu `Settings`, `/settings`, `/settings/:category`.
- **Main Steps**:
  1. User navigates to settings.
  2. If a timed game is active and auto-pause-on-menu is enabled, app pauses the game before leaving the game screen.
  3. App loads current settings and engine list.
  4. User applies, saves, or resets settings, including appearance settings such as `themeMode`.
  5. Accepted appearance changes update the active app theme without restart.
  6. User navigates back to prior game route.
  7. If the pause came from this auto-pause flow, app auto-resumes on return.
- **Branch Paths**:
  - `BR-NAV-01-DIRTY-LEAVE`: Unsaved form edits + navigation -> prompt save/discard.
  - `BR-NAV-01-NO-GAME-RETURN`: No active game available on return -> route to home/default.
  - `BR-NAV-01-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, settings open without pausing the clock.
- **Postconditions**: Settings are persisted or intentionally discarded; navigation context remains clear.
- **Function Touchpoints**:
  - `MenuBar.settingsRequested`
  - `GameControlPanel.pauseRequested`
  - `SettingsStore.loadSettings`
  - `SettingsStore.saveSettings`
  - `SettingsStore.resetSettings`
  - `SettingsStore.updateSettings`
  - `UiStateStore.saveGameSession`

### SCN-NAV-02 - Invalid Game Route Handling
- **Status**: Planned
- **Goal**: Gracefully handle `/game/:id` when `id` is unknown.
- **Preconditions**: User deep-links to invalid game ID.
- **Entry Points**: URL route or internal navigate call.
- **Main Steps**:
  1. User opens invalid game route.
  2. Route guard validates game ID.
  3. App redirects to valid fallback route.
- **Branch Paths**:
  - `BR-NAV-02-HAS-GAMES`: Redirect to first available game.
  - `BR-NAV-02-NO-GAMES`: Redirect to home/new-game prompt.
- **Postconditions**: User never lands in broken game view.
- **Function Touchpoints**:
  - `Router.beforeRouteEnterGuard`
  - `Router.beforeEachRouteGuard`
  - `GamesStore.getGame`
  - `GamesStore.listGames`

### SCN-NAV-03 - Reopen Recent Game from Home
- **Status**: Planned
- **Goal**: Reopen a recently accessed game from the centred `HomeView` recent games list.
- **Preconditions**: One or more recent game entries exist for the home screen.
- **Entry Points**: `HomeView` recent games list.
- **Main Steps**:
  1. User lands on `HomeView`.
  2. App shows the centred single-row action buttons and a recent games list below them.
  3. User selects a recent game entry.
  4. App resolves the stored recent reference and loads the referenced game from either autosave storage or a manual file path.
  5. App opens the loaded game as the active context and routes to it.
- **Branch Paths**:
  - `BR-NAV-03-MISSING-ENTRY`: Recent reference no longer resolves -> remove stale entry and keep the user on `HomeView`.
  - `BR-NAV-03-LOAD-FAIL`: Referenced game file is invalid or unreadable -> route through the normal invalid-load error flow.
- **Postconditions**: A valid recent entry opens as the active game; invalid recent entries are removed without breaking the home screen.
- **Function Touchpoints**:
  - `RecentGameStore.loadRecentGames`
  - `RecentGameStore.openRecentGame`
  - `RecentGameStore.removeRecentGame`
  - `StorageAdapter.getGame`
  - `FileIoAdapter.loadGameFromPath`
  - `GamesStore.insertGame`
  - `UiStateStore.setActiveGame`

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
  5. Game state, history, and clocks update.
  6. Analysis is queued/refreshed for resulting position.
- **Branch Paths**:
  - `BR-MOVE-01-STALE-POS`: If position changed before submission (race), reject move and refresh legal map.
  - `BR-MOVE-01-GAME-OVER`: If move ends game, transition to game-over state and stop further moves.
- **Postconditions**: Move is committed once, reflected across board/history/clock/analysis.
- **Function Touchpoints**:
  - `Chessboard.moveAttempt`
  - `GameRuleService.generateLegalMoves`
  - `GameRuleService.isMoveLegal`
  - `GamesStore.makeMove`
  - `MoveUpdateService.addMainlineMove`
  - `TimeControlService.applyMove`
  - `AnalysisStore.applyAnalysisUpdate` (subsequent engine response)

### SCN-MOVE-02 - Illegal Move Attempt
- **Status**: Current
- **Goal**: Reject illegal input without mutating game state.
- **Preconditions**: Active game; user attempts non-legal move.
- **Entry Points**: Chessboard move attempt.
- **Main Steps**:
  1. User attempts invalid target.
  2. Legality check fails.
  3. UI signals invalid move.
  4. Board/history/clocks remain unchanged.
- **Branch Paths**:
  - `BR-MOVE-02-SAME-SQUARE`: Click source again -> cancel selection.
  - `BR-MOVE-02-OUT-OF-TURN`: Attempt while not player turn -> no-op + warning.
- **Postconditions**: No state mutation on invalid move.
- **Function Touchpoints**:
  - `Chessboard.onSquareClick`
  - `GameRuleService.isMoveLegal`
  - `GamesStore.makeMove`

### SCN-MOVE-03 - Pawn Promotion Resolution
- **Status**: Planned
- **Goal**: Resolve promotion piece selection before finalizing move.
- **Preconditions**: Legal pawn move reaches final rank.
- **Entry Points**: Chessboard move attempt resulting in promotion.
- **Main Steps**:
  1. User moves pawn to promotion rank.
  2. App opens promotion selection UI.
  3. User selects piece type.
  4. App finalizes move and updates history/clock.
- **Branch Paths**:
  - `BR-MOVE-03-CANCEL`: User closes promotion UI -> move not committed.
- **Postconditions**: Promotion move is explicit and deterministic.
- **Function Touchpoints**:
  - `Chessboard.moveAttempt`
  - `GameRuleService.isMoveLegal`
  - `GameRuleService.applyMove`
  - `GamesStore.makeMove`
  - `UiStateStore.showModal`

### SCN-HIST-01 - Navigate Move History Node
- **Status**: Current
- **Goal**: Review any prior position from move tree.
- **Preconditions**: Game has at least one move.
- **Entry Points**: History panel node click.
- **Main Steps**:
  1. User clicks node in history tree.
  2. App navigates board state to selected node.
  3. Analysis panel switches to selected FEN context.
- **Branch Paths**:
  - `BR-HIST-01-NODE-MISSING`: Node ID invalid -> ignore and refresh tree.
  - `BR-HIST-01-ENGINE-DATA-MISS`: No analysis for that node -> show empty/queued state.
- **Postconditions**: Board and analysis context match selected history node.
- **Function Touchpoints**:
  - `HistoryPanel.onNavigateNode`
  - `MoveUpdateService.navigateToNode`
  - `MoveUpdateService.getCurrentPosition`
  - `AnalysisStore.getVisibleAnalysis`
  - `GamesStore.getGame`

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)
- **Status**: Planned
- **Goal**: Convert review position into new active mainline when rules allow takeback.
- **Preconditions**: User is on prior node; takeback policy enabled.
- **Entry Points**: Move made from a non-terminal historical node.
- **Main Steps**:
  1. User navigates to old node.
  2. User makes legal move from old node.
  3. App treats action as mainline continuation.
  4. App promotes the new continuation to the main branch.
  5. The old future line remains in the move tree as a visible variation.
- **Branch Paths**:
  - `BR-HIST-02-CONFIRM-REWRITE`: Require confirmation before changing which continuation is marked as mainline.
  - `BR-HIST-02-DECLINE-REWRITE`: User declines rewrite -> move canceled, remain in review.
- **Postconditions**: Mainline pointer changes to the new continuation, while the old continuation remains visible as a variation.
- **Function Touchpoints**:
  - `MoveUpdateService.takeback`
  - `MoveUpdateService.addMainlineMove`
  - `MoveUpdateService.pruneFutureMoves`
  - `GamesStore.makeMove`

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)
- **Status**: Planned
- **Goal**: Allow history exploration without altering live game progression.
- **Preconditions**: User on prior node; takeback disabled.
- **Entry Points**: Move made while browsing history.
- **Main Steps**:
  1. User navigates to old node.
  2. User makes legal move.
  3. App records move as analysis branch only.
  4. User can return to live game node.
- **Branch Paths**:
  - `BR-HIST-03-AUTO-RETURN`: App auto-returns to live node after analysis move.
  - `BR-HIST-03-STAY-BRANCH`: App remains on branch until user explicitly returns.
- **Postconditions**: Live game line preserved; analysis branch captured separately.
- **Function Touchpoints**:
  - `MoveUpdateService.addAnalysisMove`
  - `MoveUpdateService.navigateToNode`
  - `GamesStore.makeMove`

### SCN-HIST-04 - Prune Future Moves from Selected Node
- **Status**: Planned
- **Goal**: Cleanly delete continuation moves when user chooses to prune.
- **Preconditions**: Selected node has descendants.
- **Entry Points**: History panel action `Prune future`.
- **Main Steps**:
  1. User selects node.
  2. User triggers prune action.
  3. App confirms irreversible operation.
  4. App deletes descendants and updates mainline markers.
- **Branch Paths**:
  - `BR-HIST-04-CANCEL`: User cancels confirmation -> no mutation.
  - `BR-HIST-04-ROOT-GUARD`: Root prune attempt rejected if policy forbids deleting full game line.
- **Postconditions**: Move tree contains only retained line(s).
- **Function Touchpoints**:
  - `MoveUpdateService.pruneFutureMoves`
  - `GamesStore.saveGame`
  - `UiStateStore.showModal`

---
## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context
- **Status**: Planned
- **Goal**: Open a non-live chess workspace where the user can explore positions before starting a real game.
- **Preconditions**: User creates a flow with at least one side unassigned, reassigns one side of an existing live game to `none`, or opens a dedicated setup path.
- **Entry Points**: Custom new-game flow with an unassigned side, or player reassignment to `none` from a live game.
- **Main Steps**:
  1. User enters free analysis / setup context.
  2. App gives the user move control for both colors.
  3. If engines were configured at creation, app refreshes analysis after each committed move.
  4. User explores legal moves without progressing a live game.
- **Branch Paths**:
  - `BR-FREE-ANALYSIS-01-ENGINE-NOT-RUNNING`: Engine start fails -> keep the setup context usable and show actionable error.
  - `BR-FREE-ANALYSIS-01-NO-ENGINES`: If no engines were configured, free analysis remains available without evaluation lines.
- **Postconditions**: User can explore, analyze, and prepare a starting position before a real game begins.
- **Function Touchpoints**:
  - `GamesStore.createGame`
  - `GamesStore.reassignPlayer`
  - `GamesStore.makeMove`
  - `AnalysisStore.getVisibleAnalysis`
  - `EnginesStore.startAnalysis`

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup
- **Status**: Planned
- **Goal**: Let the user directly edit the board position and clear move history while in free analysis / setup.
- **Preconditions**: Free analysis / setup context is active.
- **Entry Points**: Setup board edit action.
- **Main Steps**:
  1. User enters board-editing mode from free analysis / setup.
  2. User adds, removes, or relocates pieces to define a new position.
  3. User confirms the edited position.
  4. App replaces the current board state with the edited position.
  5. App clears existing move history and treats the edited board as the new root position.
  6. If engines were configured at creation, app requests analysis for the edited position.
- **Branch Paths**:
  - `BR-FREE-ANALYSIS-02-CANCEL`: User cancels board editing -> restore prior position and history unchanged.
  - `BR-FREE-ANALYSIS-02-CLEAR-CONFIRM`: If history exists, app asks for confirmation before clearing it.
  - `BR-FREE-ANALYSIS-02-ENGINE-REFRESH-FAIL`: If engines cannot refresh on the edited position, keep the edited board and show evaluation as unavailable.
- **Postconditions**: The edited position becomes the current free-analysis root and old move history is removed when confirmed.
- **Function Touchpoints**:
  - `UiStateStore.showModal`
  - `UiStateStore.hideModal`
  - `MoveUpdateService.createMoveTree`
  - `GamesStore.saveGame`
  - `AnalysisStore.getVisibleAnalysis`
  - `AnalysisStore.clearGameAnalysis`

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup
- **Status**: Planned
- **Goal**: Turn the current free-analysis position into the starting point of a real game.
- **Preconditions**: Free analysis / setup context is active.
- **Entry Points**: Start-game action from free analysis / setup.
- **Main Steps**:
  1. User finishes preparing a position in free analysis / setup.
  2. User selects time control and players to start a real game.
  3. App keeps the current board position as the starting position of the new game.
  4. App preserves the prior analysis history in the move tree.
  5. App transitions into normal live-game behavior for the started game.
- **Branch Paths**:
  - `BR-FREE-ANALYSIS-03-INVALID-ENGINE`: If a required engine for the started game is unavailable, block the transition until setup is corrected.
  - `BR-FREE-ANALYSIS-03-CANCEL`: User cancels start-game flow -> remain in free analysis / setup.
- **Postconditions**: A real game begins from the prepared position, and the earlier free-analysis history remains available.
- **Function Touchpoints**:
  - `GamesStore.startGameFromSetup`
  - `EnginesStore.getEngine`
  - `UiStateStore.showModal`
---
## Analysis and Engine Interaction

### SCN-ANALYSIS-01 - Start Single Engine Analysis
- **Status**: Current
- **Goal**: Start evaluation for current position with one engine.
- **Preconditions**: Engine configured and available.
- **Entry Points**: Analysis start action in a game context, or automatic trigger after a move when engines were configured at creation.
- **Main Steps**:
  1. User starts analysis manually, or analysis is auto-triggered after a move.
  2. App ensures the engine session is running.
  3. `EngineClient` starts an ongoing search for the current FEN and writes protocol commands through `ProcessManager`.
  4. `ProcessManager` streams raw output to `EngineClient`, which turns it into typed updates.
  5. App stores updated best lines and scores each time the engine reports an improvement or deeper search result.
  6. Analysis panel refreshes over time to show the latest best line, up to `3` visible lines for that engine, score, and search progress until analysis is stopped or the position changes.
- **Branch Paths**:
  - `BR-ANALYSIS-01-ENGINE-NOT-RUNNING`: Engine start fails -> show actionable error and keep UI responsive.
  - `BR-ANALYSIS-01-PARSE-FAIL`: Output parse fails -> skip bad line and continue listening.
  - `BR-ANALYSIS-01-AUTO-ON-MOVE`: If engines were configured at creation, refresh analysis automatically after each committed move in either free analysis / setup or in-game analysis mode.
  - `BR-ANALYSIS-01-POSITION-CHANGED`: If the board position changes while the engine is still searching, stop or supersede the old search and begin streaming updates for the new position.
  - `BR-ANALYSIS-01-ENGINE-FOLDED`: If the user folds that engine group, new results continue updating in the background and become visible again when expanded.
- **Postconditions**: The latest valid eval for the active position is available in analysis store, and it may continue to improve while the engine keeps searching.
- **Function Touchpoints**:
  - `GameView.onStartAnalysis`
  - `EnginesStore.startAnalysis`
  - `EngineClient.startSession`
  - `ProcessManager.spawnProcess`
  - `ProcessManager.writeInput`
  - `ProcessManager.subscribeToStdout`
  - `AnalysisStore.applyAnalysisUpdate`
  - `AnalysisStore.getVisibleAnalysis`

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis
- **Status**: Planned
- **Goal**: Compare multiple engines on same position concurrently.
- **Preconditions**: Two or more engines configured.
- **Entry Points**: Multi-engine analysis enable action.
- **Main Steps**:
  1. User enables selected engines.
  2. App starts each selected engine session.
  3. App dispatches position to all selected engines.
  4. Each engine continues searching and emits updated best lines over time.
  5. App aggregates evaluations keyed by `gameId + engineId + fen`, replacing older lines with newer best results from the same engine.
  6. Analysis panel renders one row/group per engine, shows up to `3` visible lines per engine, and updates each row independently as new output arrives.
- **Branch Paths**:
  - `BR-ANALYSIS-02-PARTIAL-FAIL`: One engine fails, others continue with per-engine error badge.
  - `BR-ANALYSIS-02-TOO-MANY`: Resource limit reached -> throttle, queue, or reject additional engines.
  - `BR-ANALYSIS-02-DESYNC`: Engines report at different rates/depths -> panel keeps latest result from each engine without waiting for synchronized updates.
  - `BR-ANALYSIS-02-FOLD-ONE`: Folding one engine group hides only that engine's visible lines and does not affect the other engine groups.
- **Postconditions**: Partial availability does not block full analysis feature, and each engine can improve its displayed line independently over time.
- **Function Touchpoints**:
  - `EnginesStore.listConfiguredEngines`
  - `EnginesStore.startAnalysis`
  - `AnalysisStore.applyAnalysisUpdate`
  - `AnalysisStore.getVisibleAnalysis`
  - `ProcessManager.writeInput`
  - `ProcessManager.subscribeToStdout`

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis
- **Status**: Planned
- **Goal**: Handle runtime engine interruptions safely.
- **Preconditions**: Active analysis session exists.
- **Entry Points**: Unexpected process exit or user stop command.
- **Main Steps**:
  1. Engine exits or user stops it.
  2. App marks engine as unavailable/stopped.
  3. Existing cached evaluations remain visible as the last known result for that engine.
  4. User can retry start.
- **Branch Paths**:
  - `BR-ANALYSIS-03-RETRY-SUCCESS`: Restart succeeds and analysis resumes.
  - `BR-ANALYSIS-03-RETRY-FAIL`: Restart fails repeatedly -> suggest settings edit/remove.
- **Postconditions**: Engine failures are isolated and recoverable, and the last streamed best line remains visible until replaced by a new search.
- **Function Touchpoints**:
  - `EnginesStore.stopAnalysis`
  - `ProcessManager.stopProcess`
  - `EnginesStore.startAnalysis`
  - `AnalysisStore.getVisibleAnalysis`
  - `UiStateStore.showModal`

### SCN-ANALYSIS-04 - Click Suggested Line to Inspect Move
- **Status**: Planned
- **Goal**: Let user explore suggested continuation from analysis panel.
- **Preconditions**: At least one analysis line is available.
- **Entry Points**: Analysis line click.
- **Main Steps**:
  1. User clicks a suggested move/line.
  2. App applies line in analysis context.
  3. Board and history preview update.
  4. User returns to mainline/live position.
- **Branch Paths**:
  - `BR-ANALYSIS-04-LINE-STALE`: Line no longer legal in current node -> reject and refresh eval list.
  - `BR-ANALYSIS-04-APPLY-AS-BRANCH`: If enabled, save inspected line as analysis branch.
- **Postconditions**: Suggested lines become interactive, without corrupting live game state.
- **Function Touchpoints**:
  - `AnalysisPanel.lineSelected`
  - `GameRuleService.isMoveLegal`
  - `MoveUpdateService.addAnalysisMove`
  - `MoveUpdateService.navigateToNode`
  - `GamesStore.getGame`

### SCN-ANALYSIS-05 - Add or Remove Per-Game Analysis Engine During Game
- **Status**: Planned
- **Goal**: Manage the current game's analysis-engine roster from the analysis panel without changing other games.
- **Preconditions**: Active game exists; at least one configured engine profile may be available.
- **Entry Points**: Analysis panel title-row `+` action, per-engine remove action.
- **Main Steps**:
  1. User clicks the `+` button on the right side of the analysis panel title.
  2. App opens an analysis-engine selection dialog scoped to the current game.
  3. User selects an unassigned engine profile to add.
  4. App records the new per-game analysis-engine assignment.
  5. If the current interaction context allows analysis, app starts or refreshes analysis for that engine on the visible position.
  6. User may later click the `-` action on the right side of that engine group's title row to remove it.
  7. App stops that engine's active analysis session for the current game and removes that engine from the current game's analysis roster only.
- **Branch Paths**:
  - `BR-ANALYSIS-05-DUPLICATE`: Selected engine is already assigned to this game -> reject duplicate add and keep current roster unchanged.
  - `BR-ANALYSIS-05-LIMIT`: Adding the engine would exceed the supported concurrent analysis-engine limit -> reject and explain the limit.
  - `BR-ANALYSIS-05-START-FAIL`: Added engine cannot start for the current position -> keep the assignment with unavailable feedback and allow retry or removal.
  - `BR-ANALYSIS-05-BOARD-EDIT`: Current workspace is in `boardEdit` -> block live analysis start until board editing ends.
- **Postconditions**: The current game's analysis roster updates independently from other games, and assigned engines begin or end analysis accordingly.
- **Function Touchpoints**:
  - `AnalysisPanel.analysisEngineAddRequested`
  - `AnalysisPanel.analysisEngineRemoveRequested`
  - `UiStateStore.showModal`
  - `GamesStore.addAnalysisEngine`
  - `GamesStore.removeAnalysisEngine`
  - `EnginesStore.validateAnalysisSelection`
  - `EnginesStore.startAnalysis`
  - `EnginesStore.stopEngine`

---

## Time Control and Game Controls

### SCN-TIME-01 - Clock Ticks During Play
- **Status**: Current
- **Goal**: Decrease active side clock in real time.
- **Preconditions**: Time control enabled; game not paused/ended.
- **Entry Points**: Game in progress.
- **Main Steps**:
  1. Turn begins for active side.
  2. UI timer ticks act only as render cadence and request an authoritative remaining-time read.
  3. `TimeControlService` recalculates the remaining time from the stored clock snapshot and current timestamp.
  4. The UI renders that authoritative remaining-time read.
  5. Move submission transfers active timer ownership through the normal move-commit path.
- **Branch Paths**:
  - `BR-TIME-01-BACKGROUND-THROTTLE`: App tab inactive -> recompute from timestamps on resume.
  - `BR-TIME-01-SYNC-DRIFT`: Drift detected -> normalize to authoritative relative time model.
- **Postconditions**: Clock remains consistent through normal and throttled runtime conditions.
- **Function Touchpoints**:
  - `GameView.onTimerTick`
  - `TimeControlService.getRemainingTime`
  - `TimeControlService.applyMove`
  - `PlayerPanel.formatClock`
### SCN-TIME-02 - Pause and Resume Clocks
- **Status**: Planned
- **Goal**: Temporarily stop game timing and resume safely.
- **Preconditions**: Game in progress with clocks.
- **Entry Points**: Game control `Pause`.
- **Main Steps**:
  1. User clicks `Pause`.
  2. App suspends timer updates and marks paused state.
  3. User clicks `Resume`.
  4. App restores active timer without losing elapsed data.
- **Branch Paths**:
  - `BR-TIME-02-DOUBLE-PAUSE`: Pause clicked while already paused -> no-op.
  - `BR-TIME-02-RESUME-GAME-OVER`: Resume attempt after game end -> blocked.
- **Postconditions**: Pause state is explicit and non-destructive.
- **Function Touchpoints**:
  - `GameControlPanel.pauseRequested`
  - `TimeControlService.getRemainingTime`

### SCN-TIME-03 - Increment Applied After Move
- **Status**: Planned
- **Goal**: Apply configured increment/delay rules correctly.
- **Preconditions**: Incremental time control configured.
- **Entry Points**: Successful move commit.
- **Main Steps**:
  1. User completes legal move.
  2. App calculates elapsed time for mover.
  3. App applies increment/delay policy.
  4. UI updates both clocks.
- **Branch Paths**:
  - `BR-TIME-03-NO-INCREMENT`: Preset has zero increment -> skip add step.
  - `BR-TIME-03-INVALID-CONFIG`: Invalid increment config -> fallback to preset default.
- **Postconditions**: Clock math follows selected time-control policy.
- **Function Touchpoints**:
  - `TimeControlService.applyMove`

  - `GamesStore.makeMove`

### SCN-TIME-04 - Timeout Ends Game
- **Status**: Planned
- **Goal**: Finish game automatically when a player runs out of time.
- **Preconditions**: Clock reaches zero for active side.
- **Entry Points**: Timer tick or move processing.
- **Main Steps**:
  1. A UI timer tick or move-processing boundary asks for an authoritative remaining-time read.
  2. If the time-control service reports expiry, the store finalises timeout once.
  3. App marks game result by time.
  4. Move input is disabled.
  5. History and result metadata are persisted.
- **Branch Paths**:
  - `BR-TIME-04-LAG-COMPENSATE`: Negative time due to render lag -> clamp to zero and finalize once.
  - `BR-TIME-04-ANALYSIS-ONLY`: Analysis mode still allowed after timeout while game result remains fixed.
- **Postconditions**: Timeout result is deterministic and prevents further live play.
- **Function Touchpoints**:
  - `GameView.onTimerTick`
  - `TimeControlService.getRemainingTime`
  - `GamesStore.syncClock`
  - `GamesStore.saveGame`
  - `UiStateStore.showModal`


### SCN-TIME-05 - Menu Actions Auto-Pause Timed Games
- **Status**: Planned
- **Goal**: Prevent clocks from continuing to run while the user opens interrupting menus or modals from a timed game.
- **Preconditions**: Timed game is active; an interrupting menu or modal is triggered from the game screen.
- **Entry Points**: Menu `Save Game`, menu `Settings`, and any other interrupting menu/modal opened from the game screen.
- **Main Steps**:
  1. User opens an interrupting menu or modal from active play.
  2. App checks whether auto-pause-on-menu is enabled for timed games.
  3. If enabled, app pauses the game before opening the interrupted flow.
  4. User completes or cancels the menu/modal flow.
  5. When the user returns to the game screen, app auto-resumes the clock if the pause came from this auto-pause flow.
- **Branch Paths**:
  - `BR-TIME-05-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, the menu action proceeds without changing the clock state.
  - `BR-TIME-05-NON-TIMED-GAME`: If the game has no active clock, no pause action is required.
  - `BR-TIME-05-ALREADY-PAUSED`: If the game is already paused, menu flow continues without changing pause state.
- **Postconditions**: Menu-driven interruptions do not accidentally consume clock time when auto-pause-on-menu is enabled, and normal play resumes automatically on return.
- **Function Touchpoints**:
  - `MenuBar.saveGameRequested`
  - `MenuBar.settingsRequested`
  - `GameControlPanel.pauseRequested`
  - `TimeControlService.getRemainingTime`
  - `UiStateStore.saveGameSession`

### SCN-CTRL-01 - Takeback Action
- **Status**: Current
- **Goal**: Rewind one or more moves.
- **Preconditions**: At least one reversible move exists.
- **Entry Points**: Control panel `Takeback`.
- **Main Steps**:
  1. User clicks `Takeback`.
  2. App applies takeback count policy.
  3. Board/history/clocks move back to target node.
- **Branch Paths**:
  - `BR-CTRL-01-NO-MOVES`: No moves available -> disable button/no-op.
  - `BR-CTRL-01-POLICY-BLOCK`: Takeback disabled by mode/rules -> show blocked reason.
- **Postconditions**: Game state matches selected rewind point.
- **Function Touchpoints**:
  - `GameControlPanel.takeBackRequested`
  - `GamesStore.takeBack`
  - `MoveUpdateService.takeback`
  - `TimeControlService.applyMove` (recompute policy)

### SCN-CTRL-02 - Resign Game
- **Status**: Planned
- **Goal**: End game by resignation with confirmation.
- **Preconditions**: Active non-ended game.
- **Entry Points**: Control panel `Resign`.
- **Main Steps**:
  1. User clicks `Resign`.
  2. App requests confirmation.
  3. On confirm, game result set to resignation.
  4. App disables live moves and persists result.
- **Branch Paths**:
  - `BR-CTRL-02-CANCEL`: User cancels confirmation -> game continues.
  - `BR-CTRL-02-ALREADY-ENDED`: Resign action blocked if game already ended.
- **Postconditions**: Result is final and clearly visible.
- **Function Touchpoints**:
  - `GameControlPanel.resignRequested`
  - `UiStateStore.showModal`
  - `GamesStore.saveGame`

### SCN-CTRL-03 - Draw Offer Flow
- **Status**: Planned
- **Goal**: Support offering and resolving draw outcomes.
- **Preconditions**: Active non-ended game.
- **Entry Points**: Control panel `Offer Draw`.
- **Main Steps**:
  1. User clicks `Offer Draw`.
  2. If the current game is local player versus local player, app opens a shared confirmation dialog for the offer intent.
  3. After a confirmed local-local offer, the store records the offer and app opens a shared draw-resolution dialog for the opposing local side.
  4. If the opponent is engine-controlled or is a future remote seat, app records the offer without using a dialog-hosted response step.
  5. When a non-local side later presents an incoming draw offer, the draw control shows a pending-offer indicator light.
  6. If the user presses `Draw` while that incoming-offer indicator is lit, app accepts immediately and the game is drawn.
- **Branch Paths**:
  - `BR-CTRL-03-CANCEL`: User cancels the local-local offer confirmation -> no draw offer is recorded.
  - `BR-CTRL-03-DECLINED`: Local opponent declines in the draw-resolution dialog -> game continues.
  - `BR-CTRL-03-ENGINE-UNAVAILABLE`: Engine-controlled opponent cannot signal a response -> keep game ongoing and leave the external-response API unused.
  - `BR-CTRL-03-REPEAT-OFFER`: Repeated offer in short window -> throttled/blocked.
- **Postconditions**: Draw resolution is explicit and persisted.
- **Function Touchpoints**:
  - `GameControlPanel.drawRequested`
  - `UiStateStore.showModal`
  - `GamesStore.offerDraw`
  - `GamesStore.resolveDrawOffer`
  - `GamesStore.saveGame`
### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode
- **Status**: Planned
- **Goal**: Enter a mode from an active game where the user controls both sides for exploration without progressing the live game.
- **Preconditions**: Active game is open.
- **Entry Points**: Control panel `Analysis Mode` from a live game.
- **Main Steps**:
  1. User enters in-game analysis mode.
  2. App gives the user move control for both colors.
  3. If engines were configured when the game was created, app refreshes analysis after each committed move.
  4. User explores positions without progressing the live game.
  5. User exits in-game analysis mode and app returns to the live node by default.
- **Branch Paths**:
  - `BR-CTRL-04-EXIT-DIRTY`: Unsaved analysis branch exists -> keep/discard prompt.
  - `BR-CTRL-04-LIVE-CONFLICT`: Attempt to submit live move while in analysis mode -> block or force exit.
- **Postconditions**: Mode boundaries are explicit, the user can explore from either side, and leaving the mode returns the screen to the live game position.
- **Function Touchpoints**:
  - `GameControlPanel.enterInGameAnalysisRequested`
  - `MoveUpdateService.addAnalysisMove`
  - `MoveUpdateService.navigateToNode`
  - `GamesStore.makeMove`

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode
- **Status**: Planned
- **Goal**: Prevent board editing tools from being used inside in-game analysis mode.
- **Preconditions**: In-game analysis mode is active.
- **Entry Points**: Board-edit action attempted from in-game analysis mode.
- **Main Steps**:
  1. User attempts to enter board editing while inside in-game analysis mode.
  2. App blocks the action.
  3. App explains that board editing is only available in free analysis / setup.
- **Branch Paths**:
  - `BR-CTRL-05-GO-TO-SETUP`: If the product offers a shortcut, user may leave the live game context and open free analysis / setup instead.
  - `BR-CTRL-05-CANCEL`: User dismisses the explanation and remains in in-game analysis mode.
- **Postconditions**: Live-game analysis remains move-based only; board editing stays isolated to free analysis / setup.
- **Function Touchpoints**:
  - `UiStateStore.showModal`
  - `UiStateStore.hideModal`

---
## Persistence, File I/O, Settings, and Engine Management

### SCN-SAVE-01 - Autosave on State Mutation
- **Status**: Current
- **Goal**: Persist games/settings after meaningful state changes.
- **Preconditions**: Auto-persist enabled.
- **Entry Points**: Move committed, setting updated, active game changed.
- **Main Steps**:
  1. User performs state-changing action.
  2. App snapshots the current game workspace state, including active position/history node, clocks, and result state.
  3. App serializes changed state.
  4. App writes to storage adapter.
- **Branch Paths**:
  - `BR-SAVE-01-WRITE-FAIL`: Storage write fails -> keep in-memory state and mark dirty for retry.
  - `BR-SAVE-01-THROTTLE`: Rapid changes are batched/debounced to avoid excessive writes.
-- **Postconditions**: Persistence is eventually consistent without blocking UX, and a later restore can reproduce the same game workspace state without blocking on UI or engine snapshots.
- **Function Touchpoints**:
  - `GamesStore.saveGame`
  - `RecentGameStore.recordAutosavedGame`
  - `SettingsStore.saveSettings`
  - `SerializationService.serialiseGame`
  - `StorageAdapter.setGameSessionSnapshot`
  - `UiStateStore.saveGameSession`
  - `UiStateStore.saveLayoutState`

### SCN-SAVE-02 - Manual Save Game to File
- **Status**: Current
- **Goal**: Export active game to user-selected file.
- **Preconditions**: Active game exists.
- **Entry Points**: Menu `Save Game`.
- **Main Steps**:
  1. User chooses save action.
  2. If a timed game is active and auto-pause-on-menu is enabled, app pauses the game before entering the save flow.
  3. App snapshots the current game workspace state.
  4. App opens file dialog.
  5. User selects destination/name.
  6. App serializes and writes file.
  7. When the user returns to the game screen, app auto-resumes if the pause came from this save flow.
- **Branch Paths**:
  - `BR-SAVE-02-CANCEL`: User cancels file dialog -> no write.
  - `BR-SAVE-02-IO-ERROR`: File write fails (permission/path) -> show retry guidance.
  - `BR-SAVE-02-AUTO-PAUSE-DISABLED`: If auto-pause-on-menu is disabled, save proceeds without pausing the clock.
- **Postconditions**: Export either succeeds once or fails with clear recovery path, and a later load can restore the same saved game state.
- **Function Touchpoints**:
  - `MenuBar.saveGameRequested`
  - `GameControlPanel.pauseRequested`
  - `FileIoAdapter.saveGame`
  - `RecentGameStore.recordManuallySavedGame`
  - `SerializationService.serialiseGame`
  - `GamesStore.getGame`
  - `UiStateStore.saveGameSession`
  - `UiStateStore.saveLayoutState`

### SCN-LOAD-01 - Load Valid Game from File
- **Status**: Current
- **Goal**: Import saved game and open it as active context.
- **Preconditions**: Valid supported game file available.
- **Entry Points**: Menu `Load Game`.
- **Main Steps**:
  1. User chooses load action.
  2. User selects file.
  3. App deserializes/migrates payload.
  4. App restores the saved game workspace state immediately, including current position/history node, clock state, and result state.
  5. Game is inserted into store and opened.
  6. If engines are available for the restored context, app resumes live analysis for the restored position after the game state is restored.
- **Branch Paths**:
  - `BR-LOAD-01-DUPLICATE-ID`: Imported game ID collides -> remap ID before insert.
  - `BR-LOAD-01-MIGRATION`: Older schema detected -> migrate then persist upgraded format.
- **Postconditions**: Imported game is available and routable, the user first sees the restored game state from the saved payload, and live analysis resumes afterwards when engines are available.
- **Function Touchpoints**:
  - `MenuBar.loadGameRequested`
  - `FileIoAdapter.loadGame`
  - `SerializationService.deserialiseGame`
  - `SerializationService.migrateGame`
  - `RecentGameStore.recordManuallySavedGame`
  - `GamesStore.insertGame`
  - `UiStateStore.setActiveGame`
  - `UiStateStore.saveGameSession`

### SCN-LOAD-02 - Load Invalid/Corrupt Game File
- **Status**: Planned
- **Goal**: Reject unsupported/corrupt import safely.
- **Preconditions**: User selected malformed or unsupported file.
- **Entry Points**: Menu `Load Game`.
- **Main Steps**:
  1. User selects file.
  2. Deserialization/validation fails.
  3. App displays precise error and keeps current session intact.
- **Branch Paths**:
  - `BR-LOAD-02-UNSUPPORTED`: Unsupported format -> suggest accepted file types.
  - `BR-LOAD-02-PARTIAL-RECOVER`: Recoverable subset parsed -> user chooses continue/cancel import.
- **Postconditions**: No existing game data is overwritten by bad import.
- **Function Touchpoints**:
  - `FileIoAdapter.loadGame`
  - `SerializationService.deserialiseGame`
  - `UiStateStore.showModal`

### SCN-SETTINGS-01 - Update Visual/UI Preferences
- **Status**: Current
- **Goal**: Change app theme mode, piece style, board colors, and UI scaling preferences.
- **Preconditions**: User on settings view.
- **Entry Points**: `/settings`, `/settings/:category`.
- **Main Steps**:
  1. User edits one or more settings fields.
  2. User applies settings to preview or commit the pending changes without leaving the settings view, or saves settings to commit and finish the flow.
  3. App persists settings and applies theme/UI updates for the accepted changes.
  4. When `themeMode = system`, later OS theme changes update app chrome without rewriting the persisted settings snapshot.
- **Branch Paths**:
  - `BR-SETTINGS-01-INVALID-VALUE`: Value fails schema validation -> block save and show field errors.
  - `BR-SETTINGS-01-APPLY-FAIL`: Apply-on-save fails partially -> persist known-good subset.
- **Postconditions**: Approved preferences are applied and persisted.
- **Function Touchpoints**:
  - `SettingsView.onApply`
  - `SettingsView.onSave`
  - `SettingsStore.updateSettings`
  - `SettingsStore.applySettings`
  - `SettingsStore.saveSettings`
  - `AppShell.applyAppearanceProjection`
  - `PlatformServices.getSystemThemeAdapter`
  - `StorageAdapter.setSettingsSnapshot`

### SCN-SETTINGS-02 - Reset Settings to Defaults
- **Status**: Current
- **Goal**: Restore default settings quickly.
- **Preconditions**: User has modified settings.
- **Entry Points**: Settings view `Reset`.
- **Main Steps**:
  1. User clicks reset.
  2. App asks for confirmation.
  3. On confirm, defaults are restored and persisted.
- **Branch Paths**:
  - `BR-SETTINGS-02-CANCEL`: User cancels reset -> no change.
  - `BR-SETTINGS-02-PERSIST-FAIL`: Reset applied in memory but persistence fails -> surface retry.
- **Postconditions**: Settings match defined default schema unless canceled.
- **Function Touchpoints**:
  - `SettingsView.onReset`
  - `SettingsStore.resetSettings`
  - `SettingsStore.saveSettings`
  - `UiStateStore.showModal`

### SCN-ENGINE-01 - Add Engine Configuration
- **Status**: Planned
- **Goal**: Register a new engine for analysis/gameplay.
- **Preconditions**: Settings engine section is available.
- **Entry Points**: Add engine action in settings.
- **Main Steps**:
  1. User opens add-engine form.
  2. User enters profile name and other engine profile values.
  3. User may edit supported engine options through a name/value table inside the profile editor.
  4. App stages the new engine inside the pending settings draft.
  5. User applies or saves the settings flow.
  6. Engine appears in the available list.
- **Branch Paths**:
  - `BR-ENGINE-01-DUPLICATE`: Duplicate engine profile name -> block save until the name is made unique.
- **Postconditions**: Engine list contains unique named profiles staged through the settings draft. Existing seated engine participants inside already-open games remain unchanged until explicitly swapped.
- **Function Touchpoints**:
  - `SettingsStore.updateSettings`
  - `SettingsStore.applySettings`
  - `SettingsStore.saveSettings`
  - `UiStateStore.showModal`

### SCN-ENGINE-02 - Update or Remove Engine Configuration
- **Status**: Planned
- **Goal**: Maintain engine inventory as setups change.
- **Preconditions**: At least one engine exists.
- **Entry Points**: Engine edit/remove action in settings.
- **Main Steps**:
  1. User chooses copy, edit, or delete from an engine profile row.
  2. If editing, the app opens the engine-profile editor and lets the user change general fields and option-table rows.
  3. If copying, the app duplicates the selected profile into the draft.
  4. If deleting, the app removes the selected profile from the draft list.
  5. App validates the edited inventory inside the pending settings draft.
  6. User applies or saves the settings flow.
  7. App persists the updated engine profile list for future assignments.
- **Branch Paths**:
  - `BR-ENGINE-02-DUPLICATE-COPY`: Copied profile keeps a colliding name -> block save until renamed.
  - `BR-ENGINE-02-DELETE-IN-USE`: Deleting a profile already used by an open game leaves existing seated engine participants unchanged but removes that profile from future assignment choices.
- **Postconditions**: The saved engine profile list is updated for future assignments. Existing seated engine participants inside already-open games remain unchanged until explicitly swapped.
- **Function Touchpoints**:
  - `SettingsStore.updateSettings`
  - `SettingsStore.applySettings`
  - `SettingsStore.saveSettings`

### SCN-ENGINE-03 - Change Player Assignment During Game
- **Status**: Planned
- **Goal**: Explicitly reassign one side to `none`, `local`, or a configured engine profile from the player strip.
- **Preconditions**: The current game has a non-remote player seat.
- **Entry Points**: Click the displayed player label in the player strip.
- **Main Steps**:
  1. User clicks the displayed player label for one side in the player strip.
  2. App opens a player-selection dialog scoped to that game and colour.
  3. User chooses `none`, `local`, or one configured engine profile.
  4. If the resulting player setup leaves either side as `none`, app ends the current live game and converts the workspace into `free analysis / setup` from the currently visible position and branch context while preserving the visible move tree/history.
  5. That transition clears live-only result and clock progression so the resulting setup workspace is no longer carrying active live-game timing or finality state.
  6. If the resulting player setup keeps both sides assigned inside the same live game, app preserves the current time control and clock state and continues play with the new seat assignment.
  7. If that preserved live game is now on an engine-controlled side with no valid in-flight request already active for that seat and turn, the normal live engine-turn loop starts from that side.
- **Branch Paths**:
  - `BR-ENGINE-03-SAME-SELECTION`: User selects the already assigned value -> keep the current seat unchanged and close the dialog.
  - `BR-ENGINE-03-TURN-IN-FLIGHT`: The replaced engine had an active turn search -> stop that turn-scoped session before the reassignment is committed.
  - `BR-ENGINE-03-ENGINE-UNAVAILABLE`: Selected engine cannot start for a newly due live turn -> keep the new assignment with unavailable feedback and allow a later retry or another reassignment.
  - `BR-ENGINE-03-REMOTE-DISABLED`: If a future remote-player seat is present, reassignment is disabled for that seat.
- **Postconditions**: Player reassignment updates only the current game. Live games preserve their existing time control and clock state when they stay live, while transitions to `free analysis / setup` preserve board and move-tree history for any later `start game from setup` flow.
- **Function Touchpoints**:
  - `PlayerPanel.playerSelectionRequested`
  - `UiStateStore.showModal`
  - `GamesStore.reassignPlayer`
  - `EnginesStore.stopEngine`
  - `EnginesStore.startPlayerTurn`

---

## Game Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Inactive Game
- **Status**: Planned
- **Goal**: Remove stale game from collection.
- **Preconditions**: More than one game exists; target game is not active.
- **Entry Points**: Tab context menu or game list action.
- **Main Steps**:
  1. User triggers delete on inactive game.
  2. App confirms deletion.
  3. Game is removed from store and persistence.
- **Branch Paths**:
  - `BR-LIFECYCLE-01-CANCEL`: User cancels deletion.
  - `BR-LIFECYCLE-01-NOT-FOUND`: Target missing at commit time -> no-op with refresh.
- **Postconditions**: Deleted game is no longer listed/routable.
- **Function Touchpoints**:
  - `GamesStore.deleteGame`
  - `GamesStore.listGames`
  - `StorageAdapter.removeGame`
  - `UiStateStore.showModal`

### SCN-LIFECYCLE-02 - Delete Active Game and Switch Context
- **Status**: Planned
- **Goal**: Remove current game without leaving invalid route/state.
- **Preconditions**: Active game selected; at least one additional game may exist.
- **Entry Points**: Delete action on active game.
- **Main Steps**:
  1. User confirms delete active game.
  2. App removes game.
  3. App selects fallback game or home.
  4. Router and UI state update.
- **Branch Paths**:
  - `BR-LIFECYCLE-02-HAS-FALLBACK`: Another game exists -> switch to neighbor/first game.
  - `BR-LIFECYCLE-02-LAST-GAME`: No games remain -> route to home/new-game prompt.
- **Postconditions**: No dangling `currentGameId` or invalid game route remains.
- **Function Touchpoints**:
  - `GamesStore.deleteGame`
  - `GamesStore.listGames`
  - `UiStateStore.setActiveGame`
  - `Router.beforeEachRouteGuard`

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
- **Postconditions**: Faster entry into common play modes.
- **Function Touchpoints**:
  - `GamesStore.createGame`
  - `UiStateStore.setActiveGame`

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
- **Function Touchpoints**:
  - `MoveUpdateService.getCurrentPosition`
  - `AnalysisStore.getVisibleAnalysis`
  - `StorageAdapter.setGame`

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
- **Function Touchpoints**:
  - `AnalysisStore.getVisibleAnalysis`
  - `AnalysisPanel.renderAnalysisLines`

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
- **Postconditions**: Exploration becomes faster than manual node clicking.
- **Function Touchpoints**:
  - `MoveUpdateService.navigateToNode`
  - `MoveUpdateService.addAnalysisMove`

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
- **Function Touchpoints**:
  - `EngineClient.subscribeToSessionEvents`
  - `EnginesStore.startAnalysis`
  - `AnalysisStore.getVisibleAnalysis`

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
- **Function Touchpoints**:
  - `GameRuleService.isMoveLegal`
  - `GameRuleService.generateLegalMoves`
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
- **Postconditions**: Core tasks remain usable on mobile aspect ratios.
- **Function Touchpoints**:
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
- **Postconditions**: Power users can migrate larger game sets efficiently.
- **Function Touchpoints**:
  - `FileIoAdapter.loadGame`
  - `FileIoAdapter.saveGame`
  - `GamesStore.createGame`
  - `GamesStore.listGames`

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
- **Function Touchpoints**:
  - `UiStateStore.setActiveGame`
  - `GameControlPanel.pauseRequested`
  - `TimeControlService.getRemainingTime`

---

## Coverage Notes
- All major high-level features from `docs/HighLevel/plan.md` are represented by at least one scenario.
- Every scenario includes at least one explicit non-happy-path branch.
- All branch paths are tied to module-level function touchpoints for low-level design traceability.
- The contract map above provides the baseline trace from each `Current` and `Planned` scenario to the four implementation-shaping contracts.
- `Idea` scenarios are isolated in a dedicated review section, are catalogued in `ideas.md`, and are not implied implementation commitments.
