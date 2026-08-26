Stuff Changed:
- cleaned up stuff that has both nullable and optional in zod when they are only optional
- moved check state to board-position runtime state and detailed move data; deleted checkmate state from IGame
- ~~added currentPosition to IGameRuntime~~ completed as four optional derived caches: `renderedNode`, `liveNode`, `renderedPosition`, and `livePosition`. The single move tree and persistent paths remain on `IGame`; explicit path setters seed or invalidate the corresponding caches, move-tree replacement invalidates all four, and the generic runtime sync was removed.
- renamed IGame.boardRoot as rootPosition to be consistent with IEnginePositionState
- merged IGame.liveAnalysisOptions into IGame.gameplayOptions, takeback is just boolean now
- makeMove public method is now exclusively used to make moves to the current board (not the live game)
- _commitLiveMove is the one exclusively used for making moves to the live game
- GameStore._requestPlayerMove is now a private function, also reimplemented it. now the flow is always store internally make request. then the deferred promise can be resolved by UI by calling makeMove or engine promise itself which then unblocks the handler promise to commit the live move.
- Deferred reimplemented to allow promise to complete deferred promise itself. (so either the promise resolve it or externally resolved depending on who does it first)
- Moved some error types to @/contracts/errors
- removed GameStore._armPendingPlayerTurn because I don't know what it is

Stuff need changing:
- ~~update design doc following previous changes~~
- ~~fix places that need to _requestPlayerMove but haven't~~
- ~~add _requestPlayerMoveIfNeeded to refactor if(xxx) _requestPlayerMove that we have~~
- ~~add legal move check on checkmate/being checked board positions in GameRuleService.isMoveLegal~~
- ~~finish the `MoveUpdateService` to `MoveHistoryService` rename~~: the final test file is now `src/domain/__tests__/MoveHistoryService.spec.ts`
- ~~use actual Date object for all dates not string (zod will take care of the transform)~~ done: added `@/utility/date` (`RecordTimestamp`, `ClockTimestamp`, `AnalysisTimestamp`, `SaveTimestamp`, `RegistrationTimestamp`, each a `Date` subclass with its own `toString`); zod fields now use `utcTimestampSchema` (accepts string-or-Date, always outputs the subclass, so the same schema works for both reading persisted JSON and re-validating in-memory games before serialising)
- ~~remove boardPosition at each node, this is not a good solution because we probably won't use boardPosition for rendering as we can't do proper animation on the chess pieces with it. we need the same chess piece object changing board id to change the coordinates calculated by the frontend. so we would be moving step by step anyway so just recompute position from reference node.~~ done: `IMoveNode.position` is gone (schema too, so old saves just drop the field). `MoveHistoryService.getMoveSequence(tree, toPath, fromPath?)` answers pure tree knowledge and `MoveApplicationService.genPosition(rootPosition, moves)` replays it — `fromPath` is the seam for step-by-step animation later. `applyMove` now mutates in place (`apply*` mutates, `gen*` copies); board edits moved to `MoveApplicationService` (`clearBoard`/`deletePiece`/`movePiece`/`togglePiece`, in place, returning whether anything changed and invalidating `$` themselves). Also: `IBoardPositionRuntime.fen` caches FEN (`buildFen` moved from `UciUtility` to `MoveNotationUtility`), and the UCI new-game check compares that FEN instead of `rootPosition` identity, since board edits now mutate the root in place. `hydrateGame` finally wires `$.parent` (it never did, which silently broke `getPathToNode` for loaded games).
- ~~add live position to make it easier to return live position from current position~~
- ~~rename the highlighted move selector as `renderedPath`~~
- ~~rename position related props named with "current*"  in IGame with "rendered*"~~
- ~~TODO in GameStore._finaliseMove~~
- ~~remove all the unneccessary object cloning in GameStore and other places~~
  - ~~decide and document whether `IChessPiece` is immutable~~: `kind` and `colour` are readonly; detached positions copy only the mutable board array and castling record while sharing immutable piece identities, and promotion creates a new piece identity
  - ~~rerun the production copy-site review after resolving piece ownership~~: the remaining production copies are ownership snapshots or iteration/immutable-transition copies documented at their owning boundaries (`UiStateStore` session/layout snapshots, assigned player/engine snapshots, clock-history snapshots, settings copy-on-write, platform registration snapshots, save-index sorting, legacy serialisation migration, and detached board reconstruction). `GameAnalysisComposable` now shallow-copies the primitive-valued option map instead of using `structuredClone`
  - the standalone object-cloning audit was removed; copy rationale now lives only in the relevant design documents
- ~~some GameRule service functions like applyMove are somehow in GameRuleUtility, and is called by GameStore. Move them back to game rule service. It would only make sense for actual game rule stuff to be in the library not app logic, if they obey the rule that there are other services in the first 2 layers that need them~~
- ~~replace `GameRuleService` with explicitly mutable `MoveApplicationService.applyMove` and detailed-move check state~~
- ~~MoveNode.kind should just be Live, Analysis, MoveNodeRuntime can have isHighlighted boolean (for live path and rendered path)~~
- ~~cache current/live MoveNode in runtime~~
- ~~uci utility is not using IMove runtime cache~~
- ~~update test cases~~
- ~~_finaliseMove need rewrite for more natural flow of applyMove; livePosition and rendered position are supposed to be the same reference when live position is rendered~~ done: `_finaliseMove`, `_finaliseAnalysisMove`, and the analysis flag are removed. `makeMove` now dispatches named live, live-analysis, live-history-analysis, and standalone-analysis workflows; the domain `applyMove` remains the visible in-place board mutation inside those flows.
- ~~Gamestore needs to refactor into composables to make up the whole store as it gets bloated.~~ `GamesStore` is now an explicit Pinia façade composed from focused workspace, position, status, clock, analysis, player-turn, move, and board-edit composables.
- ~~update design doc again~~
  - ~~replace the stale `GamesStore._...` pseudo-private flow API with the actual composable ownership and function names~~
  - ~~correct remaining contract signatures, including `GamesStore.makeMove(...): Promise<void>` and `IGameRuntime.pendingPlayerTurnHandlePromise?: Promise<void>`~~
  - ~~replace stale `gameplayOptions.takebackPolicy` design references with the implemented `allowTakeback` boolean~~
  - ~~finish terminology cleanup for `currentPosition` context labels and `boardRoot` parameters, while retaining the explicitly documented legacy `highlightPath` migration~~
  - ~~reconcile historical `GameRuleService` and other superseded names in follow-up notes with the current `GameRuleUtility` / composable implementation~~

To validate:
- action/gate pass:
  - ~~add the missing `BoardEdit` assertion to the full-position `applyBoardEdit(...)` boundary~~
  - ~~validate engine-produced moves at `GamePlayerTurnComposable.playerMoveHandler`~~; app-owned moves already come from generated legal targets and are not redundantly asserted in `GameMoveComposable`
  - `GameMoveComposable.commitHistoryRewriteMove` restores the selected historical node's clock snapshot but still calls `commitLiveMove` against the existing live node; it does not first rewind `livePath` and `livePosition` to the selected node
