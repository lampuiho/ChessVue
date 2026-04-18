# GamesStore

## Purpose
Own live or open active games, coordinate runtime game mutations through layer-2 services, hydrate inserted workspaces into active runtime state, and act as the only layer-3 owner of game analysis state.

## Public Interface
```ts
enum PauseReason {
  Manual = "manual",
  Menu = "menu",
  Analysis = "analysis"
}

createGame(request: ICreateGameRequest): Promise<IGame>
startGameFromSetup(game: IGame, request: IStartGameFromSetupRequest): Promise<void>
insertGame(game: IGame): Promise<IGame>
getGame(gameId: string): IGame | undefined
listGames(): IGame[]
makeMove(game: IGame, move: IMove): Promise<IMove | undefined>
takeBack(game: IGame, moveCount?: number): Promise<void>
navigateToNode(game: IGame, node: IMoveNode): void
getVisibleAnalysis(game: IGame): IVisibleAnalysisSnapshot | undefined
syncClock(game: IGame, nowUtc: string): Promise<void>
pauseGame(game: IGame, reason: PauseReason): Promise<void>
resumeGame(game: IGame, reason: PauseReason): Promise<void>
reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void>
addAnalysisEngine(game: IGame, engineProfile: IEngineRecord): Promise<void>
removeAnalysisEngine(game: IGame, engineIndex: number): Promise<void>
refreshAnalysis(game: IGame): Promise<void>
retryAnalysis(game: IGame, engineIndex: number): Promise<void>
stopAnalysis(game: IGame, engineIndex?: number): Promise<void>
requestPlayerMove(game: IGame): Promise<IMove | undefined>
enterInGameAnalysis(game: IGame): Promise<void>
exitInGameAnalysis(game: IGame): void
enterBoardEdit(game: IGame): void
confirmBoardEdit(game: IGame, boardRoot: IBoardPosition): Promise<void>
resignGame(game: IGame, colour: PlayerColour): Promise<void>
offerDraw(game: IGame): Promise<void>
acceptDrawOffer(game: IGame): Promise<void>
declineDrawOffer(game: IGame): Promise<void>
withdrawDrawOffer(game: IGame): Promise<void>
```

## Responsibilities
- create live games or non-live analysis games from setup input
- accept caller-supplied saved-game payloads and hydrate them into active in-memory workspaces
- transition a prepared non-live analysis game into a live game without losing its prepared root or move tree
- persist each game's live-analysis display preference alongside the rest of the game state
- capture copied in-game engine snapshots from reusable engine profiles supplied by the owning UI selection flow when seating player engines or analysis engines
- enforce allowed actions from `GameState`, `ResultState`, and accepted gameplay or session policies
- coordinate legal move application, move-tree updates, notation, position identity, and clock changes
- reconcile live clocks on timer ticks or focus return so timeout finalisation stays inside the store boundary
- register and tear down session-owned focus-return callbacks through the layer-2 platform-event boundary when a game session becomes runnable or is torn down
- coordinate pause and resume flows for manual controls and menu interruptions, including deferred engine-output handling while paused
- change one side's player assignment from the player strip, including transitions from live play into non-live analysis and seat updates while already outside live play
- record a draw offer and expose explicit accept, decline, and withdraw boundaries instead of hiding draw resolution inside one opaque control-panel action
- add or remove per-game analysis-engine assignments during a game
- coordinate per-game analysis refresh, retry, stop, persistence, and visible snapshot reads on `IGame.analysis`
- request the next move from a due non-local player through a promise-shaped game-facing boundary
- run the automatic pruning action that discards latest-node live-analysis continuations once a real live move supersedes them
- own `livePath` and `highlightPath` selection on the game, while `MoveUpdateService` stays limited to tree mutation

## State And Settings Notes
- `makeMove` is the game-state dispatcher for live play, history rewrite, non-live analysis branching, live-analysis moves, and rendered analysis suggestions selected from the analysis panel. Blocked states are rejected by a throwing assertion before legality checks or domain mutation. That blocked set includes paused live-analysis states as well as paused live states. Promotion choice is resolved before `makeMove` through board interaction, so the submitted `IMove` is already complete when the store sees it.
- `makeMove` also owns the automatic pruning action for latest-node live-analysis continuations. When live play resumes from the same latest node that previously anchored an exited live-analysis session, `GamesStore._pruneLatestAnalysisContinuationIfNeeded` discards those exploratory descendants before the real move is appended.
- `navigateToNode` is the public history-navigation boundary. It accepts a hydrated `IMoveNode` from the current hydrated tree, verifies membership by tracing `node.$.parent` back to the current root, derives the new `highlightPath`, updates the game selection, and then derives the resulting `gameState`. Moving away from the live node enters the matching `LiveAnalysisFrom*` state, while selecting the live node restores the matching live state. Paused live and paused live-analysis states reject this action through the paused-state assertion boundary. If the node is stale or no longer belongs to the current tree, the navigation request is ignored and the caller refreshes from current store state.
- `getVisibleAnalysis` projects the currently relevant snapshots for the highlighted position from `game.analysis`. It is a read model, not a second store boundary.
- When `liveAnalysisOptions.showLiveAnalysisMoves = true`, selecting a rendered engine suggestion reuses the same state-specific move dispatch as board move entry. Live states commit a real move, live-analysis states remain analysis-only, and non-live analysis states apply ordinary analysis moves.
- `pauseGame` and `resumeGame` apply only while `resultState = ongoing`, and they preserve whichever live-family state is being paused. Manual and menu pause remain limited to timed live-family contexts with an active clock, while analysis-entry pause may still mark untimed live play. Timed live turns become `Paused*Turn`, while live-analysis states become the matching `PausedLiveAnalysisFrom*` state. Pause ownership still prevents menu return from auto-resuming a manually paused game. While paused, gameplay actions are locked apart from `resumeGame(...)` and broader route-leave flows, but player reassignment and analysis-engine management remain allowed as explicit non-play exceptions.
- `reassignPlayer` is the explicit per-game player reassignment boundary. It updates one seat to an omitted value or a concrete `IPlayer`, clears obsolete seat-specific runtime intent, transitions a live game to `AnalysisWhiteMove` or `AnalysisBlackMove` when either side becomes unassigned, anchors that transition to the currently highlighted position and branch context, and otherwise preserves the same game.
- `offerDraw` creates or updates `drawOfferState` after the local-versus-local confirmation step or directly for non-local opponents. `acceptDrawOffer` finalises the game as a draw, `declineDrawOffer` clears the unresolved offer while the game continues, and both are valid for the local response dialog or any later non-local participant callback integration.
- `withdrawDrawOffer` is the explicit non-local outgoing-offer boundary. It clears an unresolved outgoing `drawOfferState` without ending the game and is the store action behind pressing a lit `Draw` control when the pending offer direction is `DrawOfferDirection.Outgoing`.
- `addAnalysisEngine` and `removeAnalysisEngine` mutate the current game's ordered analysis snapshot list only. Add accepts the selected reusable engine profile, validates against duplicates and the engine-count limit, then snapshots that profile into a new analysis row with the copied `IAssignedEngine`. Remove targets the current row index, removes that persisted snapshot row from `game.analysis`, and tears down any active runtime owned by that copied engine. These actions remain allowed while paused because they are treated as game-configuration changes rather than gameplay input.
- `enterInGameAnalysis` is valid for live games and for timeout-ended games when post-timeout analysis is allowed. For ongoing live games, entering the mode pauses the live clock under `PauseReason.Analysis` and uses the matching `PausedLiveAnalysisFrom*` state so the live-analysis anchor and visible turn are both preserved. It suppresses engine-turn generation until the live node is restored, and entering the mode does not bypass the same per-game `liveAnalysisOptions.showLiveAnalysisMoves` gate that controls whether live-game engine move targets are rendered.
- `exitInGameAnalysis` is prompt-free in the baseline. It restores `highlightPath` to the live node immediately, removes the analysis-owned pause reason, and then restores either the matching live state or the matching paused live state depending on whether any other pause reason still applies. Any exploratory descendants created from the latest live node remain visible only until a later real live move from that same node supersedes them.
- `createGame` and `startGameFromSetup` accept selected seat assignments directly through request `IPlayer` fields and selected analysis-engine profiles through request `IEngineRecord` fields. They create live states only when both sides are assigned. When either side is unassigned, they create `AnalysisWhiteMove` or `AnalysisBlackMove` based on the prepared board side to move. When they create a live game, they also persist the per-game `liveAnalysisOptions.showLiveAnalysisMoves` choice, which defaults to `false`.
- `reassignPlayer` never starts a fresh live game. Once a game is outside live play, the separate `startGameFromSetup` flow owns collecting fresh settings and creating a new live clock state.
- `GamesStore._canRequestPlayerMove` is the generic live-game gate for any non-local player implementation. It depends only on playable live state and the side-to-move assignment, not on a separate engine-vs-engine mode.
- When `reassignPlayer` keeps the game live, `GamesStore` may immediately request the next move only if `GamesStore._canRequestPlayerMove` still reports that the resulting side to move is a non-local active player and there is no still-valid in-flight request for that same seat and turn.
- When a restored or loaded game enters the open-game collection through a committed reopen, internal load, recent reopen, or import flow, `GamesStore.insertGame(...)` rebuilds the persisted game state first and then coordinates analysis refresh from the restored highlighted state when the relevant policy allows it.
- Restore hydration belongs to `GamesStore`, not to `SerializationService` or `SavedGamesStore`. That hydration rebuilds runtime-only move-tree references from the persisted nested tree and resolves `livePath` and `highlightPath` before the game becomes active live state.
- `_setHighlightPathFromNode` is store-internal persisted-selector bookkeeping only. Public runtime navigation remains node-first and does not expose `MovePath` as an interaction contract.
- Runnable timed active games may own focus-return clock-reconciliation registrations through `PlatformEventService`. Close-trigger autosave registration belongs to `SavedGamesStore` and is coordinated from presentation.
- When `liveAnalysisOptions.showLiveAnalysisMoves = false`, live and live-analysis states stay score-only in the analysis panel. When the toggle is enabled, analysis-panel clicks still reuse the normal move-dispatch path rather than introducing a panel-specific rule.
- Paused-state assertion boundaries apply to paused gameplay mutations, including move submission, history navigation, takeback, draw actions, resignation, in-game-analysis entry, and board-edit entry. Those blocked requests throw rather than silently no-op, and the error message includes the blocked `gameState`.
- Player reassignment and analysis-engine management remain valid while paused as explicit non-play exceptions to the paused gameplay lock.
- If a player-engine turn search resolves while the game is paused, `GamesStore` records deferred output only. Once pause clears back to a playable live state, it revalidates the deferred move against the current live position before committing it; stale deferred output is discarded and the normal player-move gate decides whether to request a fresh search instead.
- If an analysis search resolves while the game is paused, `GamesStore` may still persist the latest valid snapshot for read-only display, but it must not treat that completion as permission to unlock interaction or mutate live game state.
- After `addMainlineMove` or `addAnalysisMove`, the store derives the new child lineage from the selected parent plus the appended child index, then reacquires the hydrated node from the returned tree before committing game selection.
- After `takeBack`, `rewriteMainline`, or latest-node analysis cleanup through `pruneFutureMoves`, the store derives the surviving live and highlighted lineage from the pre-mutation selected node and the documented coercion rules, then reacquires the corresponding hydrated nodes from the returned tree.

## Dependencies
- `GameRuleService`
- `MoveNotationService`
- `MoveUpdateService`
- `PositionIdentityService`
- `PlatformEventService`
- `TimeControlService`
- `UserSettingService`
- `EngineRuntimeService`

## Scenario Coverage
- `SCN-GAME-01` to `SCN-GAME-03`
- `SCN-MOVE-01` to `SCN-MOVE-03`
- `SCN-HIST-01` to `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01`
- `SCN-ANALYSIS-04`
- `SCN-ANALYSIS-05`
- `SCN-TIME-01` to `SCN-TIME-05`
- `SCN-CTRL-01` to `SCN-CTRL-05`
- `SCN-ENGINE-03`

## Notes
- The public interface is intentionally broad enough to cover every committed game-facing mutation without leaking domain-service calls into presentation code.
- `GamesStore._canRequestPlayerMove` is the internal gate behind non-local move generation and must remain a strict state check rather than a best-effort hint.
- `SavedGamesStore` owns saved-game serialisation, document reads and writes, restore lookup, and external picker flows. `GamesStore` owns only active-workspace creation, insertion, hydration, and gameplay mutation once a payload is already in hand.
- `GamesStore` does not call sibling stores directly. Any engine-profile selection coming from `EnginesStore` is bridged through presentation as a selected reusable profile or equivalent seat-selection result.
- Analysis-engine row identity is the current row index in `game.analysis.snapshots`; duplicate copied engines are blocked so row-targeted actions stay unambiguous.
- Flow docs may refer to owner-private helpers such as duplicate-id repair and workspace hydration. Those helpers remain private to `GamesStore`; they are not shared utility-layer modules.
