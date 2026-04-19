Stuff Changed:
- added check state to BoardPosition, deleted checkmate state from IGame
- added currentPosition to IGameRuntime
- renamed IGame.boardRoot as rootPosition to be consistent with IEnginePositionState
- merged IGame.liveAnalysisOptions into IGame.gameplayOptions
- makeMove public method is now exclusively used to make moves to the current board (not the live game)
- _commitLiveMove is the one exclusively used for making moves to the live game
- GameStore._requestPlayerMove is now a private function, also reimplemented it. now the flow is always store internally make request. then the deferred promise can be resolved by UI by calling makeMove or engine promise itself which then unblocks the handler promise to commit the live move.
- Deferred reimplemented to allow promise to complete deferred promise itself. (so either the promise resolve it or externally resolved depending on who does it first)

Stuff need changing:
- update design doc following previous changes
- fix places that need to _requestPlayerMove but haven't
- add legal move check on checkmate/being checked board positions in GameRuleService.isMoveLegal
- rename MoveUpdateService to MoveHistoryService
- IGame.livePath and IGame.highlightPath moved to moveTree runtime
- use actual Date object for all dates not string (zod will take care of the transform)
- remove boardPosition at each node, this is not a good solution because we probably won't use boardPosition for rendering as we can't do proper animation on the chess pieces with it. we need the same chess piece object changing board id to change the coordinates calculated by the frontend
- add live position to make it easier to return live position from current position
- rename highlightPath as renderedPath
- rename position related props named with "current*"  in IGame with "rendered*"
- TODO in GameStore._finaliseMove
- remove all the uncessary object cloning in GameStore and other places
- some GameRule service functions like applyMove are somehow in GameRuleUtility, and is called by GameStore. Move them back to game rule service. It would only make sense for actual game rule stuff to be in the library not app logic, if they obey the rule that there are other services in the first 2 layers that need them
- TODO in GameRuleService.applyMove (after it is moved back)
- update design doc again

To validate:
- find missing actions not done in functions, (if you find "missing" gates, may potentially add assertion errors. I found a lot of the gates you added were just hiding errors rather than throwing exceptions.)
