Stuff Changed:
- cleaned up stuff that has both nullable and optional in zod when they are only optional
- moved check state to board-position runtime state and detailed move data; deleted checkmate state from IGame
- ~~added currentPosition to IGameRuntime~~ renamed to `renderedPosition`, and runtime now also caches `livePosition`, `renderedNode`, and `liveNode`. `renderedPosition`/`livePosition` are now **optional, lazily-filled** slots read through `getRenderedPosition`/`getLivePosition`; because moves apply in place, a committed move leaves them already correct, and they are only regenerated after an invalidation. `renderedNode`/`liveNode` are still eagerly rebuilt by `_syncRuntimeNodeCache` (renamed from `_syncRuntimePositionCache`) and still want the lazy rewrite.
- renamed IGame.boardRoot as rootPosition to be consistent with IEnginePositionState
- merged IGame.liveAnalysisOptions into IGame.gameplayOptions, takeback is just boolean now
- makeMove public method is now exclusively used to make moves to the current board (not the live game)
- _commitLiveMove is the one exclusively used for making moves to the live game
- GameStore._requestPlayerMove is now a private function, also reimplemented it. now the flow is always store internally make request. then the deferred promise can be resolved by UI by calling makeMove or engine promise itself which then unblocks the handler promise to commit the live move.
- Deferred reimplemented to allow promise to complete deferred promise itself. (so either the promise resolve it or externally resolved depending on who does it first)
- Moved some error types to @/contracts/errors
- removed GameStore._armPendingPlayerTurn because I don't know what it is

Stuff need changing:
- update design doc following previous changes
- ~~fix places that need to _requestPlayerMove but haven't~~
- ~~add _requestPlayerMoveIfNeeded to refactor if(xxx) _requestPlayerMove that we have~~
- ~~add legal move check on checkmate/being checked board positions in GameRuleService.isMoveLegal~~
- ~~rename MoveUpdateService to MoveHistoryService in remaining docs and stale references~~
- IGame.livePath and IGame.highlightPath moved to moveTree runtime
- ~~use actual Date object for all dates not string (zod will take care of the transform)~~ done: added `@/utility/date` (`RecordTimestamp`, `ClockTimestamp`, `AnalysisTimestamp`, `SaveTimestamp`, `RegistrationTimestamp`, each a `Date` subclass with its own `toString`); zod fields now use `utcTimestampSchema` (accepts string-or-Date, always outputs the subclass, so the same schema works for both reading persisted JSON and re-validating in-memory games before serialising)
- ~~remove boardPosition at each node, this is not a good solution because we probably won't use boardPosition for rendering as we can't do proper animation on the chess pieces with it. we need the same chess piece object changing board id to change the coordinates calculated by the frontend. so we would be moving step by step anyway so just recompute position from reference node.~~ done: `IMoveNode.position` is gone (schema too, so old saves just drop the field). `MoveHistoryService.getMoveSequence(tree, toPath, fromPath?)` answers pure tree knowledge and `MoveApplicationService.genPosition(rootPosition, moves)` replays it — `fromPath` is the seam for step-by-step animation later. `applyMove` now mutates in place (`apply*` mutates, `gen*` copies); board edits moved to `MoveApplicationService` (`clearBoard`/`deletePiece`/`movePiece`/`togglePiece`, in place, returning whether anything changed and invalidating `$` themselves). Also: `IBoardPositionRuntime.fen` caches FEN (`buildFen` moved from `UciUtility` to `MoveNotationUtility`), and the UCI new-game check compares that FEN instead of `rootPosition` identity, since board edits now mutate the root in place. `hydrateGame` finally wires `$.parent` (it never did, which silently broke `getPathToNode` for loaded games).
- ~~add live position to make it easier to return live position from current position~~
- rename highlightPath as renderedPath
- ~~rename position related props named with "current*"  in IGame with "rendered*"~~
- ~~TODO in GameStore._finaliseMove~~
- remove all the unneccessary object cloning in GameStore and other places
- ~~some GameRule service functions like applyMove are somehow in GameRuleUtility, and is called by GameStore. Move them back to game rule service. It would only make sense for actual game rule stuff to be in the library not app logic, if they obey the rule that there are other services in the first 2 layers that need them~~
- ~~replace `GameRuleService` with immutable `MoveApplicationService.applyMove` and detailed-move check state~~
- ~~MoveNode.kind should just be Live, Analysis, MoveNodeRuntime can have isHighlighted boolean (for live path and rendered path)~~
- ~~cache current/live MoveNode in runtime~~
- ~~uci utility is not using IMove runtime cache~~
- ~~update test cases~~
- _finaliseMove need rewrite for more natural flow of applyMove; livePosition and rendered position are supposed to be the same reference when live position is rendered
- update design doc again

To validate:
- find missing actions not done in functions, (if you find "missing" gates, may potentially add assertion errors. I found a lot of the gates you added were just hiding errors rather than throwing exceptions.)
