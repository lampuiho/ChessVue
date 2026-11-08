# Gameplay And Control Flows

## Scope
This document covers `SCN-MOVE-01` to `SCN-MOVE-04`, `SCN-HIST-01` to `SCN-HIST-04`, `SCN-TIME-01` to `SCN-TIME-05`, `SCN-CTRL-01` to `SCN-CTRL-06` and `SCN-ENGINE-03`, plus the live player-turn request that drives Local, premove and Engine turns. `SCN-CTRL-06` is the game-end prompt raised after any result. Analysis seats, board editing, setup and analysis after a result are in [AnalysisAndSetup.md](AnalysisAndSetup.md). Engine process and protocol ownership are in [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md).

Reading notes:

- `GamesStore` composes the per-concern composables in `src/state/game/` and exposes most actions as direct aliases. Tables name the defining module, for example `GameMoveComposable.commitLiveMove`. Only `makeMove`, `_commitHistoryRewriteMove`, `takeBack`, `navigateToNode`, `exitInGameAnalysis`, `resumeGame`, `resignGame` and `acceptDrawOffer` have store bodies. **Why:** those actions must cancel the player turn before a lower mutation or request a successor turn after it. Coordinating them in the store keeps `GameMoveComposable`, `GameClockComposable` and `GameStatusComposable` free of upward calls into `GamePlayerTurnComposable`, which was the dependency cycle removed by the [store dependency restructuring](../../ArchivedPlans/StoreDependencyFunctionFlows.md). Moving such a call back into a lower composable reintroduces that cycle; a replacement must keep the dependency direction one-way.
- Shared utilities from `src/utility`, such as the chess rule functions, stay out of the tables; the flow notes name them. See [UtilityIndex](../Architecture/UtilityIndex.md). `OperationOwner` appears in tables because it is the ownership boundary of view playback.
- *(background)* marks work that the caller starts but does not await.

Persistence note: no gameplay action in this document writes a save directly. `GameRecordComposable.moveCommitted` queues `SavedGamesStore.saveGame(game, { targetKind: Autosave })` every `gameSession.autosaveAfterMoveCount` committed moves, counting actual and analysis moves. The app-close autosave covers the rest; see [PersistenceAndAdministration.md](PersistenceAndAdministration.md). Resignation, draw agreement and timeout do not trigger a save themselves. Their result reaches disk through the next autosave, the close autosave or an explicit save from the game-end prompt.

## Move Execution

### SCN-MOVE-01 - Legal Move on Board

#### Flow A - Local Move At The Live Position
| `Chessboard._commitTarget(boardId)` |
| --- |
| `legalMoves` computed: legal targets of the selected piece |
| `Chessboard._emitMove(rawMove)` |

`_commitTarget` is reached from `Chessboard._selectSquare` (click on a target after selecting an own piece) and `Chessboard._onDrop` (drag). A target with several promotion candidates goes through SCN-MOVE-03 instead.

| `Chessboard._emitMove(rawMove)` |
| --- |
| emit `moveAttempted(rawMove)` |
| `Chessboard._clearSelection()` |

| `GameView.inputActions.move(rawMove)` |
| --- |
| ignore when `renderedBoard` is no longer the publication the action was created for |
| `GameView._makeMove(rawMove)` |
| `GameView._requestMoves([rawMove])` |

| `GameView._requestMoves(moves)` |
| --- |
| return unless `canInput`, no line is playing and the game is not in `BoardEdit` |
| no `premoveColour` (SCN-MOVE-04) and no history confirmation (SCN-HIST-02): `GameView._run(() => GameView._applyMoves(game, moves))` |

| `GameView._applyMoves(game, moves)` |
| --- |
| `MoveApplicationService.genPosition(position, [])` |
| preflight every move on that detached preview, advancing it with `MoveApplicationService.applyMove` |
| `OperationOwner.run(action)` (the view's `playback` owner) |
| per move: wait 350 ms from the second move, then check game, tree, mode, result, input and path |
| `GamesStore.makeMove(game, rawMove)` |

| `GamesStore.makeMove(game, rawMove)` |
| --- |
| `GameStatusComposable.assertMoveAllowed(game)` |
| `GamePositionComposable.getRenderedNode(game)` / `getRenderedPosition(game)` |
| `GameStatusComposable.isOngoingLiveGame(game)` / `isAnyLiveAnalysisState(game.gameState)` |
| `GamePlayerTurnComposable.getSideToMovePlayer(game, parentPosition.sideToMove)` |
| `GameMoveComposable.resolveMove(parentPosition, rawMove, parentNode.move)` |
| `GamePlayerTurnComposable.attemptPlayerMove(game, detailedMove)` |

| `GameMoveComposable.resolveMove(parentPosition, rawMove, lastMove)` |
| --- |
| reject `from`/`to` outside `0..63` |
| match a legal candidate from `rawMove.from` on `to` and exact `promotionPiece`, using the parent node's last move |
| enrich that candidate into a fresh `IMove` for `parentPosition` |

| `GamePlayerTurnComposable.attemptPlayerMove(game, move)` |
| --- |
| `game.$.pendingPlayerTurnPromise.resolve(move)` |
| await `game.$.pendingPlayerTurnHandlePromise` (`GamePlayerTurnComposable._playerMoveHandler`) |

| `GamePlayerTurnComposable._playerMoveHandler(pendingPlayerMove)` |
| --- |
| `finally`: clear `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise` and `pendingPlayerTurnAbortController` |
| `GameMoveComposable.commitLiveMove(game, move)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` when the commit finalised |

| `GameMoveComposable.commitLiveMove(game, move)` |
| --- |
| `GameClockComposable.reconcileTimeout(game, moveTimestamp)`; expired: return without committing |
| `MoveHistoryService.pruneFutureMoves(liveNode)` when the live node has children and the selection is not beneath it (SCN-HIST-04) |
| `GameMoveComposable._applyLiveMove(game, move, moveTimestamp)` |
| `GameMoveComposable._finaliseLiveMove(game, livePosition, isLivePositionRendered)` |

| `GameMoveComposable._applyLiveMove(game, move, moveTimestamp)` |
| --- |
| `GamePositionComposable.getLiveNode(game)` / `getLivePosition(game)` |
| `GameClockComposable.applyMove(game, move.movingColour, moveTimestamp)` |
| `GameAnalysisComposable.captureMoveAnalysis(game)` |
| `MoveApplicationService.applyMove(livePosition, move)` |
| `MoveHistoryService.addMainlineMove(liveNode, move, nextClockSnapshot)` |
| `GamePositionComposable.appendLivePath(game, nextNode)` |
| `GameRecordComposable.moveCommitted(game)` |

| `GameClockComposable.applyMove(game, movingColour, nowUtc)` |
| --- |
| `TimeControlService.applyMove(game.clockSnapshot, movingColour, nowUtc, game.timeControl)` |

| `GameMoveComposable._finaliseLiveMove(game, livePosition, isLivePositionRendered)` |
| --- |
| `GameStatusComposable.updateGameResultFromLivePosition(game, livePosition)` |
| state: `getAnalysisState` after a result, `getLiveAnalysisState` during explicit analysis, otherwise `getLiveState` |
| `GamePremoveComposable.revalidatePremoves(game)` |
| `GameMoveComposable._refreshRenderedAnalysis(game, isLivePositionRendered)` *(background)* |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |

| `GameStatusComposable.updateGameResultFromLivePosition(game, boardPosition)` |
| --- |
| resolve checkmate, stalemate or insufficient material on the live position |
| terminal result: `TimeControlService.pauseClock`, clear `drawOfferState`, `GameStatusComposable.flagResultNotification(game)` |

| `GameMoveComposable._refreshRenderedAnalysis(game, changed)` |
| --- |
| changed: `GameAnalysisComposable.refreshAnalysisForGame(game)` ([shared refresh](AnalysisAndSetup.md#shared-rendered-analysis-refresh)) |
| unchanged: `GameRecordComposable.timestampGame(game)` |

- Turn ownership: an ordinary live move does not commit directly. It resolves the game-level `Deferred<IMove>` that `requestPlayerMoveIfNeeded` registered for the Local seat, and the handler commits it. **Why:** Local input, a premove head and an engine result all complete the same turn owner, so pause holding, cancellation and the successor request behave identically for every source. A direct commit would bypass the paused-output slot and leave a stale pending turn registered. `attemptPlayerMove` throws `ReferenceError` when no turn is armed.
- Successor request: `commitLiveMove` returns `true` only when `_finaliseLiveMove` ran, and the handler then calls `requestPlayerMoveIfNeeded`. A timeout found by `reconcileTimeout` returns `undefined` and requests nothing.
- Background selection: `_finaliseLiveMove` passes `isLivePositionRendered`, so an actual move while the user reviews history or explicit analysis leaves that rendered analysis running and only timestamps the game.
- Game end: a checkmate, stalemate or insufficient-material result is recorded on the completed move, stops both clocks, moves the game to non-live analysis and arms the one-shot result prompt. See [Game End](#game-end).
- Utilities: `legalMoves` and `resolveMove` use `genLegalMovesForPiece`; `resolveMove` enriches with `toDetailedMove`; `_applyMoves` preflights with `isMoveLegal` and `toDetailedMove` and waits with `abortableDelay`; `updateGameResultFromLivePosition` uses `resolveGameResult`.
- Runtime ownership detail: see [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md) for analysis start and streaming below `refreshAnalysisForGame`.
- Requirement verification: `Pass`. The move is resolved against the canonical selection once and fans out to history, clock, analysis capture, premove revalidation and analysis refresh from one store boundary.

#### Flow B - Move In Free Analysis Or After A Result
| `GamesStore.makeMove(game, rawMove)` |
| --- |
| `GameStatusComposable.assertMoveAllowed(game)` |
| `GamePositionComposable.getRenderedNode(game)` / `getRenderedPosition(game)` |
| `GameStatusComposable.isOngoingLiveGame(game)` is false |
| `GameMoveComposable.resolveMove(parentPosition, rawMove, parentNode.move)` |
| `GameMoveComposable.commitStandaloneAnalysisMove(game, parentNode, parentPosition, detailedMove)` |

| `GameMoveComposable.commitStandaloneAnalysisMove(game, parentNode, parentPosition, move)` |
| --- |
| `GameMoveComposable._advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move)` |
| `GameStatusComposable.updateGameStateAfterPosition(game, renderedPosition.sideToMove)` |
| `GameMoveComposable._refreshRenderedAnalysis(game)` *(background)* |

| `GameMoveComposable._advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move)` |
| --- |
| `MoveApplicationService.genPosition(parentPosition, [])` when the parent is the cached live position |
| `MoveApplicationService.applyMove(renderedPosition, move)` |
| `MoveHistoryService.addAnalysisMove(parentNode, move)` |
| `GamePositionComposable.getPathToNode(nextNode)` |
| `GamePositionComposable.setRenderedPath(game, path, { node: nextNode, position: renderedPosition })` |
| `GameRecordComposable.moveCommitted(game)` |

The view reaches this route from the same board and PV handlers as Flow A. `GameView.canInput` is true for any game without `livePath` or with a final result; in board edit the board emits edit events instead and `_requestMoves` refuses moves.

#### Flow C - Move During Explicit In-Game Analysis
| `GamesStore.makeMove(game, rawMove)` |
| --- |
| `GameStatusComposable.assertMoveAllowed(game)` (any live-analysis state, including paused) |
| `GamePositionComposable.getRenderedNode(game)` / `getRenderedPosition(game)` |
| `GameMoveComposable.resolveMove(parentPosition, rawMove, parentNode.move)` |
| `GameMoveComposable.commitLiveAnalysisMove(game, parentNode, parentPosition, detailedMove)` |

| `GameMoveComposable.commitLiveAnalysisMove(game, parentNode, parentPosition, move)` |
| --- |
| `GameMoveComposable._advanceRenderedAnalysisBranch(game, parentNode, parentPosition, move)` |
| `GameStatusComposable.getLiveAnalysisState(liveColour, renderedColour, isPausedLiveAnalysisState(game.gameState))` |
| `GameMoveComposable._refreshRenderedAnalysis(game)` *(background)* |

- State coverage: `makeMove` dispatches exactly one route. Without ongoing actual play (`livePath` absent or result final) it uses Flow B. In `LiveAnalysisFrom*` and `PausedLiveAnalysisFrom*` it uses Flow C, where both colours may move and the actual turn, clock and held output stay independent. At the live selection outside explicit analysis it uses Flow A or the premove branch of SCN-MOVE-04. Strict history review with Takeback uses SCN-HIST-02; without Takeback it throws `Enter analysis to explore this historical position.` `BoardEdit` and ordinary paused states fail `assertMoveAllowed`.
- Requirement verification: `Pass`. Analysis moves never touch the live path, clocks or the pending turn.

### SCN-MOVE-02 - Illegal Move Attempt

#### Flow A - Board Offers Only Legal Targets
| `Chessboard._selectSquare(boardId)` |
| --- |
| same square: `Chessboard._clearSelection()` |
| piece of `inputColour` (`premoveColour` or the position's side to move): select it |
| other square with a selection: `Chessboard._commitTarget(boardId)` |

| `Chessboard._commitTarget(boardId)` |
| --- |
| no `legalMoves` entry for the target: `Chessboard._clearSelection()`; nothing is emitted |

#### Flow B - Store Rejects A Raw Move
| `GamesStore.makeMove(game, rawMove)` |
| --- |
| `GameStatusComposable.assertMoveAllowed(game)` throws in paused live play and `BoardEdit` |
| wrong actual owner without a premove seat: throw `This move does not belong to the current local turn.` |
| `GameMoveComposable.resolveMove(parentPosition, rawMove, lastMove)` throws `Invalid move coordinates.` or `This move is not legal in the selected position.` |

`GameView._run` presents the error through `_showNotice`. No rejection mutates the tree, clocks, pending turn, premove queue or analysis.

#### Flow C - Stale Suggested Prefix
| `GameView._applyMoves(game, moves)` |
| --- |
| any step illegal on the detached preview: throw `This suggested move is stale. Refresh analysis and try again.` before the first submission |

#### Flow D - Player Engine Result
| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| --- |
| `EngineClient.awaitPlayerTurnMove(engine)` |
| the move must be legal from `searchedPosition` |
| `MoveApplicationService.genPosition(searchedPosition, [move])`; any `move.$.ponderMove` must be legal from it |

- Raw-move acceptance: board, promotion and PV input submit `IMoveRaw`. `GameMoveComposable.resolveMove` converts it to a fresh `IMove` against the parent node and position of the route that will commit it. **Why:** a coordinate pair is an intention, while capture, check, castling, en passant and notation are facts about one board. PV playback is delayed, and a detailed move captured from the display or an earlier board would carry facts for the wrong position. Trusting presentation-enriched `IMove` values fails exactly there. The invariant is that every accepted user move is matched against `genLegalMovesForPiece` from the same selector's node and position before any mutation, and that a rejection creates no tree, clock, autosave-count or turn change. See the [raw move submission design](../../ArchivedPlans/RawMoveSubmissionDesign.md#rule-api-use-and-acceptance-algorithm).
- Engine moves are the external producer. `EngineRuntimeService.awaitPlayerTurnMove` is their single legality guard (`isMoveLegal`), so the engine-agnostic handler and `commitLiveMove` do not re-resolve them.
- Requirement verification: `Pass`.

### SCN-MOVE-03 - Pawn Promotion Resolution

#### Flow A - Choose The Promotion Piece
| `Chessboard._commitTarget(boardId)` |
| --- |
| several matching `legalMoves` with `promotionPiece`: store them in `pendingPromotionMoves` |
| `useModal().open(PromotionModal, { moves, colour: inputColour, onSelected: Chessboard._choosePromotion }, onClosed)` |

| `PromotionModal._choosePromotion(move)` |
| --- |
| ignore after the modal signal aborted or for a move not in `moves` |
| emit `selected(move)` (handled by `Chessboard._choosePromotion`) |
| emit `dismissed` when still open |

| `Chessboard._choosePromotion(move)` |
| --- |
| `pendingPromotionMoves.includes(move)` |
| `Chessboard._emitMove(move)` |

The completed raw candidate then continues at `GameView.inputActions.move` in SCN-MOVE-01, or at the premove branch of SCN-MOVE-04 when it was offered off-turn.

#### Flow B - Cancel The Choice
Cancel, the close button, the backdrop and Escape all emit `dismissed` from `PromotionModal`, which the modal provider handles.

| `useModalProvider._close(owner)` |
| --- |
| `_detach(owner)`: abort the opening's signal and unmount it |
| `_completeClose(owner)`: run the `onClosed` callback once |

| `Chessboard._commitTarget: onClosed` |
| --- |
| `Chessboard._clearSelection()` when this opening is still the board's `promotion` handle |

#### Flow C - Input Context Changes While Choosing
| `Chessboard` `onBeforeUpdate` callback |
| --- |
| position, display position, `premoveColour`, `boardEdit` or `inputDisabled` changed |
| `Chessboard._clearSelection()` closes the pending `PromotionModal` handle |

- No move, capture, turn or history mutation happens before a choice. There is no pending-promotion state on `IGame`.
- Settings coverage: `gameplay.promotionPolicy` is `requireExplicitSelection` only; there is no queen default.
- Requirement verification: `Pass`. JRN-PROMO-01–05 cover both colours, every quiet and capture choice, gestures, orientation and promoted save/reload/takeback; see the [promotion review](../../../journeys/definitions/promotion/ScenarioReview.md) and [execution record](../../ArchivedPlans/JourneyImplementation.md#promotion-verification). JRN-RULE-01–06 add castling, en passant, king-safety rejection, rule-resolved draws and special-move restoration; see the [rules review](../../../journeys/definitions/rules/ScenarioReview.md).

### SCN-MOVE-04 - Premoves Through The Existing Turn Request

Premoves are runtime-only input for the Local seat of a Local-versus-Engine game. `game.$.premoveQueue` is `{ player, moves: shallowReactive<IMoveRaw[]>([]) }`; it holds the supplied raw references and creates no node, state, clock change or saved data.

#### Flow A - Offer Off-Turn Input
| `GameView.premoveColour` computed |
| --- |
| `localPlayer` computed: exactly one Local seat facing an Engine seat |
| defined only for ongoing, unpaused play outside explicit analysis and board edit, with `renderedPath === livePath`, while the engine is to move |

| `Chessboard.legalMoves` computed |
| --- |
| with `premoveColour`: candidate geometry of the selected piece on the displayed board |
| otherwise: legal targets on the canonical position |

`GameView.canInput` accepts the live board when the side to move is Local or `premoveColour` is defined. Candidate geometry (`genCandidateMovesForPiece`) covers piece movement, blockers, pawn diagonals and castling availability while ignoring turn and check; legal targets use `genLegalMovesForPiece`. Selection uses `inputColour = premoveColour ?? position.sideToMove` on the projected display board.

#### Flow B - Append A Raw Premove
| `GameView._requestMoves([rawMove])` |
| --- |
| `premoveColour` defined: `GameView._run(() => GamesStore.makeMove(game, rawMove))`, bypassing `_applyMoves` preflight |

| `GamesStore.makeMove(game, rawMove)` |
| --- |
| `GameStatusComposable.assertMoveAllowed(game)` |
| `GamePositionComposable.getRenderedNode(game)` / `getRenderedPosition(game)` |
| `GameStatusComposable.isOngoingLiveGame(game)` / `isAnyLiveAnalysisState(game.gameState)` |
| `GamePlayerTurnComposable.getSideToMovePlayer(game, parentPosition.sideToMove)` is not Local |
| `GamePremoveComposable.appendPremove(game, localPlayer, rawMove)`; return |

| `GamePremoveComposable.appendPremove(game, player, rawMove)` |
| --- |
| `game.$.premoveQueue ??= { player, moves: shallowReactive([]) }` |
| `queue.moves.push(rawMove)` |

#### Flow C - Project The Queue For Display
| `GameView.renderedBoard` computed |
| --- |
| queue shown only while following the live board outside analysis, and hidden while a Local turn is pending so a shifted head is drawn from the canonical board until it commits |
| held Local output from `game.$.deferredPlayerMove`, when present |
| `GamePositionComposable.getPremoveProjection(canonicalPosition, queue, heldLocalMove)` |

| `GamePositionComposable.getPremoveProjection(base, queue, heldLocalMove)` |
| --- |
| `MoveApplicationService.genPosition(base, [])` |
| `GamePositionComposable.applyPremoveProjection(preview, heldLocalMove, redSquares)` |
| `GamePositionComposable.applyPremoveProjection(preview, move, redSquares)` for each queued move |

| `GamePositionComposable.applyPremoveProjection(preview, move, redSquares)` |
| --- |
| derive the candidate kind (castle, promotion, en passant, normal) from the preview |
| add the endpoints, and the castling rook squares, to `redSquares` |
| `MoveApplicationService.applyMove(preview, candidate)` |

`Chessboard` draws `displayPosition` and marks `premoveSquares`; analysis, saving and history keep the canonical position.

#### Flow D - Revalidate After An Actual Commit
| `GameMoveComposable._finaliseLiveMove(game, livePosition, isLivePositionRendered)` |
| --- |
| `GamePremoveComposable.revalidatePremoves(game)` |

| `GamePremoveComposable.revalidatePremoves(game)` |
| --- |
| final result: `GamePremoveComposable.clearPremoves(game)` |
| `MoveApplicationService.genPosition(livePosition, [])` |
| each entry: source piece is the queue owner's colour and the move is in its candidate geometry on the preview, else `clearPremoves` |
| `GamePositionComposable.applyPremoveProjection(preview, move)` |

#### Flow E - Play The Head On The Local Turn
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` |
| --- |
| `GamePlayerTurnComposable._requestPlayerMove(game)` registers the Local turn ([player turn](#live-player-turn-request-and-engine-moves)) |
| `GamePlayerTurnComposable._tryPremove(game)` *(background)* |

| `GamePlayerTurnComposable._tryPremove(game)` |
| --- |
| no queue: return; the same Local turn waits for ordinary input |
| `GamePositionComposable.getLivePosition(game)` / `getLiveNode(game)` |
| match the head against the legal moves of its piece on the live position (with the live node's last move) on `to` and exact `promotionPiece` |
| no match: `GamePremoveComposable.clearPremoves(game)`; return |
| enrich the match into a fresh `IMove` for the live position |
| `queue.moves.shift()`; clear `premoveQueue` when empty |
| `GamePlayerTurnComposable.attemptPlayerMove(game, move)` |

The shifted head then commits through SCN-MOVE-01 Flow A, or is held by the handler while paused (SCN-TIME-02 Flow B).

#### Flow F - Cancel The Queue
| `Chessboard._cancelPremoves()` |
| --- |
| `Chessboard._clearSelection()` |
| emit `premovesCancelled` when `premoveSquares` is not empty |

`_cancelPremoves` is reached from `Chessboard._onContextMenu` outside board edit, `Chessboard._onKeyDown` for Escape with no unfinished selection, and `Chessboard._onClick` for a completed touch tap on a premoved piece.

| `GameView.inputActions.cancelPremoves()` |
| --- |
| `GameView._runInputAction(owner, (game) => GamesStore.clearPremoves(game))` |

| `GamesStore.clearPremoves(game)` |
| --- |
| alias of `GamePremoveComposable.clearPremoves(game)`: `game.$.premoveQueue = undefined` |

#### Flow G - Premove From An Analysis Line
| `GameView._playAnalysisLine(moves)` |
| --- |
| ordinary live play with `premoveColour` defined |
| take the final entry; its mover from prefix parity must equal `premoveColour` |
| source piece on the displayed board is that colour and the move is in its candidate geometry |
| `GameView._requestMoves([move])` |

- Utilities: append, revalidation and analysis-line premoves use `genCandidateMovesForPiece`; `_tryPremove` resolves the head with `genLegalMovesForPiece` and `toDetailedMove`.
- Queue boundaries: accepted actions clear the whole queue at their mutation point: `GameMoveComposable.commitHistoryMove`, `GameMoveComposable.rewind`, `GameMoveComposable.replaceWithAnalysisRoot`, `GamePlayerTurnComposable.reassignPlayer`, `GameWorkspaceComposable.startGameFromSetup`, `GameStatusComposable.finaliseResignation`, `GameStatusComposable.finaliseDrawAgreement` and `GameClockComposable._finaliseTimeout`. Closing a tab clears it through `useGameTabActions.close` -> `GamesStore.clearPremoves`, and store scope disposal clears every queue. Pause, explicit analysis, history review, tab switching and in-memory save keep it. Hydration creates an empty runtime through `GamePositionComposable.hydrateGame`.
- Raw references: the queue stores the supplied `IMoveRaw` without copies or detail. **Why:** transition facts depend on the board at the due turn, which does not exist yet; a detailed premove would carry facts for the wrong position. See the [premove data structure](../../ArchivedPlans/PremoveDataStructure.md).
- Whole-queue clearing: one failed dependency clears every entry. **Why:** later entries were planned on the board displaced by earlier ones, so dropping only the failed entry would leave intentions that the user never made from the resulting position.
- Existing turn request: `_tryPremove` is the Local branch of the ordinary `_requestPlayerMove`, and it delivers through `attemptPlayerMove`. **Why:** the rejected alternative, a separate premove driver, duplicated pause holding, cancellation and successor requests. The invariant is one registered turn per game whose first settlement decides commit or hold. All work up to the shift is synchronous, so no other input can claim the same head. See the [implemented plan](../../ArchivedPlans/PreMovePlan%28ToDo%29.md#function-flow).
- Requirement verification: `Pass (layer exception)`. `GameView.renderedBoard` calls `GamePositionComposable.getPremoveProjection` through its own `useGamePosition()`, a pure detached query that bypasses the `useGamesStore` façade; it is recorded in the [current exceptions](../Architecture/index.md#current-exceptions). The scenario cases are recorded in the [premove implementation verification](../../ArchivedPlans/PreMovePlan%28ToDo%29.md#implementation-verification---23-october-2026).

## Engine-Controlled Turn

### Live Player Turn Request And Engine Moves

#### Flow A - Arm The Turn
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` |
| --- |
| `GameStatusComposable.isLiveTurnReadyForMove(game)` |
| return while `game.$.pendingPlayerTurnPromise` exists |
| `GamePlayerTurnComposable._requestPlayerMove(game)` |

| `GamePlayerTurnComposable._requestPlayerMove(game)` |
| --- |
| `GamePlayerTurnComposable.getSideToMovePlayer(game, getLivePosition(game).sideToMove)` |
| throw when a pending turn already exists |
| create `AbortController` and `Deferred<IMove>` |
| start `GamePlayerTurnComposable._playerMoveHandler(deferred)` |
| store `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` on `game.$` |
| Engine seat: `GamePlayerTurnComposable._requestEngineMove(engine)` *(background; rejection rejects the Deferred)* |
| Local seat: `GamePlayerTurnComposable._tryPremove(game)` *(background)* |

`requestPlayerMoveIfNeeded` is called after creation, insertion, setup start, every finalised commit, final Resume, a return to the live node, Takeback, reassignment and the 500 ms failure retry. The pending-turn guard makes repeated calls harmless.

#### Flow B - Engine Move
| `GamePlayerTurnComposable._requestEngineMove(engine)` |
| --- |
| `EngineRuntimeService.ensureReady(engine, abortController.signal)` |
| `EngineRuntimeService.startPlayerTurn(engine, game, callback, abortController.signal)` |

| `EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove, signal)` |
| --- |
| capture `game.$.livePosition` as the searched position |
| `EngineClient.startPlayerTurn(engine, game)` |
| `EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition)` |
| `EngineRuntimeService.startPondering(engine, game, move, ponderMove)` *(background, when available)* |
| `callback(move)` |

| `GamePlayerTurnComposable._requestEngineMove: callback(move)` |
| --- |
| return when the captured signal aborted |
| `GamePlayerTurnComposable.attemptPlayerMove(game, move)` |

The handler then commits through SCN-MOVE-01 Flow A and requests the opposing turn. Protocol states, ponder hit/miss and validation are in [EngineRuntimeOwnership.md](EngineRuntimeOwnership.md#player-turn-runtime).

#### Flow C - Engine Failure
| `GamePlayerTurnComposable._requestEngineMove(engine)` rejection |
| --- |
| `deferred.reject(error)` |

| `GamePlayerTurnComposable._playerMoveHandler(pendingPlayerMove)` |
| --- |
| `Aborted`: return |
| other error: log it |
| `setTimeout(() => GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game), 500)` |

`EngineRuntimeService` has already recorded `Failed` availability and `lastError` on `engine.$`, which `PlayerPanel` shows as `engineError`. The retry passes through `ensureReady`, which respawns an exited process.

#### Flow D - Output While Paused
| `GamePlayerTurnComposable._playerMoveHandler(pendingPlayerMove)` |
| --- |
| `GameStatusComposable.isPausedState(game.gameState)`: `game.$.deferredPlayerMove = move` |

The final Resume commits it through `GamePlayerTurnComposable.flushDeferredPlayerMove` (SCN-TIME-02 Flow B). Pondering already started from the engine result, so the flush does not revalidate or restart the engine.

#### Flow E - Cancel The Turn Before An Ownership Change
| `GameTurnRuntimeComposable.clearPlayerTurnRuntime(game)` |
| --- |
| clear `game.$.deferredPlayerMove` |
| `GameTurnRuntimeComposable._clearPendingPlayerTurn(runtime)` |

| `GameTurnRuntimeComposable._clearPendingPlayerTurn(runtime)` |
| --- |
| `abortController.abort(new Aborted())` |
| `pendingPlayerTurnPromise.reject(signal.reason)` |
| await `pendingPlayerTurnHandlePromise` |

Callers: `GamesStore._commitHistoryRewriteMove`, `takeBack`, `resignGame`, `acceptDrawOffer`, `GamePlayerTurnComposable.reassignPlayer`, `GameWorkspaceComposable.startGameFromSetup`, `GameClockComposable._settleTimeout` and `GamesStore` scope disposal. It does not stop engine processes; callers that change the engine's position stop it explicitly.

- Ownership: the turn's `Deferred`, handler promise and `AbortController` on `game.$` are its explicit owner. Replacement actions abort and drain that handler before re-arming, and the engine callback checks the signal of the work it belongs to. **Why:** this replaced comparisons of pending-promise identity and generation-style invalidation, which have to be repeated at every await and fail when one is missed. The invariant is at most one registered turn per game, settled by its first resolution or rejection, and every ownership change awaits `clearPlayerTurnRuntime` before mutating. See the [code cleanup decisions](../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions).
- State gate: `isLiveTurnReadyForMove` requires `LiveWhiteTurn`/`LiveBlackTurn` or unpaused `LiveAnalysisFrom*`, an ongoing result and a `livePath`. Selection does not gate the actual turn, so engines keep replying during history review and explicit analysis.
- Completion: an engine turn completes only through a valid `bestmove`. A silent but running engine leaves the turn pending while its clock runs; there is no response timeout.
- Failure: malformed player-turn output and unexpected exit fail the provider, record `Failed` and `lastError`, log, and schedule the 500 ms retry. The game is not paused and no dialog opens. Open conflict: the retry repeats without a limit while the turn stays due, whereas the [engine runtime contract](../../HighLevel/engine_runtime.md) excludes automatic reconnect and backoff retry from the baseline; the two have not been reconciled.
- Requirement verification: `Pass`.

### SCN-ENGINE-03 - Change Player Assignment During Game

#### Flow
| `PlayerPanel._selectPlayer()` |
| --- |
| `canSelect`: a game exists, no line is playing and the game is not in `BoardEdit` |
| `useModal().open(PlayerSelectionModal, { gameId, colour })` |

| `PlayerSelectionModal._confirmPlayerSelection()` |
| --- |
| `useModalAction.run(action)` |
| `PlayerSelectionModal._assignedPlayer(selection, colour)`: unassigned, Local, or an engine player copied from the selected profile |
| `GamesStore.reassignPlayer(game, colour, player)` unless `Keep` is selected |
| emit `dismissed` on success |

| `GamesStore.reassignPlayer(game, colour, player)` |
| --- |
| alias of `GamePlayerTurnComposable.reassignPlayer(game, colour, player)` |

| `GamePlayerTurnComposable.reassignPlayer(game, colour, player)` |
| --- |
| `BoardEdit`: throw |
| `GamePlayerTurnComposable.createPlayerSnapshot(player)` |
| equal persisted player: return |
| `GameTurnRuntimeComposable.clearPlayerTurnRuntime(game)` |
| `EngineRuntimeService.stopEngine(previousPlayer.assignedEngine)` when the previous seat was an engine |
| `GamePositionComposable.getRenderedPosition(game)` / `getLivePosition(game)` |
| `GamePremoveComposable.clearPremoves(game)` |
| assign the seat |
| a seat is now empty: `TimeControlService.pauseClock`, `GamePositionComposable.setLivePath(game, undefined)`, reset offer/result/pause reasons, `getAnalysisState(selectedSide)` |
| both seats assigned: keep the paused, live or live-analysis state family |
| `GameRecordComposable.timestampGame(game)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` |

| `GamePlayerTurnComposable.createPlayerSnapshot(player)` |
| --- |
| `playerSchema.parse(player)` |
| `GamePlayerTurnComposable._initialisePlayerRuntime(snapshot)`: `$ = { activityState: Active }`; engine: `shallowReactive(EngineRuntimeService.ensureRuntime(assignedEngine))` |

- State coverage: reassignment is allowed in live, paused, live-analysis and non-live analysis states, and rejected in `BoardEdit`. Assigning nobody converts the game into free analysis (see [AnalysisAndSetup](AnalysisAndSetup.md#flow-b---convert-a-live-game-into-free-analysis)). Reassignment does not refresh analysis seats.
- Snapshot: the engine player is a copy of the profile, so editing the profile later does not change an assigned game.
- Requirement verification: `Pass`. Reassignment stays at the store boundary and reuses the normal turn gate.

## History And Branching

### SCN-HIST-01 - Navigate Move History Node

#### Flow
`HistoryPanel` emits `nodeSelected(node)` from a history row, the Start position button and `HistoryPanel._selectLive()` (the Live position chip). `GameControlPanel._navigate('first' | 'previous' | 'next' | 'last')` emits the same event in free analysis, explicit analysis and finished games. Both are disabled by `GameView.isHistoryInputDisabled` during board edit, a genuine pause outside analysis, or line playback.

| `GameView._navigateToNode(node)` |
| --- |
| `OperationOwner.cancel()` (the view's `playback` owner) |
| return when the displayed game changed |
| `GameView._closeContinuation()` |
| `GameView._run(() => GamesStore.navigateToNode(game, node))` |

| `GamesStore.navigateToNode(game, node)` |
| --- |
| `GameMoveComposable.navigateToNode(game, node)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` when it returned `true` |

| `GameMoveComposable.navigateToNode(game, node)` |
| --- |
| `GameStatusComposable.assertExplorationAllowed(game, 'History navigation')` |
| `GamePositionComposable.isNodeInTree(game.moveTree, node)`; stale node: return |
| `GamePositionComposable.getPathToNode(node)` |
| live node: return `GameMoveComposable._returnToLiveNode(game)` |
| `GamePositionComposable.setRenderedPath(game, nextPath, { node })` |
| state: live-analysis family kept; ordinary live and paused keep the actual colour; otherwise `updateGameStateAfterPosition` |
| `GameMoveComposable._refreshRenderedAnalysis(game, changed)` *(background)* |

| `GameMoveComposable._returnToLiveNode(game)` |
| --- |
| `GamePositionComposable.getLiveNode(game)` / `getLivePosition(game)` |
| `GamePositionComposable.setRenderedPath(game, game.livePath, { node, position })` |
| state: analysis after a result, paused when paused, otherwise live |
| `GameMoveComposable._refreshRenderedAnalysis(game, changed)` *(background)* |
| return `GameStatusComposable.isLiveTurnReadyForMove(game)` |

- Selection: `isNodeInTree` validates every parent-child link, so a detached node with a stale parent reference is ignored. Returning to the live node aliases `renderedPath` to the `livePath` array, which is how the view and store recognise that the selection follows actual play.
- State coverage: ordinary review keeps the live state and actual colour while turns and clocks continue. Selecting the live node exits explicit analysis. Genuine pauses block ordinary navigation; paused explicit analysis allows it.
- Analysis: the `AnalysisPanel` reads `GamesStore.getVisibleAnalysis(game)` reactively, and `_refreshRenderedAnalysis` restarts seats only when the path changed.
- Requirement verification: `Pass`.

### SCN-HIST-02 - Continue from Historical Node (Takeback Allowed)

#### Flow A - Confirm The Rewrite
| `GameView._requestMoves(moves)` |
| --- |
| strict history review, not in explicit analysis, ongoing, Takeback allowed |
| `useModal().open(ConfirmationModal, { title, subtitle, confirmLabel, confirm: (signal) => GameView._confirmContinuation(pending, signal) })` |

| `ConfirmationModal._confirm()` |
| --- |
| `useModalAction.run(() => confirm(signal))` |
| emit `dismissed` on success |

| `GameView._confirmContinuation(pending, signal)` |
| --- |
| signal, game, rendered node, analysis mode, result, pause and Takeback rechecks |
| `GameView._run(() => GameView._applyMoves(pending.game, pending.moves))` |

`_applyMoves` submits through `GamesStore.makeMove`, which routes strict history review with Takeback to the store coordinator below.

| `GamesStore._commitHistoryRewriteMove(game, detailedMove)` |
| --- |
| capture `GamePositionComposable.getRenderedNode(game)`, `getRenderedPosition(game)` and the `renderedPath` reference |
| `GamePlayerTurnComposable.clearPlayerTurnRuntime(game)` |
| result, selection, analysis, pause or Takeback changed: `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)`; return |
| `GameMoveComposable.commitHistoryMove(game, detailedMove, renderedPath, renderedNode, renderedPosition)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` when it finalised |

| `GameMoveComposable.commitHistoryMove(game, move, renderedPath, renderedNode, renderedPosition)` |
| --- |
| `GamePremoveComposable.clearPremoves(game)` |
| `GamePositionComposable.setLivePath(game, renderedPath, { node: renderedNode, position: renderedPosition })` |
| `GameClockComposable.startClock(renderedNode.clockSnapshot ?? game.clockSnapshot, renderedPosition.sideToMove, moveTimestamp)` |
| `GameStatusComposable.getLiveState(renderedPosition.sideToMove)` |
| `GameClockComposable.reconcileTimeout(game, moveTimestamp)`; expired: return |
| `GameMoveComposable._applyLiveMove(game, move, moveTimestamp)` |
| `GameMoveComposable._finaliseLiveMove(game, renderedPosition, true)` |

#### Flow B - Decline Or Abandon The Rewrite
| `ConfirmationModal._dismiss()` |
| --- |
| emit `dismissed`; no move is submitted |

Route activation, route leave, unmount, navigation and input actions call `GameView._closeContinuation()`, which closes the handle and aborts its signal.

- Rewrite rule: `livePath` becomes the rendered path array, the selected node's clock snapshot restarts from the current timestamp, and `addMainlineMove` attaches the new move as the mainline child. The old continuation stays attached as a sibling variation. The rewrite never calls `commitLiveMove` and never prunes.
- Recheck after cancellation: `clearPlayerTurnRuntime` awaits the handler, and actual play may have ended or the user may have moved the selection meanwhile. The captured selection and permissions are compared with the current ones before mutation; on a mismatch the cancelled turn is re-armed and the queue is kept.
- Per-game coverage: only `game.gameplayOptions.allowTakeback = true` reaches this flow.
- Requirement verification: `Pass`.

### SCN-HIST-03 - Continue from Historical Node (Takeback Not Allowed)

#### Flow - Explicit Analysis Required
| `GameView.canInput` computed |
| --- |
| history review without Takeback: `false`, so the board and PV targets are disabled |

| `GameView.inputActions.analyse()` |
| --- |
| `GameView._runInputAction(owner, (game) => GamesStore.enterInGameAnalysis(game))` |

Entry follows SCN-CTRL-04 Flow A from the selected move. Board and PV input then commit through SCN-MOVE-01 Flow C.

- A direct `GamesStore.makeMove` call in history review without Takeback throws `Enter analysis to explore this historical position.`
- With Takeback enabled, ordinary historical input keeps the confirmation in SCN-HIST-02. Explicit analysis bypasses that confirmation and never rewrites actual play. Only Exit or selecting the live node returns to actual play.
- Requirement verification: `Pass`.

### SCN-HIST-04 - Automatic Pruning After Live Move From The Latest Node

#### Flow
| `GameMoveComposable.commitLiveMove(game, move)` |
| --- |
| `GameClockComposable.reconcileTimeout(game, moveTimestamp)` |
| `MoveHistoryService.pruneFutureMoves(liveNode)` when the live node has children and `GamePositionComposable.isPathPrefix(livePath, renderedPath)` is false |
| `GameMoveComposable._applyLiveMove(game, move, moveTimestamp)` |
| `GameMoveComposable._finaliseLiveMove(game, livePosition, isLivePositionRendered)` |

| `MoveHistoryService.pruneFutureMoves(node)` |
| --- |
| detach and remove every child of the existing node; clear `mainlineChildIndex` |

- Pruning applies to analysis continuations left below the latest live node after explicit analysis. It is skipped while the user is still viewing a node beneath that live node. **Why:** actual engine replies keep arriving during explicit analysis, and pruning the branch under the user's selection would delete what they are looking at. Leaving it means that branch remains history until a later actual move made while it is not selected. See the [background analysis plan](../../ArchivedPlans/BackgroundAnalysisPlan.md#5-protect-the-viewed-branch-and-preserve-existing-history-retention).
- Pruning mutates the existing node in the authoritative tree; the following commit attaches its child without replacing the tree. History rewrites in SCN-HIST-02 keep previously played continuations instead.
- There is no prune action or confirmation in the UI. The following commit counts towards the move-count autosave, where `GameRecordComposable.moveCommitted` calls `SavedGamesStore.saveGame` through the recorded [same-layer exception](../Architecture/index.md#current-exceptions).
- Requirement verification: `Pass`.

## Time Control

### SCN-TIME-01 - Clock Ticks During Play

#### Flow
| `GameView` clock interval callback (registered in `onMounted`, every 250 ms) |
| --- |
| `now.value = Date.now()` |
| `GameView._reconcileGameEnd()` |

| `GameView.remainingTime` computed |
| --- |
| `TimeControlService.getRemainingTime(game.clockSnapshot, new ClockTimestamp(now))` |

| `PlayerPanel.clockText` computed |
| --- |
| format the `remainingMs` prop; tenths below ten seconds; untimed shows a clock icon |

- Cadence rule: the interval only refreshes `now` and asks for an authoritative read. It never writes `clockSnapshot`; expiry is finalised by the store (SCN-TIME-04).
- `GameView.actualTurnColour` marks the active panel from the live position, independently of the selected node.
- Requirement verification: `Pass`.

### SCN-TIME-02 - Pause and Resume Clocks

#### Flow A - Pause
| `GameControlPanel._setPaused(true)` |
| --- |
| `GameControlPanel._run((game) => GamesStore.pauseGame(game, PauseReason.Manual))` |

| `GamesStore.pauseGame(game, reason)` |
| --- |
| alias of `GameClockComposable.pauseGame(game, reason)` |

| `GameClockComposable.pauseGame(game, reason)` |
| --- |
| `GameClockComposable._getExpiredColour(game, nowUtc)`; expired: return `GameClockComposable.syncClock(game, nowUtc)` |
| `GameClockComposable._canPauseForReason(game, reason)`: timed game with a running clock, or already paused |
| already paused: add the reason; `GameRecordComposable.timestampGame(game)`; return |
| not live/live-analysis or not ongoing: return |
| add the reason to `game.$.pauseReasons` |
| `TimeControlService.pauseClock(game.clockSnapshot, nowUtc)` |
| `getPausedState(liveColour)` or `getLiveAnalysisState(anchor, renderedColour, true)` |
| `GameRecordComposable.timestampGame(game)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |

#### Flow B - Resume
| `GameControlPanel._setPaused(false)` |
| --- |
| `GameControlPanel._run((game) => GamesStore.resumeGame(game, PauseReason.Manual))` |

| `GamesStore.resumeGame(game, reason)` |
| --- |
| return unless paused and ongoing |
| `GameClockComposable.getExpiredColour(game, nowUtc)`; expired: return `GameClockComposable.syncClock(game, nowUtc)` |
| `GameClockComposable.resumeClockState(game, reason, nowUtc)` |
| ready: `GamePlayerTurnComposable.flushDeferredPlayerMove(game)` |
| ready: `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` |

| `GameClockComposable.resumeClockState(game, reason, nowUtc)` |
| --- |
| remove only `reason` from `game.$.pauseReasons` |
| another reason remains: `GameRecordComposable.timestampGame(game)`; return |
| `TimeControlService.resumeClock(game.clockSnapshot, nowUtc)` |
| `getLiveState(liveColour)` or `getLiveAnalysisState(anchor, renderedColour)` |
| `GameRecordComposable.timestampGame(game)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |
| return `GameStatusComposable.isLiveTurnReadyForMove(game)` |

| `GamePlayerTurnComposable.flushDeferredPlayerMove(game)` |
| --- |
| take and clear `game.$.deferredPlayerMove` |
| not ready: return |
| `GameMoveComposable.commitLiveMove(game, move)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` when it finalised |

#### Flow C - Analyse While Paused
| `GameView` paused-mode `ControlButton` |
| --- |
| `GameView.inputActions.analyse()` or `GameView.inputActions.exit()` (SCN-CTRL-04) |

- State coverage: Pause appears only for timed games (`timeControl.initialMs` set and not `untimed`). Timed `LiveWhiteTurn`/`LiveBlackTurn` pause into `PausedWhiteTurn`/`PausedBlackTurn`; `LiveAnalysisFrom*` pauses into the matching `PausedLiveAnalysisFrom*`.
- Pause owners: `game.$.pauseReasons` is a set of owners (`Manual`, `Menu`); each Resume removes only its own reason and the clock restarts when none remain. **Why:** a menu interruption must not resume a game the user paused manually, and a manual Resume must not undo a pause still held by an open menu flow. A single boolean cannot tell those apart. Restored paused games get `[PauseReason.Manual]` in `GameWorkspaceComposable._hydrateAndInsertGame` so they require an explicit Resume.
- Paused surface: board, ordinary history, Takeback, draw and resignation are blocked. Explicit analysis entry, analysis moves and history, Exit, player reassignment and analysis-engine management remain available. Only the final Resume flushes held output.
- Held output: an engine move or shifted premove accepted while paused is stored once as `deferredPlayerMove` and committed by the flush without revalidation or a second ponder request.
- Requirement verification: `Pass`.

### SCN-TIME-03 - Increment Applied After Move

#### Flow
| `GameMoveComposable._applyLiveMove(game, move, moveTimestamp)` |
| --- |
| `GameClockComposable.applyMove(game, move.movingColour, moveTimestamp)` |

| `TimeControlService.applyMove(snapshot, mover, nowUtc, timeControl)` |
| --- |
| untimed: return a copy |
| materialise the mover's elapsed time |
| add `timeControl.incrementMs` to the mover and stop its clock |
| start the opponent's clock at `nowUtc` |

- Increment is applied only by actual commits. Analysis moves never touch the clock, and an expired clock is finalised by `reconcileTimeout` before increment.
- Requirement verification: `Pass`.

### SCN-TIME-04 - Timeout Ends Game

#### Flow A - Register Focus-Return Reconciliation
| `GameClockComposable.refreshRuntimeRegistrations(game)` |
| --- |
| call and clear `game.$.focusReturnUnsubscribe` |
| return unless live or unpaused live-analysis, ongoing, timed and running |
| `PlatformEventService.subscribeToAppFocusReturned('GamesStore', () => GameClockComposable.syncClock(game, new ClockTimestamp()), 'sync-clock-<id>')` |

#### Flow B - Tick Reaches Zero
| `GameView._reconcileGameEnd()` |
| --- |
| ongoing and a remaining time is zero: `GamesStore.syncClock(game, new ClockTimestamp())` |
| the game-end prompt follows ([Game End](#game-end)) |

| `GamesStore.syncClock(game, nowUtc)` |
| --- |
| alias of `GameClockComposable.syncClock(game, nowUtc)` |

| `GameClockComposable.syncClock(game, nowUtc)` |
| --- |
| a settlement for this game is pending: return it |
| `GameClockComposable._getExpiredColour(game, nowUtc)` (`TimeControlService.hasExpired`, `getRemainingTime`) |
| `GameClockComposable._settleTimeout(game, nowUtc, expiredColour)` |

| `GameClockComposable._settleTimeout(game, nowUtc, expiredColour)` |
| --- |
| capture `game.clockSnapshot` |
| `GameTurnRuntimeComposable.clearPlayerTurnRuntime(game)` |
| same snapshot and still ongoing: `GameClockComposable._finaliseTimeout(game, nowUtc, expiredColour)` |
| `finally`: remove the pending settlement |

| `GameClockComposable._finaliseTimeout(game, nowUtc, expiredColour)` |
| --- |
| `GamePremoveComposable.clearPremoves(game)` |
| `TimeControlService.pauseClock(game.clockSnapshot, nowUtc)` |
| opponent wins with `ResultReason.Timeout`; `getAnalysisState(opponentColour)` |
| `GameStatusComposable.flagResultNotification(game)` |
| `GameRecordComposable.timestampGame(game)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |

#### Flow C - Expiry Found At A Commit
| `GameMoveComposable.commitLiveMove(game, move)` or `commitHistoryMove(...)` |
| --- |
| `GameClockComposable.reconcileTimeout(game, moveTimestamp)` |

| `GameClockComposable.reconcileTimeout(game, nowUtc)` |
| --- |
| `GameClockComposable._getExpiredColour(game, nowUtc)` |
| expired: `GameClockComposable._finaliseTimeout(game, nowUtc, expiredColour)`; return `true` |

`pauseGame` and `resumeGame` route an expired clock to `syncClock` instead of pausing or resuming.

- Authority: views and focus callbacks only request `syncClock`; timeout is decided from `TimeControlService` and finalised once by the clock composable. A move made after the deadline is not committed and gets no increment.
- Settlement owner: the per-game pending settlement is the owner of an in-flight timeout, so concurrent tick and focus requests join the same work instead of finalising twice. After awaiting turn cancellation, `_settleTimeout` finalises only if the clock snapshot it read is still current and the game is ongoing; a move committed during cancellation therefore wins.
- Registration: focus-return reconciliation exists only for a runnable timed live game. Pause, result, untimed and non-live states unsubscribe.
- Persistence: no save is issued when timeout is finalised. The result is stored on the game and included in later saves, autosaves and session restore (see the persistence note at the top).
- Requirement verification: `Pass`.

### SCN-TIME-05 - Menu Actions Auto-Pause Timed Games

#### Flow A - Leave The Board For A Menu Action
`GameView` handles the `MenuBar` events `homeRequested`, `loadGameRequested`, `saveGameRequested` and `settingsRequested` with `GameView._run(() => GameView._handleMenuInterruptionRequested(action))`, where `action` is the route push; `customNewGameRequested` goes through `GameView._openCustomGame()`, whose action opens `GameCreationModal`.

| `GameView._handleMenuInterruptionRequested(action)` |
| --- |
| `OperationOwner.cancel()` (the view's `playback` owner) |
| `settings.gameSession.autoPauseOnMenu`: `GamesStore.pauseGame(game, PauseReason.Menu)` |
| `action()`: `router.push(...)` or `useModal().open(GameCreationModal, {}, onClosed)` |

#### Flow B - Return Through Route Activation
| `GameView._activateGame(id)` (from `onMounted` and `onBeforeRouteUpdate`) |
| --- |
| `OperationOwner.cancel()` |
| `GameView._closeContinuation()` |
| `GameView._handleMenuInterruptionCompleted(selectedGame)` |

| `GameView._handleMenuInterruptionCompleted(game)` |
| --- |
| return unless `game.$.pauseReasons` includes `Menu` |
| `GamesStore.resumeGame(game, PauseReason.Menu)` (SCN-TIME-02 Flow B) |

#### Flow C - Return From The Custom-Game Modal
| `GameView._openCustomGame: onClosed` |
| --- |
| the interrupted game is still displayed: `GameView._handleMenuInterruptionCompleted(interrupted)` |

- Settings coverage: `gameSession.autoPauseOnMenu` controls the Menu pause. Untimed games and games without a running clock are not paused.
- Interruption rule: while paused by the menu, any engine move that becomes ready is held and committed by the paired Resume. Selecting another game tab navigates without a Menu pause; activation of a game completes only its own Menu pause.
- Requirement verification: `Pass`.

## Game Controls

### SCN-CTRL-01 - Takeback Action

#### Flow
`GameControlPanel` shows Takeback in `live`, `inGameAnalysis` and `freeAnalysis` modes and emits `takeBackRequested`, bound to `GameView.inputActions.takeBack`. The button is disabled unless `GameView.canTakeBack`.

| `GameView.canTakeBack` computed |
| --- |
| not board edit, paused or playing a line |
| `GamesStore.getTakeBackMoveCount(game)` > 0 (alias of `GameMoveComposable.getTakeBackMoveCount`) |
| free analysis, or `gameplayOptions.allowTakeback` |

| `GameView.inputActions.takeBack()` |
| --- |
| `GameView._runInputAction(owner, (game) => GamesStore.takeBack(game))` |

| `GamesStore.takeBack(game, moveCount = GameMoveComposable.getTakeBackMoveCount(game))` |
| --- |
| `GameStatusComposable.assertExplorationAllowed(game, 'Takeback')` |
| `GameStatusComposable.assertNotPausedForAction(game, 'Takeback')` |
| live game without `allowTakeback`: throw |
| `moveCount <= 0`: return |
| target: `GamePositionComposable.getLiveNode(game)` with a live path, else `getRenderedNode(game)` |
| `GamePlayerTurnComposable.clearPlayerTurnRuntime(game)` |
| `EngineRuntimeService.stopEngine(player.assignedEngine)` for each engine player |
| `GameMoveComposable.rewind(game, targetNode, moveCount, hasLivePath)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` |
| await the analysis work returned by `rewind` |

| `GameMoveComposable.rewind(game, targetNode, moveCount, hasLivePath)` |
| --- |
| `GamePremoveComposable.clearPremoves(game)` |
| `MoveHistoryService.takeBack(targetNode, moveCount)` |
| `GamePositionComposable.getPathToNode(fallbackNode)` |
| `GamePositionComposable.setRenderedPath(game, fallbackPath, { node })` |
| live path: `GamePositionComposable.setLivePath(game, fallbackPath, { node })` |
| reset result and reason |
| live path: `GameClockComposable.startClock(fallbackNode.clockSnapshot ?? game.clockSnapshot, sideToMove, now)`; `getLiveState` |
| otherwise: `GameStatusComposable.updateGameStateAfterPosition(game, sideToMove)` |
| `GameMoveComposable._refreshRenderedAnalysis(game, changed)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |

- Move ownership: `getTakeBackMoveCount` walks from the live node back to the Local player's last move in a Local-versus-Engine game, so the engine reply and that move are removed together; it returns 0 before the Local player has moved. Local/local play and free analysis rewind one ply.
- Engine stop: both engine players are stopped. **Why:** a pondering or searching engine works on a position that no longer exists; stopping resets its session, and the next turn request respawns it.
- State gate: genuine pauses block Takeback. Unpaused explicit analysis uses the actual live node and returns the selection to the rewound node. Finished games do not show Takeback.
- Requirement verification: `Pass`.

### SCN-CTRL-02 - Resign Game

#### Flow
| `GameControlPanel._requestResignation()` |
| --- |
| `GameControlPanel._turnColour(game)`: side to move on the live path |
| `useModal().open(ConfirmationModal, { ..., danger: true, confirm: () => GamesStore.resignGame(game, colour) })` |

| `ConfirmationModal._confirm()` |
| --- |
| `useModalAction.run(() => confirm(signal))` |
| emit `dismissed` on success |

| `GamesStore.resignGame(game, colour)` |
| --- |
| `GameStatusComposable.assertOngoingLiveAction(game, 'Resignation')` |
| `GamePlayerTurnComposable.clearPlayerTurnRuntime(game)` |
| `GameStatusComposable.finaliseResignation(game, colour)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |

| `GameStatusComposable.finaliseResignation(game, colour)` |
| --- |
| `GamePremoveComposable.clearPremoves(game)` |
| opponent wins; `TimeControlService.pauseClock`; `ResultReason.Resignation` |
| `getAnalysisState(opponentColour)`; clear `drawOfferState` |
| `GameStatusComposable.flagResultNotification(game)` |
| `GameRecordComposable.timestampGame(game)` |

- State gate: Resign appears only in `live` control mode. `assertOngoingLiveAction` rejects paused, live-analysis, finished and non-live games.
- The game-end prompt follows ([Game End](#game-end)). No save is issued here; later saves, autosaves and session restore carry the result.
- Requirement verification: `Pass`.

### SCN-CTRL-03 - Draw Offer Flow

#### Flow A - Local Versus Local Draw Offer
| `GameControlPanel._handleDraw()` |
| --- |
| both seats Local and no pending offer |
| `useModal().open(ConfirmationModal, { ..., confirm: (signal) => GameControlPanel._offerDraw(game, signal) })` |

| `GameControlPanel._offerDraw(game, signal)` |
| --- |
| `GamesStore.offerDraw(game)` |
| `signal.throwIfAborted()` |
| `useModal().open(DrawResponseModal, { gameId })` |

| `GamesStore.offerDraw(game)` |
| --- |
| alias of `GameStatusComposable.offerDraw(game)` |

| `GameStatusComposable.offerDraw(game)` |
| --- |
| `GameStatusComposable.assertOngoingLiveAction(game, 'Draw offer')` |
| `GamePositionComposable.getLivePosition(game).sideToMove` offers |
| `drawOfferState = { offeringColour, respondingColour, direction: Outgoing }` |
| `GameRecordComposable.timestampGame(game)` |

| `DrawResponseModal._respond(accept)` |
| --- |
| offer or game changed since mounting: `DrawResponseModal._dismissObsolete()` |
| `useModalAction.run(() => accept ? GamesStore.acceptDrawOffer(game) : GamesStore.declineDrawOffer(game))` |
| emit `dismissed` on success |

| `GamesStore.acceptDrawOffer(game)` |
| --- |
| `GameStatusComposable.assertOngoingLiveAction(game, 'Draw acceptance')` |
| no offer: return |
| `GamePlayerTurnComposable.clearPlayerTurnRuntime(game)` |
| `GameStatusComposable.finaliseDrawAgreement(game)` |
| `GameClockComposable.refreshRuntimeRegistrations(game)` |

| `GameStatusComposable.finaliseDrawAgreement(game)` |
| --- |
| `GamePremoveComposable.clearPremoves(game)` |
| `ResultState.Drawn`; `TimeControlService.pauseClock`; `ResultReason.DrawAgreement` |
| `getAnalysisState(renderedColour)`; clear `drawOfferState` |
| `GameStatusComposable.flagResultNotification(game)` |
| `GameRecordComposable.timestampGame(game)` |

| `GamesStore.declineDrawOffer(game)` |
| --- |
| alias of `GameStatusComposable.declineDrawOffer(game)`: assert, clear `drawOfferState`, `timestampGame` |

`DrawResponseModal` is not dismissible. On mount and update, `_dismissObsolete` closes it when the game no longer holds the offer it was opened for.

#### Flow B - Send A Draw Offer To A Non-Local Opponent
| `GameControlPanel._handleDraw()` |
| --- |
| not both Local and no pending offer |
| `GameControlPanel._run((game) => GamesStore.offerDraw(game))` |

The `Draw` control lights its indicator while `drawOfferState` exists and shows `Resolve draw`.

#### Flow C - Accept An Incoming Non-Local Offer
| `GameControlPanel._handleDraw()` |
| --- |
| `drawOfferState.direction === Incoming`: `GameControlPanel._run((game) => GamesStore.acceptDrawOffer(game))` |

`Planned`: nothing currently produces an `Incoming` offer, because the UCI engine adapter has no draw-offer callback. The control path is ready for a future adapter.

#### Flow D - Withdraw An Outgoing Offer
| `GameControlPanel._handleDraw()` |
| --- |
| `drawOfferState.direction === Outgoing`: `GameControlPanel._run((game) => GamesStore.withdrawDrawOffer(game))` |

| `GamesStore.withdrawDrawOffer(game)` |
| --- |
| alias of `GameStatusComposable.withdrawDrawOffer(game)`: assert, clear an outgoing offer, `timestampGame` |

- State gate: the Draw control appears only in `live` control mode, and every draw action asserts an ongoing, unpaused live state.
- `Planned`: repeat-offer throttling (`BR-CTRL-03-REPEAT-OFFER`) is not implemented.
- Requirement verification: `Pass` for local resolution, non-local offer and withdrawal. Draw agreement raises the game-end prompt and is carried by later saves.

### SCN-CTRL-04 - Enter/Exit In-Game Analysis Mode

#### Flow A - Enter In-Game Analysis
`GameControlPanel` emits `analysisRequested` from Analyse in `live` mode; in `paused` mode `GameView` renders its own Analyse control. Both call `GameView.inputActions.analyse()`.

| `GameView.inputActions.analyse()` |
| --- |
| `GameView._runInputAction(owner, (game) => GamesStore.enterInGameAnalysis(game))` |

| `GameView._runInputAction(owner, action)` |
| --- |
| return when `renderedBoard` is no longer `owner` |
| `OperationOwner.cancel()` (the view's `playback` owner) |
| recheck `owner` |
| `GameView._closeContinuation()` |
| `GameView._run(() => action(owner.game))` |

| `GamesStore.enterInGameAnalysis(game)` |
| --- |
| alias of `GameMoveComposable.enterInGameAnalysis(game)` |

| `GameMoveComposable.enterInGameAnalysis(game)` |
| --- |
| return without a live path, when already analysing, or in `BoardEdit` |
| `GamePositionComposable.getLivePosition(game)` |
| `MoveApplicationService.genPosition(getRenderedPosition(game), [])` |
| `GamePositionComposable.setRenderedPath(game, [...game.renderedPath], { node: getRenderedNode(game), position })` |
| ongoing: `getLiveAnalysisState(liveColour, renderedColour, paused)`; finished: `getAnalysisState(renderedColour)` |
| `GameMoveComposable._refreshRenderedAnalysis(game, false)` |

#### Flow B - Exit In-Game Analysis
`GameControlPanel` emits `exitAnalysisRequested` from Exit analysis in `inGameAnalysis` mode; in `paused` mode the `GameView` control shows Exit analysis while analysing. Both call `GameView.inputActions.exit()`.

| `GameView.inputActions.exit()` |
| --- |
| `GameView._runInputAction(owner, (game) => GamesStore.exitInGameAnalysis(game))` |

| `GamesStore.exitInGameAnalysis(game)` |
| --- |
| `GameMoveComposable.exitInGameAnalysis(game)` |
| `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(game)` when it returned `true` |

| `GameMoveComposable.exitInGameAnalysis(game)` |
| --- |
| return without a live path, or when not analysing an ongoing game |
| `GameMoveComposable._returnToLiveNode(game)` (SCN-HIST-01) |

- Detached selection: entry copies the path array and the selected board even when they equal the live ones. **Why:** actual commits append to `livePath` and mutate the live position in place; while aliased, an engine reply would move the analysed board. The invariant is that in `LiveAnalysisFrom*` and `PausedLiveAnalysisFrom*` states `renderedPath` is never the `livePath` array; `GamePositionComposable.hydrateGame` keeps that after restore. See the [background analysis plan](../../ArchivedPlans/BackgroundAnalysisPlan.md#1-enter-analyse-on-the-selected-move).
- Entry preserves the actual clock, pending turn, pause owners and held output; repeated entry is a no-op. Ordinary review alone does not enable analysis input.
- Exit or selecting the live node never resumes or flushes actual play. It preserves genuine pauses and final results. Analysis branches left behind remain history until pruned by a later actual move (SCN-HIST-04).
- Input actions: `inputActions` closures are created per `renderedBoard` publication, and `_runInputAction` ignores a closure whose publication was replaced. **Why:** the board, history and PV controls must act on the board they were rendered for; a click delivered after the board or its permissions changed would otherwise apply to a different context. The publication is the owner; no counter is involved.
- Requirement verification: `Pass`.

### SCN-CTRL-05 - Block Board Editing Inside In-Game Analysis Mode

#### Flow A - The Action Is Not Offered
`GameControlPanel` renders Edit board only in `freeAnalysis` mode, so in-game analysis has no board-edit control.

| `GameControlPanel._toggleBoardEdit()` |
| --- |
| `game.gameState` includes `AnalysisFrom`: `useModal().open(MessageModal, { title, subtitle, message, closeLabel })`; return |

| `GameBoardEditComposable.enterBoardEdit(game)` |
| --- |
| `game.livePath` exists: return without change |

The `MessageModal` branch is a defensive explanation; with the current templates it is unreachable because in-game analysis does not render Edit board.

#### Flow B - Allowed Attempt
| `GameControlPanel._toggleBoardEdit()` |
| --- |
| `GameControlPanel._run(() => GamesStore.enterBoardEdit(game))` |

Board-edit entry and exit are in [AnalysisAndSetup](AnalysisAndSetup.md#scn-free-analysis-02---board-editing-in-free-analysis--setup).

- `Planned`: the scenario's optional shortcut to free analysis / setup (`BR-CTRL-05-GO-TO-SETUP`) is not implemented.
- Requirement verification: `Pass`. Board editing stays limited to games without a live path, enforced in both the control template and the store.

## Game End

### SCN-CTRL-06 - Announce the Game Result

All terminal results go through one notification and one prompt. Analysis behaviour after a result is in [AnalysisAndSetup](AnalysisAndSetup.md#analysis-after-game-end).

#### Flow A - Flag The Result
| `GameStatusComposable.flagResultNotification(game)` |
| --- |
| `game.$.resultNotificationPending = true` |

Callers: `GameStatusComposable.updateGameResultFromLivePosition` (checkmate, stalemate, insufficient material, reached from `_finaliseLiveMove`), `GameStatusComposable.finaliseResignation`, `GameStatusComposable.finaliseDrawAgreement` and `GameClockComposable._finaliseTimeout`.

#### Flow B - Show The Prompt
| `GameView._reconcileGameEnd()` (from the 250 ms clock interval) |
| --- |
| ongoing with an expired clock: `GamesStore.syncClock(game, new ClockTimestamp())`; return if the displayed game changed |
| return unless `game.$.resultNotificationPending` |
| `game.$.resultNotificationPending = false` |
| `useModal().open(GameResultModal, { gameId })` |

#### Flow C - Choose What To Do Next
| `GameResultModal._exit()` |
| --- |
| emit `dismissed` |
| `useGameTabActions.close(gameId)` |

| `useGameTabActions.close(id)` |
| --- |
| `GamesStore.clearPremoves(game)` |
| `UiStateStore.closeTab(id)` |
| `router.push` to the next active game or `/home` |

| `GameResultModal._save()` |
| --- |
| emit `dismissed` |
| `router.push('/saved-games/save/' + gameId)` |

| `GameResultModal._analyse()` |
| --- |
| `useModalAction.run(() => GamesStore.refreshAnalysis(game))` |
| emit `dismissed` on success |

#### Flow D - Review The Finished Game
| `GameView.controlMode` computed |
| --- |
| `finished` when the result is not ongoing (outside board edit and pause) |

In `finished` mode `GameControlPanel` shows First/Previous/Next/Last navigation and the review note, without Takeback, Pause, Draw or Resign. `GameView.canInput` accepts board and PV input, which `GamesStore.makeMove` commits as analysis branches (SCN-MOVE-01 Flow B).

- One-shot notification: the flag lives on the runtime `$`, which is never saved, and the view clears it before opening the prompt. **Why:** stores do not own UI, and watchers on `resultState` are not allowed. The rejected alternatives were opening the modal from the store, which couples state to presentation, and deriving the prompt from `resultState`, which would reopen it for every restored finished game. The invariant is that each result arms exactly one prompt, raised by the view that displays that game; a result reached in a background tab prompts when that game is next displayed.
- `GameResultModal` is not dismissible; one of its three actions closes it. Start analysis with no assigned seats has nothing to start; seats are added from the `AnalysisPanel`.
- Requirement verification: `Pass`. Saving remains user-driven or autosave-driven.
