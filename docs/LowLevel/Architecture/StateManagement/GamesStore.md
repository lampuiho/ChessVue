# GamesStore

## Purpose
Own live or open game workspaces and coordinate current-game mutations through layer-2 game services.

## Public Interface
```ts
restorePersistedGames(gameIds?: string[]): Promise<IGameWorkspace[]>
createGame(request: ICreateGameRequest): Promise<IGameWorkspace>
startGameFromSetup(gameId: string, request: IStartGameFromSetupRequest): Promise<void>
insertGame(workspace: IGameWorkspace): Promise<IGameWorkspace>
deleteGame(gameId: string): Promise<void>
getGame(gameId: string): IGameWorkspace | null
listGames(): IGameWorkspace[]
makeMove(gameId: string, move: IMove): Promise<void>
takeBack(gameId: string, moveCount?: number): Promise<void>
navigateToNode(gameId: string, nodeId: string): void
syncClock(gameId: string, nowUtc: string): Promise<void>
pauseGame(gameId: string, reason: "manual" | "menu" | "analysis"): Promise<void>
resumeGame(gameId: string, reason: "manual" | "menu" | "analysis"): Promise<void>
reassignPlayer(gameId: string, colour: PlayerColour, request: IReassignPlayerRequest): Promise<void>
addAnalysisEngine(gameId: string, engineId: string): Promise<void>
removeAnalysisEngine(gameId: string, assignedEngineId: string): Promise<void>
enterInGameAnalysis(gameId: string): Promise<void>
exitInGameAnalysis(gameId: string): void
enterBoardEdit(gameId: string): void
confirmBoardEdit(gameId: string, boardRoot: IBoardPosition): Promise<void>
cancelBoardEdit(gameId: string): void
resignGame(gameId: string, colour: PlayerColour): Promise<void>
offerDraw(gameId: string): Promise<void>
acceptDrawOffer(gameId: string): Promise<void>
declineDrawOffer(gameId: string): Promise<void>
withdrawDrawOffer(gameId: string): Promise<void>
pruneFuture(gameId: string, nodeId: string): Promise<void>
```

## Responsibilities
- restore persisted game workspaces into live workspaces during startup or session recovery
- create live games or free-analysis workspaces from setup input
- transition a prepared setup workspace into a live game without losing its prepared root or move tree
- persist each game's live-analysis display preference alongside the rest of the workspace state
- capture assigned-engine snapshots from reusable engine profiles when seating player engines or analysis engines
- enforce allowed actions from the state axes and settings policies
- coordinate legal move application, move-tree updates, notation, position identity, and clock changes
- reconcile live clocks on timer ticks or focus return so timeout finalisation stays inside the store boundary
- coordinate pause and resume flows for manual controls, menu interruptions, and analysis-mode entry
- change one side's player assignment from the player strip, including transitions from live play into `freeAnalysisSetup` and seat updates while already in setup
- record a draw offer and expose explicit accept, decline, and withdraw boundaries instead of hiding draw resolution inside one opaque control-panel action
- add or remove per-game analysis-engine assignments during a game
- emit the engine-turn and analysis-refresh intents required after live or visible position changes without directly calling sibling stores

## State And Settings Notes
- `makeMove` is the context dispatcher for live current-position play, history rewrite, analysis-only history branching, in-game analysis moves, free-analysis exploration, and any rendered live-game engine suggestion selected from the analysis panel. Blocked states are rejected before domain mutation.
- When `liveAnalysisOptions.showLiveAnalysisMoves = true`, selecting a rendered engine suggestion in a `liveGame` reuses the same context-specific move path as board move entry: `currentPosition` commits a live move, `historyReview` applies takeback-policy handling, and `inGameAnalysis` remains analysis-only.
- `pauseGame` and `resumeGame` apply only to timed `liveGame + currentPosition + ongoing` contexts and track pause ownership so menu return cannot resume a manually paused game.
- `reassignPlayer` is the explicit per-game player reassignment boundary. It updates one seat to `none`, `local`, or an engine profile, captures a fresh assigned-engine snapshot when a new engine seat is chosen, clears obsolete seat-specific runtime intent, transitions a live game to `freeAnalysisSetup` when either side becomes unassigned, anchors that setup transition to the currently visible position and branch context, and otherwise preserves the same live game with the current time control and clock state.
- `offerDraw` creates or updates `drawOfferState` after the local-versus-local confirmation step or directly for non-local opponents. `acceptDrawOffer` finalises the game as a draw, `declineDrawOffer` clears the unresolved offer while the game continues, and both are valid for the local response dialog or any later non-local participant callback integration.
- `withdrawDrawOffer` is the explicit non-local outgoing-offer boundary. It clears an unresolved outgoing `drawOfferState` without ending the game and is the store action behind pressing a lit `Draw` control when the pending offer direction is `outgoing`.
- If UCI or another non-local participant adapter exposes no draw-response callback, the explicit `acceptDrawOffer` and `declineDrawOffer` boundaries still exist in the design but may remain unused by that adapter.
- An unresolved non-local outgoing draw offer may remain recorded on `drawOfferState` until it is accepted, declined, withdrawn, or superseded by another terminal result.
- `addAnalysisEngine` and `removeAnalysisEngine` mutate the current game's analysis-engine roster only. Add validates against duplicates and the engine-count limit, then snapshots the selected reusable profile into a new assigned-engine entry. Remove targets an existing `assignedEngineId` and clears that engine's visible analysis row for the game.
- `enterInGameAnalysis` is valid for ongoing live games and for timeout-finalised live games where `resultReason = timeout`; in both cases it suppresses engine-turn generation until the live node is restored, and entering the mode does not bypass the same per-game `liveAnalysisOptions.showLiveAnalysisMoves` gate that controls whether live-game engine move targets are rendered.
- `createGame` and `startGameFromSetup` create a `liveGame` only when both sides are assigned; `freeAnalysisSetup` is used whenever either side is unassigned. When they create a live game, they also persist the per-game `liveAnalysisOptions.showLiveAnalysisMoves` choice, which defaults to `false`.
- `reassignPlayer` never starts a fresh live game. Once a workspace is in `freeAnalysisSetup`, the separate `startGameFromSetup` flow owns collecting fresh settings and creating a new live clock state.
- `_maybeRequestEngineTurn` is the generic live-game gate for `local/engine`, `engine/local`, and `engine/engine`. It depends only on playable live state and the side-to-move assignment, not on a separate engine-vs-engine mode.
- When `reassignPlayer` keeps the workspace as a live game, `_maybeRequestEngineTurn` may run only if the resulting side to move is engine-controlled and there is no still-valid in-flight request for that same seat and turn.
- When a restored workspace enters the open-game collection through a committed load, import, or reopen flow, `GamesStore` rebuilds the persisted workspace state first, then may emit continuous-analysis or player-engine-turn intent only when the restored state is playable live current-position ongoing state.
- When `liveAnalysisOptions.showLiveAnalysisMoves = false`, live-game analysis rows stay score-only in `currentPosition`, `historyReview`, and `inGameAnalysis`. When the toggle is enabled in `historyReview`, analysis-panel clicks still reuse the normal takeback-policy path rather than introducing a panel-specific rewrite rule.

## Dependencies
- `GameRuleService`
- `MoveNotationService`
- `MoveUpdateService`
- `PositionIdentityService`
- `TimeControlService`

## Scenario Coverage
- `SCN-SESSION-02`
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
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`

## Notes
- The public interface is intentionally broad enough to cover every committed game-facing mutation without leaking domain-service calls into presentation code.
- `_maybeRequestEngineTurn` is the internal gate for player-engine move generation and must remain a strict state check rather than a best-effort hint.
- `GamesStore` owns the current or open workspace only. Save/load/import/export orchestration belongs to `SavedGamesStore`.
- `GamesStore` does not call sibling stores directly. Any later tab, route, recent, or engine-runtime sequencing is owned by the caller-facing workflow that composes this store with the rest of layer 3.
