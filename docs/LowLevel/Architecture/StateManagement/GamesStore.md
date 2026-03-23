# GamesStore

## Purpose
Own live game workspaces and coordinate game-state mutations across domain logic, persistence, and engine/runtime stores.

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
removeAnalysisEngine(gameId: string, engineId: string): Promise<void>
enterInGameAnalysis(gameId: string): Promise<void>
exitInGameAnalysis(gameId: string): void
enterBoardEdit(gameId: string): void
confirmBoardEdit(gameId: string, boardRoot: IBoardPosition): Promise<void>
cancelBoardEdit(gameId: string): void
resignGame(gameId: string, colour: PlayerColour): Promise<void>
offerDraw(gameId: string): Promise<void>
resolveDrawOffer(gameId: string, decision: "accept" | "decline"): Promise<void>
pruneFuture(gameId: string, nodeId: string): Promise<void>
saveGame(gameId: string): Promise<void>
exportGame(gameId: string): Promise<void>
importGame(): Promise<IGameWorkspace>
```

## Responsibilities
- restore persisted game workspaces into live workspaces during startup or session recovery
- create live games or free-analysis workspaces from setup input
- transition a prepared setup workspace into a live game without losing its prepared root or move tree
- enforce allowed actions from the state axes and settings policies
- coordinate legal move application, move-tree updates, and clock changes
- reconcile live clocks on timer ticks or focus return so timeout finalisation stays inside the store boundary
- coordinate pause and resume flows for manual controls, menu interruptions, and analysis-mode entry
- change one side's player assignment from the player strip, including transitions from live play into `freeAnalysisSetup` and seat updates while already in setup
- record a draw offer and resolve the response path through an explicit store boundary instead of hiding both phases inside one opaque control-panel action
- add or remove per-game analysis-engine assignments during a game
- persist the canonical `IGameWorkspace` payload for autosave and export
- notify `RecentGameStore` after successful autosave, manual save, and manual import flows so recent history reflects the latest saved target for each game
- ask `EnginesStore` to start analysis or run an engine-controlled turn when the visible or live position changes

## State And Settings Notes
- `makeMove` is the context dispatcher for live current-position play, history rewrite, analysis-only history branching, in-game analysis moves, and free-analysis exploration. Blocked states are rejected before domain mutation.
- `pauseGame` and `resumeGame` apply only to timed `liveGame + currentPosition + ongoing` contexts and track pause ownership so menu return cannot resume a manually paused game.
- `reassignPlayer` is the explicit per-game player reassignment boundary. It updates one seat to `none`, `local`, or an engine profile, stops any obsolete seat-specific engine runtime, transitions a live game to `freeAnalysisSetup` when either side becomes unassigned, anchors that setup transition to the currently visible position and branch context, and otherwise preserves the same live game with the current time control and clock state.
- `offerDraw` creates or updates `drawOfferState` after the local-versus-local confirmation step or directly for non-local opponents, while `resolveDrawOffer` consumes that state, owns the accept or decline branch for local response dialogs and any later non-local participant callback integration, and clears the offer when the draw is resolved.
- If UCI or another non-local participant adapter exposes no draw-response callback, the explicit `resolveDrawOffer` boundary still exists in the design but may remain unused by that adapter.
- An unresolved non-local outgoing draw offer may remain recorded on `drawOfferState` until it is accepted, declined, or superseded by another terminal result.
- `addAnalysisEngine` and `removeAnalysisEngine` mutate the current game's analysis-engine roster only. Add validates against duplicates and the engine-count limit, while remove stops that engine's analysis runtime and clears its visible analysis row for the game.
- `enterInGameAnalysis` is valid for ongoing live games and for timeout-finalised live games where `resultReason = timeout`; in both cases it suppresses engine-turn generation until the live node is restored.
- `createGame` and `startGameFromSetup` create a `liveGame` only when both sides are assigned; `freeAnalysisSetup` is used whenever either side is unassigned.
- `reassignPlayer` never starts a fresh live game. Once a workspace is in `freeAnalysisSetup`, the separate `startGameFromSetup` flow owns collecting fresh settings and creating a new live clock state.
- `_maybeRequestEngineTurn` is the generic live-game gate for `local/engine`, `engine/local`, and `engine/engine`. It depends only on playable live state and the side-to-move assignment, not on a separate engine-vs-engine mode.
- When `reassignPlayer` keeps the workspace as a live game, `_maybeRequestEngineTurn` may run only if the resulting side to move is engine-controlled and there is no still-valid in-flight request for that same seat and turn.
- `importGame` and session restore rebuild the persisted workspace state first, then may request continuous analysis and a player-engine turn only when the restored state is playable live current-position ongoing state.

## Dependencies
- `GameRuleService`
- `MoveUpdateService`
- `TimeControlService`
- `SerializationService`
- `PlatformServices`
- `AnalysisStore`
- `EnginesStore`
- `RecentGameStore`

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-GAME-01` to `SCN-GAME-03`
- `SCN-MOVE-01` to `SCN-MOVE-03`
- `SCN-HIST-01` to `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01`
- `SCN-ANALYSIS-05`
- `SCN-TIME-01` to `SCN-TIME-05`
- `SCN-CTRL-01` to `SCN-CTRL-05`
- `SCN-ENGINE-03`
- `SCN-SAVE-01` to `SCN-LOAD-02`
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`

## Notes
- The public interface is intentionally broad enough to cover every committed game-facing mutation without leaking domain-service calls into presentation code.
- `_maybeRequestEngineTurn` is the internal gate for player-engine move generation and must remain a strict state check rather than a best-effort hint.
- `GamesStore` resolves `StorageAdapter` and `FileIoAdapter` through `usePlatformServicesStore()`.
- `saveGame`, `exportGame`, and `importGame` remain the owning public mutations, but they refresh recent-game metadata through `RecentGameStore` only after the relevant autosave write, file write, or duplicate-ID repair has succeeded.
