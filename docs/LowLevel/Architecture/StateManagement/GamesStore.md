# GamesStore

## Purpose
Own live or open game workspaces, coordinate current-game mutations through layer-2 game services, and execute workspace save and load once a committed flow has resolved the target.

## Public Interface
```ts
enum MakeMoveResultKind {
  Rejected = "rejected",
  PromotionRequired = "promotionRequired",
  Committed = "committed"
}

enum PauseReason {
  Manual = "manual",
  Menu = "menu",
  Analysis = "analysis"
}

interface IMakeMoveResult {
  kind: MakeMoveResultKind
  committedMove: IMove | null
  pendingMove: IMove | null
}

restorePersistedGames(gameIds?: string[]): Promise<IGameWorkspace[]>
createGame(request: ICreateGameRequest): Promise<IGameWorkspace>
saveGame(gameId: string, options: ISaveGameOptions): Promise<string>
loadGame(filePath: string): Promise<IGameWorkspace>
startGameFromSetup(gameId: string, request: IStartGameFromSetupRequest): Promise<void>
insertGame(workspace: IGameWorkspace): Promise<IGameWorkspace>
deleteGame(gameId: string): Promise<void>
getGame(gameId: string): IGameWorkspace | null
listGames(): IGameWorkspace[]
makeMove(gameId: string, move: IMove): Promise<IMakeMoveResult>
takeBack(gameId: string, moveCount?: number): Promise<void>
navigateToNode(gameId: string, node: IMoveNode): void
syncClock(gameId: string, nowUtc: string): Promise<void>
pauseGame(gameId: string, reason: PauseReason): Promise<void>
resumeGame(gameId: string, reason: PauseReason): Promise<void>
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
pruneFuture(gameId: string, path: MovePath): Promise<void>
```

## Responsibilities
- restore persisted game workspaces into live workspaces during startup or session recovery
- create live games or free-analysis workspaces from setup input
- serialise and write the current workspace to autosave, managed-save, or external-file targets once the owning flow has selected that target
- read, deserialise, migrate, and hydrate a saved workspace into the open-game collection once the owning flow has selected a source file
- transition a prepared setup workspace into a live game without losing its prepared root or move tree
- persist each game's live-analysis display preference alongside the rest of the workspace state
- capture assigned-engine snapshots from reusable engine profiles when seating player engines or analysis engines by reading the accepted engine inventory through `UserSettingService`
- enforce allowed actions from the state axes and accepted gameplay or session policies
- coordinate legal move application, move-tree updates, notation, position identity, and clock changes
- reconcile live clocks on timer ticks or focus return so timeout finalisation stays inside the store boundary
- register and tear down session-owned app-close and focus-return callbacks through layer-2 platform-event boundaries when a game session becomes runnable or is torn down
- coordinate pause and resume flows for manual controls, menu interruptions, and analysis-mode entry
- change one side's player assignment from the player strip, including transitions from live play into `WorkspaceKind.FreeAnalysisSetup` and seat updates while already in setup
- record a draw offer and expose explicit accept, decline, and withdraw boundaries instead of hiding draw resolution inside one opaque control-panel action
- add or remove per-game analysis-engine assignments during a game
- return enough move outcome information for presentation-owned promotion flows to decide whether a modal must be opened
- own live and visible path selection on the workspace, while `MoveUpdateService` stays limited to tree mutation

## State And Settings Notes
- `makeMove` is the context dispatcher for live current-position play, history rewrite, analysis-only history branching, in-game analysis moves, free-analysis exploration, and any rendered live-game engine suggestion selected from the analysis panel. Blocked states are rejected before domain mutation, and the returned `IMakeMoveResult` tells the caller whether the move committed, was rejected, or needs explicit promotion completion.
- `navigateToNode` is the public history-navigation boundary. It accepts a hydrated `IMoveNode`, derives the new `visiblePath` by tracing parent references back to the root, updates the workspace visible selection, and then derives the resulting interaction context.
- When `liveAnalysisOptions.showLiveAnalysisMoves = true`, selecting a rendered engine suggestion in a `WorkspaceKind.LiveGame` reuses the same context-specific move path as board move entry: `InteractionContext.CurrentPosition` commits a live move, `InteractionContext.HistoryReview` applies takeback-policy handling, and `InteractionContext.InGameAnalysis` remains analysis-only.
- `pauseGame` and `resumeGame` apply only to timed `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition + ResultState.Ongoing` contexts and track pause ownership so menu return cannot resume a manually paused game.
- `reassignPlayer` is the explicit per-game player reassignment boundary. It updates one seat to `null`, `PlayerType.Local`, or an engine profile, captures a fresh assigned-engine snapshot when a new engine seat is chosen, clears obsolete seat-specific runtime intent, transitions a live game to `WorkspaceKind.FreeAnalysisSetup` when either side becomes unassigned, anchors that setup transition to the currently visible position and branch context, and otherwise preserves the same live game with the current time control and clock state.
- `offerDraw` creates or updates `drawOfferState` after the local-versus-local confirmation step or directly for non-local opponents. `acceptDrawOffer` finalises the game as a draw, `declineDrawOffer` clears the unresolved offer while the game continues, and both are valid for the local response dialog or any later non-local participant callback integration.
- `withdrawDrawOffer` is the explicit non-local outgoing-offer boundary. It clears an unresolved outgoing `drawOfferState` without ending the game and is the store action behind pressing a lit `Draw` control when the pending offer direction is `DrawOfferDirection.Outgoing`.
- If UCI or another non-local participant adapter exposes no draw-response callback, the explicit `acceptDrawOffer` and `declineDrawOffer` boundaries still exist in the design but may remain unused by that adapter.
- An unresolved non-local outgoing draw offer may remain recorded on `drawOfferState` until it is accepted, declined, withdrawn, or superseded by another terminal result.
- `addAnalysisEngine` and `removeAnalysisEngine` mutate the current game's analysis-engine roster only. Add validates against duplicates and the engine-count limit, then snapshots the selected reusable profile into a new assigned-engine entry. Remove targets an existing `assignedEngineId`; the caller-owned flow clears that engine's visible analysis row through `AnalysisStore`.
- `enterInGameAnalysis` is valid for ongoing live games and for timeout-finalised live games where `resultReason = ResultReason.Timeout`; in both cases it suppresses engine-turn generation until the live node is restored, and entering the mode does not bypass the same per-game `liveAnalysisOptions.showLiveAnalysisMoves` gate that controls whether live-game engine move targets are rendered.
- `createGame` and `startGameFromSetup` create a `WorkspaceKind.LiveGame` only when both sides are assigned; `WorkspaceKind.FreeAnalysisSetup` is used whenever either side is unassigned. When they create a live game, they also persist the per-game `liveAnalysisOptions.showLiveAnalysisMoves` choice, which defaults to `false`.
- `reassignPlayer` never starts a fresh live game. Once a workspace is in `WorkspaceKind.FreeAnalysisSetup`, the separate `startGameFromSetup` flow owns collecting fresh settings and creating a new live clock state.
- `GamesStore._canRequestEngineTurn` is the generic live-game gate for `local/engine`, `engine/local`, and `engine/engine`. It depends only on playable live state and the side-to-move assignment, not on a separate engine-vs-engine mode.
- When `reassignPlayer` keeps the workspace as a live game, presentation may call `GameView._requestEngineTurnIfNeeded` only if `GamesStore._canRequestEngineTurn` still reports that the resulting side to move is engine-controlled and there is no still-valid in-flight request for that same seat and turn.
- When a restored workspace enters the open-game collection through a committed load, import, or reopen flow, `GamesStore` rebuilds the persisted workspace state first. Presentation and bootstrap flows may then call `EnginesStore` from the restored visible state when the relevant policy allows it.
- Restore hydration rebuilds runtime-only move-tree references from the persisted nested tree and resolves `livePath` / `visiblePath` before the workspace becomes active live state.
- Runnable game sessions may own app-close autosave and focus-return clock-reconciliation registrations through `PlatformEventService`. Untimed, paused, finished, or otherwise non-runnable contexts do not keep those registrations active.
- `saveGame` owns serialising the current workspace after the calling flow has already decided whether the target is autosave, a named internal save, or an external export path.
- `loadGame` owns reading and hydrating a saved workspace after the calling flow has already resolved the source path from a recent entry, a managed save selection, or an external import picker.
- When `liveAnalysisOptions.showLiveAnalysisMoves = false`, live-game analysis rows stay score-only in `InteractionContext.CurrentPosition`, `InteractionContext.HistoryReview`, and `InteractionContext.InGameAnalysis`. When the toggle is enabled in `InteractionContext.HistoryReview`, analysis-panel clicks still reuse the normal takeback-policy path rather than introducing a panel-specific rewrite rule.

## Dependencies
- `GameRuleService`
- `MoveNotationService`
- `MoveUpdateService`
- `PositionIdentityService`
- `SavedGameIndexService`
- `SavedGameDocumentService`
- `PlatformEventService`
- `SerializationService`
- `TimeControlService`
- `UserSettingService`

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
- `SCN-SAVE-01` to `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`
- `SCN-ENGINE-03`
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`

## Notes
- The public interface is intentionally broad enough to cover every committed game-facing mutation without leaking domain-service calls into presentation code.
- `GamesStore._canRequestEngineTurn` is the internal gate behind player-engine move generation and must remain a strict state check rather than a best-effort hint.
- `SavedGamesStore` owns save browsing, recent-target resolution, and external picker flows. `GamesStore` owns serialising the current workspace and hydrating a saved workspace once the target path is known.
- `GamesStore` uses `SavedGameDocumentService` for raw saved-game document reads, writes, and deletes while keeping workspace serialisation and hydration in-store.
- `GamesStore` does not call sibling stores directly. Any later tab, route, modal, or engine-runtime sequencing is owned by the caller-facing presentation or bootstrap flow that composes this store with the rest of layer 3.
- Flow docs continue to show owner-private functions such as `GamesStore._hydrateWorkspace`, `GamesStore._loadRequestedDocuments`, and `GamesStore._hydrateWorkspaceCollection`. If those share implementation, that implementation is documented under [UtilityIndex.md](../UtilityIndex.md).
