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
getGame(gameId: string): ReadonlyGame | undefined
listGames(): readonly ReadonlyGame[]
makeMove(game: IGame, move: IMove): Promise<void>
takeBack(game: IGame, moveCount?: number): Promise<void>
navigateToNode(game: IGame, node: IMoveNode): void
getVisibleAnalysis(game: IGame): IVisibleAnalysisSnapshot | undefined
syncClock(game: IGame, nowUtc: ClockTimestamp): Promise<void>
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
moveChessPiece(game: IGame, from: BoardId, to: BoardId): void
clearBoard(game: IGame): void
resetBoardToStartPosition(game: IGame): void
applyBoardEdit(game: IGame, rootPosition: IBoardPosition): void
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
| `GamePositionComposable` | root, rendered and live positions, the move tree, rendered and live paths, hydration, node lineage, and position or node runtime caches |
| `GameStatusComposable` | game, result, result-reason, and draw-offer state plus state-family guards and transitions |
| `GameClockComposable` | time control, clock snapshots, pause reasons, timeout reconciliation, and focus-return registration |
| `GameAnalysisComposable` | persisted analysis snapshots, copied analysis engines, subscriptions, refresh, retry, stop, and visible-analysis projection |
| `GamePlayerTurnComposable` | seated players, player runtime normalisation, pending or deferred player turns, engine move requests, and pondering |
| `GameMoveComposable` | live and analysis move workflows, takeback, history navigation, and in-game analysis transitions |
| `GameBoardEditComposable` | board-edit mode and direct position manipulation workflows |
| `GameWorkspaceComposable` | open-game collection, metadata and options initialisation, creation, setup transition, insertion, and hydration coordination |

The composables are implementation details beneath `useGamesStore`; presentation and sibling stores continue to depend only on the unchanged façade. Cross-area workflows use narrow injected operations, and lower-level composables do not import `GamesStore`. **Why:** game actions span position, history, clock, result, analysis, and turn state; making each area a public sibling store would require same-layer store calls, expose partial workflows, and obscure which boundary owns an atomic action. File boundaries may change, but `GamesStore` must remain the one public mutation authority.

The persisted `IGame` shape remains unchanged. Runtime fields also retain their existing flat `$` representation, with exclusive logical ownership: position fields belong to `GamePositionComposable`, pause and focus registration fields belong to `GameClockComposable`, and pending or deferred turn fields belong to `GamePlayerTurnComposable`. **Why:** changing the shared contract merely to mirror implementation files would create persistence and consumer churn, while leaving ownership implicit would permit two composables to mutate the same field. The invariant is one logical owner per runtime field even if the internal file split changes.

## Responsibilities
- create live games or non-live analysis games from setup input
- accept ownership of caller-supplied saved-game payloads and hydrate those same objects into active in-memory workspaces
- transition a prepared non-live analysis game into a live game without losing its prepared root or move tree
- persist each game's live-analysis display preference alongside the rest of the game state
- retain time-control values supplied at creation or setup by reference, and create persisted player snapshots only when assigning reusable player records to a game
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
- arm one promise-shaped move boundary for every current live turn and start the provider when the due player is non-local
- run the automatic pruning action that discards latest-node live-analysis continuations once a real live move supersedes them
- own `livePath` and `renderedPath` selection on the game, while `MoveHistoryService` stays limited to tree mutation
- expose live game objects through deep-readonly observation contracts; state changes still go through explicit store actions rather than defensive read clones

## State And Settings Notes
- `makeMove` is the explicit game-state dispatcher for moves submitted to the currently rendered board: live play, history rewrite, non-live analysis, live analysis, or a rendered engine suggestion. Blocked states throw before mutation, and promotion is already resolved when the store receives the `IMove`. **Why:** a public method that always meant "commit live" could mutate a different position from the one the user sees, while a generic finaliser flag hid context-specific clock, result, selector, and refresh policies. Only the named live workflow calls `commitLiveMove(...)`.
- `MoveApplicationService.applyMove` only mutates one supplied board position. `GameMoveComposable.commitLiveMove` owns the complete live workflow around that mutation: clock, mainline node, live and rendered paths, runtime caches, result, game state, engine follow-up, and the next player request.
- Analysis moves do not pass through a generic finalisation function or a live-versus-analysis flag. `GameMoveComposable.advanceRenderedAnalysisBranch` owns only rendered-position detachment, in-place application, analysis-node insertion, and explicit rendered-path selection. The live-history, live-analysis, and standalone-analysis commit functions then apply their explicit result, state, branch-exit, and refresh policies. **Why:** these contexts share board application but differ in clock ownership, result updates, selector movement, pruning, and refresh. The former flag-driven `_finaliseMove` hid those differences and could finalise the wrong position reference; consolidation is safe only if each context's policies remain explicit.
- When takeback rewrites history, the rendered node, position, path, and historical clock become live before `commitLiveMove(...)`. **Why:** reversing that order mutates the old live position and attaches the replacement below the wrong parent even though the selected historical node is visible.
- `renderedNode`, `liveNode`, `renderedPosition`, and `livePosition` are optional derived caches. The game owns the single authoritative move tree and persistent paths. The positions reference the same object whenever `renderedPath` identifies `livePath`; an analysis move from that shared node copies the rendered position before applying the move, while navigation back to live restores the alias. Explicit path setters seed or invalidate only their corresponding caches, and move-tree replacement invalidates all four. **Why:** a generic synchronisation pass cannot tell which selector changed and can preserve stale values; cache ownership must follow the mutation that changes its authoritative selector.
- `makeMove` starts per-position analysis refresh in the background after a committed move. Callers do not await analysis restart before reading the updated game state.
- `makeMove` also owns the automatic pruning action for latest-node live-analysis continuations. When live play resumes from the current live node and that node still has exploratory descendants, `GameMoveComposable.commitLiveMove` discards those descendants before the real move is appended.
- App-owned interactions submit moves selected from generated legal targets and are not revalidated inside `GameMoveComposable`. Player-engine output is validated by `EngineRuntimeService.awaitPlayerTurnMove(...)`, including any sequential ponder reply, before it reaches the engine-agnostic state handler. **Why:** duplicating checks in the client, turn handler, and commit path lets asynchronous layers validate against different positions and makes disagreement more likely, not safer. The invariant is validation where untrusted or context-stale input becomes accepted; a future premove is context-stale and must therefore be checked when its intended position becomes current.
- `navigateToNode` is the public history-navigation boundary. It accepts a hydrated `IMoveNode` from the current hydrated tree, verifies membership by tracing `node.$.parent` back to the current root, derives the new `renderedPath`, updates the game selection, and then derives the resulting `gameState`. Moving away from the live node enters the matching `LiveAnalysisFrom*` state, while selecting the live node restores the matching live state. Paused live and paused live-analysis states reject this action through the paused-state assertion boundary. If the node is stale or no longer belongs to the current tree, the navigation request is ignored and the caller refreshes from current store state.
- `getVisibleAnalysis` projects the currently relevant snapshots for the highlighted position from `game.analysis`. It is a read model, not a second store boundary.
- When `gameplayOptions.showLiveAnalysisMoves = true`, selecting a rendered engine suggestion reuses the same state-specific move dispatch as board move entry. Live states commit a real move, live-analysis states remain analysis-only, and non-live analysis states apply ordinary analysis moves.
- `pauseGame` and `resumeGame` apply only while `resultState = ongoing`, and they preserve whichever live-family state is being paused. Manual and menu pause remain limited to timed live-family contexts with an active clock, while analysis-entry pause may still mark untimed live play. Timed live turns become `Paused*Turn`, while live-analysis states become the matching `PausedLiveAnalysisFrom*` state. Pause ownership still prevents menu return from auto-resuming a manually paused game. While paused, gameplay actions are locked apart from `resumeGame(...)` and broader route-leave flows, but player reassignment and analysis-engine management remain allowed as explicit non-play exceptions.
- `syncClock(...)` accepts a `ClockTimestamp`, not a string. **Why:** this action performs elapsed-time arithmetic at the clock ownership boundary; accepting strings would duplicate parsing and permit non-canonical timestamp input below the shared timestamp schema.
- `reassignPlayer` is the explicit per-game player reassignment boundary. It updates one seat to an omitted value or a concrete `IPlayer`, clears obsolete seat-specific runtime intent, transitions a live game to `AnalysisWhiteMove` or `AnalysisBlackMove` when either side becomes unassigned, anchors that transition to the currently highlighted position and branch context, and otherwise preserves the same game.
- `offerDraw` creates or updates `drawOfferState` after the local-versus-local confirmation step or directly for non-local opponents. `acceptDrawOffer` finalises the game as a draw, `declineDrawOffer` clears the unresolved offer while the game continues, and both are valid for the local response dialog or any later non-local participant callback integration.
- `withdrawDrawOffer` is the explicit non-local outgoing-offer boundary. It clears an unresolved outgoing `drawOfferState` without ending the game and is the store action behind pressing a lit `Draw` control when the pending offer direction is `DrawOfferDirection.Outgoing`.
- `addAnalysisEngine` and `removeAnalysisEngine` mutate the current game's ordered analysis snapshot list only. Add accepts the selected reusable engine profile, validates against duplicates and the engine-count limit, then snapshots that profile into a new analysis row with the copied `IAssignedEngine`. Remove targets the current row index, removes that persisted snapshot row from `game.analysis`, and tears down any active runtime owned by that copied engine. These actions remain allowed while paused because they are treated as game-configuration changes rather than gameplay input.
- `enterInGameAnalysis` is valid for live games and for timeout-ended games when post-timeout analysis is allowed. For ongoing live games, entering the mode pauses the live clock under `PauseReason.Analysis` and uses the matching `PausedLiveAnalysisFrom*` state so the live-analysis anchor and visible turn are both preserved. It suppresses engine-turn generation until the live node is restored, and entering the mode does not bypass the same per-game `gameplayOptions.showLiveAnalysisMoves` gate that controls whether live-game engine move targets are rendered.
- `exitInGameAnalysis` is prompt-free in the baseline. It restores `renderedPath` to the live node immediately, removes the analysis-owned pause reason, and then restores either the matching live state or the matching paused live state depending on whether any other pause reason still applies. Any exploratory descendants created from the latest live node remain visible only until a later real live move from that same node supersedes them.
- `createGame` and `startGameFromSetup` accept selected seat assignments directly through request `IPlayer` fields and selected analysis-engine profiles through request `IEngineRecord` fields. They create live states only when both sides are assigned. When either side is unassigned, they create `AnalysisWhiteMove` or `AnalysisBlackMove` based on the prepared board side to move. When they create a live game, they also persist the per-game `gameplayOptions.showLiveAnalysisMoves` choice, which defaults to `false`.
- `reassignPlayer` never starts a fresh live game. Once a game is outside live play, the separate `startGameFromSetup` flow owns collecting fresh settings and creating a new live clock state.
- `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` is the single arming gate for the current live board. It depends on ongoing live state, matching rendered and live selectors, and the absence of an existing turn promise; it does not create separate player-type modes. **Why:** mode-specific gates let local/engine combinations drift and can arm competing owners for one turn. The invariant is at most one current-turn owner, regardless of provider type.
- `IGame.$.pendingPlayerTurnPromise` is the one deferred move promise for the current live turn and is armed for local and engine players alike. `requestPlayerMove(...)` stores it, its engine-agnostic handler, and its `AbortController` before an engine provider can start. Cancellation aborts the signal, rejects the shared deferred with that abort reason, and awaits the existing handler. **Why:** starting the provider first permits fast output to arrive before the completion owner exists; separate provider/UI promises could each run commit handling.
- Local board submission and a guarded engine result both enter `attemptPlayerMove(...)`, settle that same deferred, and await the same handler. The handler commits in live state or records `deferredPlayerMove` when an already running engine turn completes during pause. **Why:** separate handlers duplicated pause and commit policy and let provider timing influence ownership; deferred identity checks ensure a late provider can settle only the turn that started it.
- The single deferred is not a premove queue. Supporting future-turn input requires an ordered queue, intended-position ownership, validation when that position becomes current, and cancellation semantics. A turn record or queue may replace this mechanism only if it preserves single current-turn ownership and rejects stale providers.
- When `reassignPlayer` keeps the game live, the same gate may arm the resulting current turn only when no unresolved turn already belongs to the game runtime. An engine assignment then starts its provider; a local assignment leaves the shared deferred waiting for board submission.
- When a restored or loaded game enters the open-game collection through a committed reopen, internal load, recent reopen, or import flow, `GamesStore.insertGame(...)` rebuilds the persisted game state first and then coordinates analysis refresh from the restored highlighted state when the relevant policy allows it.
- Restore hydration belongs to `GamesStore`, not to `SerializationService` or `SavedGamesStore`. It rebuilds runtime-only move-tree references and resolves `livePath` and `renderedPath` before the game becomes interactive. **Why:** those references depend on active-workspace ownership; hydrating during document validation would introduce state assumptions, while deferring hydration past insertion would leave loaded node traversal silently broken.
- `GamePositionComposable.setRenderedPath` owns persisted-selector bookkeeping only. Public runtime navigation remains node-first and does not expose `MovePath` as an interaction contract.
- Runnable timed active games may own focus-return clock-reconciliation registrations through `PlatformEventService`. Close-trigger autosave registration belongs to `SavedGamesStore` and is coordinated from presentation.
- When `gameplayOptions.showLiveAnalysisMoves = false`, live and live-analysis states stay score-only in the analysis panel. When the toggle is enabled, analysis-panel clicks still reuse the normal move-dispatch path rather than introducing a panel-specific rule.
- Paused-state assertion boundaries apply to paused gameplay mutations, including move submission, history navigation, takeback, draw actions, resignation, in-game-analysis entry, and board-edit entry. Those blocked requests throw rather than silently no-op, and the error message includes the blocked `gameState`.
- Player reassignment and analysis-engine management remain valid while paused as explicit non-play exceptions to the paused gameplay lock.
- If an already guarded player-engine move resolves while the game is paused, `GamesStore` records deferred output only. Once pause clears, it commits that move only if the live turn is ready; otherwise it discards it. **Why:** pause cannot mutate the live position and ownership-changing actions clear the turn runtime, so repeating legality, engine lookup, or pondering would duplicate completed engine-boundary work and could start the same side effect twice.
- If an analysis search resolves while the game is paused, `GamesStore` may still persist the latest valid snapshot for read-only display, but it must not treat that completion as permission to unlock interaction or mutate live game state.
- `enterBoardEdit` is the public toggle for the direct-edit session. Entering board edit from non-live analysis stops analysis first, while calling the same action again leaves `BoardEdit` and restores ordinary non-live analysis so analysis refresh may resume.
- While `gameState = BoardEdit`, board interactions apply direct board edits immediately. The first actual board edit clears prior move history and promotes the edited board to the new root; later board edits in the same session continue mutating that root without a separate confirm action.
- `toggleChessPiece(...)` replaces a different existing piece, removes an equal kind-and-colour piece, or adds the supplied piece to an empty square. `deleteChessPiece(...)` removes a piece when present, `moveChessPiece(...)` relocates the existing source piece, and `clearBoard(...)` empties all occupied squares. Each action asserts `BoardEdit` before validating or mutating input. **Why:** these are public mutation boundaries that can be invoked outside the current UI; relying on hidden controls alone would allow callers to edit a live game.
- `resetBoardToStartPosition(...)` asserts `BoardEdit`, creates the canonical initial position through `GameRuleUtility`, and replaces the edited root immediately while preserving its known start-position runtime metadata.
- Piece manipulation targets the currently rendered position. The first effective mutation promotes that position to the root and clears history; later mutations update the same root and board array in place. Each effective square mutation invalidates `IBoardPosition.$.isStandardInitialPosition` at the mutation point.
- `applyBoardEdit(...)` remains the full-position replacement boundary, asserts `BoardEdit` like the piece-level edit actions, and does not manipulate pieces or alter runtime metadata on the supplied position. **Why:** UI visibility is not authorisation—tests, future components, or imported commands can call public actions directly—so omitting the gate here would bypass the assertions on every piece-level edit path.
- After `addMainlineMove` or `addAnalysisMove`, the store derives the new child lineage from the returned child's hydrated parent links and synchronises the runtime node caches after committing the relevant path.
- `MoveHistoryService` mutates the one authoritative tree in place. After `takeBack`, the returned retained node becomes the rendered and live selection as applicable; rewrite and pruning retain existing node handles and never cause `GamesStore` to install a wrapper tree.

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
- `GamePlayerTurnComposable.requestPlayerMoveIfNeeded` is the internal gate that arms the current live turn and any required non-local provider; it must remain a strict state check rather than a best-effort hint.
- `SavedGamesStore` owns saved-game serialisation, document reads and writes, restore lookup, and external picker flows. `GamesStore` owns only active-workspace creation, insertion, hydration, and gameplay mutation once a payload is already in hand.
- `GamesStore` does not call sibling stores directly. Any engine-profile selection coming from `EnginesStore` is bridged through presentation as a selected reusable profile or equivalent seat-selection result.
- Analysis-engine row identity is the current row index in `game.analysis.snapshots`; duplicate copied engines are blocked so row-targeted actions stay unambiguous.
- Flow docs may refer to owner-private helpers such as duplicate-id repair and workspace hydration. Those helpers remain private beneath the `GamesStore` façade in `GameWorkspaceComposable`; they are not shared utility-layer modules.
