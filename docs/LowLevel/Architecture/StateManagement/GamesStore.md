# GamesStore

## Purpose
Provide the single Pinia façade for live or open active games while composing focused game-state composables that coordinate runtime mutations through layer-2 services. The façade preserves one public game boundary; its internal composables own distinct areas of `IGame` and active runtime state.

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
makeMove(game: IGame, move: IMove): IMove | undefined
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
enterInGameAnalysis(game: IGame): Promise<void>
exitInGameAnalysis(game: IGame): void
enterBoardEdit(game: IGame): void
toggleChessPiece(game: IGame, boardId: BoardId, piece: IChessPiece): void
deleteChessPiece(game: IGame, boardId: BoardId): void
clearBoard(game: IGame): void
resetBoardToStartPosition(game: IGame): void
applyBoardEdit(game: IGame, boardRoot: IBoardPosition): void
resignGame(game: IGame, colour: PlayerColour): Promise<void>
offerDraw(game: IGame): Promise<void>
acceptDrawOffer(game: IGame): Promise<void>
declineDrawOffer(game: IGame): Promise<void>
withdrawDrawOffer(game: IGame): Promise<void>
```

## Internal Composition

`GamesStore` is the composition root and explicit public façade for these internal state-layer composables:

| Composable | Owned area |
| --- | --- |
| `GamePositionComposable` | root and rendered positions, move tree, live and highlighted paths, hydration, node lineage, and position or node runtime caches |
| `GameStatusComposable` | game, result, result-reason, and draw-offer state plus state-family guards and transitions |
| `GameClockComposable` | time control, clock snapshots, pause reasons, timeout reconciliation, and focus-return registration |
| `GameAnalysisComposable` | persisted analysis snapshots, copied analysis engines, subscriptions, refresh, retry, stop, and visible-analysis projection |
| `GamePlayerTurnComposable` | seated players, player runtime normalisation, pending or deferred player turns, engine move requests, and pondering |
| `GameMoveComposable` | live and analysis move workflows, takeback, history navigation, and in-game analysis transitions |
| `GameBoardEditComposable` | board-edit mode and direct position manipulation workflows |
| `GameWorkspaceComposable` | open-game collection, metadata and options initialisation, creation, setup transition, insertion, and hydration coordination |

The composables are implementation details beneath `useGamesStore`; presentation and sibling stores continue to depend only on the unchanged façade. Cross-area workflows use narrow injected operations, and lower-level composables do not import `GamesStore`.

The persisted `IGame` shape remains unchanged. Runtime fields also retain their existing flat `$` representation, with exclusive logical ownership: position fields belong to `GamePositionComposable`, pause and focus registration fields belong to `GameClockComposable`, and pending or deferred turn fields belong to `GamePlayerTurnComposable`.

## Responsibilities
- create live games or non-live analysis games from setup input
- accept caller-supplied saved-game payloads and hydrate them into active in-memory workspaces
- transition a prepared non-live analysis game into a live game without losing its prepared root or move tree
- persist each game's live-analysis display preference alongside the rest of the game state
- capture copied in-game engine snapshots from reusable engine profiles supplied by the owning UI selection flow when seating player engines or analysis engines
- enforce allowed actions from `GameState`, `ResultState`, and accepted gameplay or session policies, including each game's persisted takeback policy
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
- own `livePath` and `renderedPath` selection on the game, while `MoveHistoryService` stays limited to tree mutation

## State And Settings Notes
- `makeMove` is the explicit game-state dispatcher for live play, history rewrite, non-live analysis branching, live-analysis moves, and rendered analysis suggestions selected from the analysis panel. Blocked states are rejected by a throwing assertion before legality checks or domain mutation. That blocked set includes paused live-analysis states as well as paused live states. Promotion choice is resolved before `makeMove` through board interaction, so the submitted `IMove` is already complete when the store sees it.
- `MoveApplicationService.applyMove` only mutates one supplied board position. `GamesStore._commitLiveMove` owns the complete live workflow around that mutation: clock, mainline node, live and rendered paths, runtime caches, result, game state, engine follow-up, and the next player request.
- Analysis moves do not pass through a generic finalisation function or a live-versus-analysis flag. `_advanceRenderedAnalysisBranch` owns only rendered-position detachment, in-place application, analysis-node insertion, rendered-path selection, and node-cache synchronisation. The live-history, live-analysis, and standalone-analysis commit functions then apply their explicit result, state, branch-exit, and refresh policies.
- `renderedPosition` and `livePosition` are optional lazy caches. They reference the same object whenever `renderedPath` identifies `livePath`; an analysis move from that shared node copies the rendered position before applying the move, while navigation back to live restores the alias. When the paths differ, neither workflow may repoint one cache to the other node's position.
- `makeMove` starts per-position analysis refresh in the background after a committed move. Callers do not await analysis restart before reading the updated game state.
- `makeMove` also owns the automatic pruning action for latest-node live-analysis continuations. When live play resumes from the current live node and that node still has exploratory descendants, `GamesStore._pruneLatestAnalysisContinuationIfNeeded` discards those descendants before the real move is appended.
- `navigateToNode` is the public history-navigation boundary. It accepts a hydrated `IMoveNode` from the current hydrated tree, verifies membership by tracing `node.$.parent` back to the current root, derives the new `renderedPath`, updates the game selection, and then derives the resulting `gameState`. Moving away from the live node enters the matching `LiveAnalysisFrom*` state, while selecting the live node restores the matching live state. Paused live and paused live-analysis states reject this action through the paused-state assertion boundary. If the node is stale or no longer belongs to the current tree, the navigation request is ignored and the caller refreshes from current store state.
- `getVisibleAnalysis` projects the currently relevant snapshots for the highlighted position from `game.analysis`. It is a read model, not a second store boundary.
- When `gameplayOptions.showLiveAnalysisMoves = true`, selecting a rendered engine suggestion reuses the same state-specific move dispatch as board move entry. Live states commit a real move, live-analysis states remain analysis-only, and non-live analysis states apply ordinary analysis moves.
- `pauseGame` and `resumeGame` apply only while `resultState = ongoing`, and they preserve whichever live-family state is being paused. Manual and menu pause remain limited to timed live-family contexts with an active clock, while analysis-entry pause may still mark untimed live play. Timed live turns become `Paused*Turn`, while live-analysis states become the matching `PausedLiveAnalysisFrom*` state. Pause ownership still prevents menu return from auto-resuming a manually paused game. While paused, gameplay actions are locked apart from `resumeGame(...)` and broader route-leave flows, but player reassignment and analysis-engine management remain allowed as explicit non-play exceptions.
- `reassignPlayer` is the explicit per-game player reassignment boundary. It updates one seat to an omitted value or a concrete `IPlayer`, clears obsolete seat-specific runtime intent, transitions a live game to `AnalysisWhiteMove` or `AnalysisBlackMove` when either side becomes unassigned, anchors that transition to the currently highlighted position and branch context, and otherwise preserves the same game.
- `offerDraw` creates or updates `drawOfferState` after the local-versus-local confirmation step or directly for non-local opponents. `acceptDrawOffer` finalises the game as a draw, `declineDrawOffer` clears the unresolved offer while the game continues, and both are valid for the local response dialog or any later non-local participant callback integration.
- `withdrawDrawOffer` is the explicit non-local outgoing-offer boundary. It clears an unresolved outgoing `drawOfferState` without ending the game and is the store action behind pressing a lit `Draw` control when the pending offer direction is `DrawOfferDirection.Outgoing`.
- `addAnalysisEngine` and `removeAnalysisEngine` mutate the current game's ordered analysis snapshot list only. Add accepts the selected reusable engine profile, validates against duplicates and the engine-count limit, then snapshots that profile into a new analysis row with the copied `IAssignedEngine`. Remove targets the current row index, removes that persisted snapshot row from `game.analysis`, and tears down any active runtime owned by that copied engine. These actions remain allowed while paused because they are treated as game-configuration changes rather than gameplay input.
- `enterInGameAnalysis` is valid for live games and for timeout-ended games when post-timeout analysis is allowed. For ongoing live games, entering the mode pauses the live clock under `PauseReason.Analysis` and uses the matching `PausedLiveAnalysisFrom*` state so the live-analysis anchor and visible turn are both preserved. It suppresses engine-turn generation until the live node is restored, and entering the mode does not bypass the same per-game `gameplayOptions.showLiveAnalysisMoves` gate that controls whether live-game engine move targets are rendered.
- `exitInGameAnalysis` is prompt-free in the baseline. It restores `renderedPath` to the live node immediately, removes the analysis-owned pause reason, and then restores either the matching live state or the matching paused live state depending on whether any other pause reason still applies. Any exploratory descendants created from the latest live node remain visible only until a later real live move from that same node supersedes them.
- `createGame` and `startGameFromSetup` accept selected seat assignments directly through request `IPlayer` fields and selected analysis-engine profiles through request `IEngineRecord` fields. They create live states only when both sides are assigned. When either side is unassigned, they create `AnalysisWhiteMove` or `AnalysisBlackMove` based on the prepared board side to move. When they create a live game, they also persist the per-game `gameplayOptions.showLiveAnalysisMoves` choice, which defaults to `false`.
- `reassignPlayer` never starts a fresh live game. Once a game is outside live play, the separate `startGameFromSetup` flow owns collecting fresh settings and creating a new live clock state.
- `GamesStore._canRequestPlayerMove` is the generic live-game gate for any non-local player implementation. It depends only on playable live state and the side-to-move assignment, not on a separate engine-vs-engine mode.
- `IGame.$.pendingPlayerTurnPromise` is a deferred move promise for the current live turn and is armed for every live turn, including local turns. Engine turns resolve it from `EngineRuntimeService.awaitPlayerTurnMove(...)`, while local turns resolve it from board move submission.
- `GamesStore` only creates the async pending-turn handler when a non-local player turn is actually requested. Local move submission commits synchronously after resolving the same deferred turn promise.
- When `reassignPlayer` keeps the game live, `GamesStore` may immediately request the next move only if `GamesStore._canRequestPlayerMove` still reports that the resulting side to move is a non-local active player and there is no unresolved in-flight engine-turn request already owned by that game runtime.
- When a restored or loaded game enters the open-game collection through a committed reopen, internal load, recent reopen, or import flow, `GamesStore.insertGame(...)` rebuilds the persisted game state first and then coordinates analysis refresh from the restored highlighted state when the relevant policy allows it.
- Restore hydration belongs to `GamesStore`, not to `SerializationService` or `SavedGamesStore`. That hydration rebuilds runtime-only move-tree references from the persisted nested tree and resolves `livePath` and `renderedPath` before the game becomes active live state.
- `_setHighlightPathFromNode` is store-internal persisted-selector bookkeeping only. Public runtime navigation remains node-first and does not expose `MovePath` as an interaction contract.
- Runnable timed active games may own focus-return clock-reconciliation registrations through `PlatformEventService`. Close-trigger autosave registration belongs to `SavedGamesStore` and is coordinated from presentation.
- When `gameplayOptions.showLiveAnalysisMoves = false`, live and live-analysis states stay score-only in the analysis panel. When the toggle is enabled, analysis-panel clicks still reuse the normal move-dispatch path rather than introducing a panel-specific rule.
- Paused-state assertion boundaries apply to paused gameplay mutations, including move submission, history navigation, takeback, draw actions, resignation, in-game-analysis entry, and board-edit entry. Those blocked requests throw rather than silently no-op, and the error message includes the blocked `gameState`.
- Player reassignment and analysis-engine management remain valid while paused as explicit non-play exceptions to the paused gameplay lock.
- If a live-turn move resolves while the game is paused, `GamesStore` records deferred output only. Once pause clears back to a playable live state, it revalidates the deferred move against the current live position before committing it; stale deferred output is discarded and the normal player-move gate decides whether to request a fresh engine search instead.
- If an analysis search resolves while the game is paused, `GamesStore` may still persist the latest valid snapshot for read-only display, but it must not treat that completion as permission to unlock interaction or mutate live game state.
- `enterBoardEdit` is the public toggle for the direct-edit session. Entering board edit from non-live analysis stops analysis first, while calling the same action again leaves `BoardEdit` and restores ordinary non-live analysis so analysis refresh may resume.
- While `gameState = BoardEdit`, board interactions apply direct board edits immediately. The first actual board edit clears prior move history and promotes the edited board to the new root; later board edits in the same session continue mutating that root without a separate confirm action.
- `toggleChessPiece(...)` replaces a different existing piece, removes an equal kind-and-colour piece, or adds the supplied piece to an empty square. `deleteChessPiece(...)` removes a piece when present, and `clearBoard(...)` empties all occupied squares. All three assert `BoardEdit` before validating or mutating input.
- `resetBoardToStartPosition(...)` asserts `BoardEdit`, creates the canonical initial position through `GameRuleUtility`, and replaces the edited root immediately while preserving its known start-position runtime metadata.
- Piece manipulation targets the currently rendered position. The first effective mutation promotes that position to the root and clears history; later mutations update the same root and board array in place. Each effective square mutation invalidates `IBoardPosition.$.isStandardInitialPosition` at the mutation point.
- `applyBoardEdit(...)` remains the full-position replacement boundary and does not manipulate pieces or alter runtime metadata on the supplied position.
- After `addMainlineMove` or `addAnalysisMove`, the store derives the new child lineage from the returned child's hydrated parent links and synchronises the runtime node caches after committing the relevant path.
- After `takeBack`, `rewriteMainline`, or latest-node analysis cleanup through `pruneFutureMoves`, the store derives the surviving live and highlighted lineage from the pre-mutation selected node and the documented coercion rules, then reacquires the corresponding hydrated nodes from the returned tree.

## Dependencies
- `GamePositionComposable`
- `GameStatusComposable`
- `GameClockComposable`
- `GameAnalysisComposable`
- `GamePlayerTurnComposable`
- `GameMoveComposable`
- `GameBoardEditComposable`
- `GameWorkspaceComposable`

The composed implementation depends on `MoveApplicationService`, `MoveHistoryService`, `PositionIdentityService`, `PlatformEventService`, `TimeControlService`, `UserSettingService`, and `EngineRuntimeService`.

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
- Flow docs may refer to owner-private helpers such as duplicate-id repair and workspace hydration. Those helpers remain private beneath the `GamesStore` façade in `GameWorkspaceComposable`; they are not shared utility-layer modules.
