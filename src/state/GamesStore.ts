import { defineStore } from 'pinia';
import { ref } from 'vue';

import {
  AnalysisBranchExitBehaviour,
  DrawOfferDirection,
  EngineAnalysisSearchMode,
  GameState,
  PauseReason,
  PlayerActivityState,
  PlayerColour,
  PlayerType,
  ResultReason,
  ResultState,
  type IAnalysisSnapshot,
  type IAssignedEngine,
  type IClockSnapshot,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IEngineRecord,
  type IGame,
  type IGameRuntime,
  type IPlayer,
  type IStartGameFromSetupRequest,
  type IVisibleAnalysisSnapshot,
  type IMove,
  type IMoveNode,
  type MovePath,
  type IBoardPosition,
  type BoardId,
  type IChessPiece,
} from '@/contracts';
import {
  EngineRuntimeService,
  MoveHistoryService,
  MoveApplicationService,
  PlatformEventService,
  PositionIdentityService,
  TimeControlService,
  UserSettingService,
} from '@/domain';
import { createInitialBoardPosition, isMoveLegal, resolveGameResult, toDetailedMove } from '@/utility/chess';
import { getOpponentColour } from '@/utility/chess/BoardUtility';
import { isBoardId } from '@/utility/chess/SquareUtility';
import { logHandledError } from '@/utility/errors';
import { Deferred } from '@/utility/async/Deferred';
import { AnalysisTimestamp, ClockTimestamp, RecordTimestamp } from '@/utility/date';
import Aborted from '@/contracts/errors/Aborted';
import InvalidMove from '@/contracts/errors/InvalidMove';

type LiveGame = IGame & {
  livePath: MovePath;
}

export const useGamesStore = defineStore('gamesStore', () => {
  function clonePlayer(player?: IPlayer): IPlayer | undefined {
    if (!player) return;
    const clonedPlayer = structuredClone(player);
    clonedPlayer.$ = { activityState: PlayerActivityState.Active };
    return clonedPlayer;
  }
  function createAssignedEngine(engineProfile: IEngineRecord): IAssignedEngine {
    return {
      displayName: engineProfile.displayName,
      executablePath: engineProfile.executablePath,
      clientType: engineProfile.clientType,
      protocol: engineProfile.protocol,
      options: structuredClone(engineProfile.options),
    };
  }
  function createAnalysisSnapshot(engineProfile: IEngineRecord, positionKey: string, updatedAt: Date): IAnalysisSnapshot {
    return {
      assignedEngine: createAssignedEngine(engineProfile),
      positionKey,
      updatedAt: new AnalysisTimestamp(updatedAt),
      lines: [],
      isComplete: false,
    };
  }
  function createGameMetadata(name: string, nowUtc: Date) {
    return {
      id: crypto.randomUUID(),
      name,
      createdAt: new RecordTimestamp(nowUtc),
      updatedAt: new RecordTimestamp(nowUtc),
    };
  }
  function _getRuntimeNodeOfPath(tree: IGame['moveTree'], path: MovePath): IMoveNode {
    let currentNode = tree.root;
    for (const childIndex of path) {
      const nextNode = currentNode.children[childIndex];
      if (!nextNode) throw new Error('Move path does not exist in the hydrated tree.');
      currentNode = nextNode;
    }
    return currentNode;
  }
  function _buildGameRuntime(game: IGame): IGameRuntime {
    return {
      renderedNode: _getRuntimeNodeOfPath(game.moveTree, _getCurrentPath(game)),
      liveNode: game.livePath ? _getRuntimeNodeOfPath(game.moveTree, game.livePath) : undefined,
    };
  }
  function createGameRuntime(game: IGame): IGameRuntime {
    return _buildGameRuntime(game);
  }
  function _requireGameRuntime(game: IGame): IGameRuntime {
    if (!game.$) throw new Error(`Game runtime is not initialised for ${game.metadata.id}.`);
    return game.$;
  }
  function _isLiveState(state: GameState): boolean {
    return state === GameState.LiveWhiteTurn || state === GameState.LiveBlackTurn;
  }
  function _isPausedLiveState(state: GameState): boolean {
    return state === GameState.PausedWhiteTurn || state === GameState.PausedBlackTurn;
  }
  function _isPausedState(state: GameState): boolean {
    return _isPausedLiveState(state) || _isPausedLiveAnalysisState(state);
  }
  function _isLiveAnalysisState(state: GameState): boolean {
    return state === GameState.LiveAnalysisFromWhiteTurnWhiteMove
      || state === GameState.LiveAnalysisFromWhiteTurnBlackMove
      || state === GameState.LiveAnalysisFromBlackTurnWhiteMove
      || state === GameState.LiveAnalysisFromBlackTurnBlackMove;
  }
  function _isPausedLiveAnalysisState(state: GameState): boolean {
    return state === GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove
      || state === GameState.PausedLiveAnalysisFromWhiteTurnBlackMove
      || state === GameState.PausedLiveAnalysisFromBlackTurnWhiteMove
      || state === GameState.PausedLiveAnalysisFromBlackTurnBlackMove;
  }
  function _isAnyLiveAnalysisState(state: GameState): boolean {
    return _isLiveAnalysisState(state) || _isPausedLiveAnalysisState(state);
  }
  function _isAnalysisState(state: GameState): boolean {
    return state === GameState.AnalysisWhiteMove || state === GameState.AnalysisBlackMove || _isAnyLiveAnalysisState(state);
  }

  function isLiveTurnReadyForMove(game: IGame): boolean {
    return _isLiveState(game.gameState) && game.resultState === ResultState.Ongoing && pathsEqual(game.highlightPath, game.livePath ?? []);
  }
  function isTimedGame(game: IGame): boolean {
    return game.timeControl.initialMs !== undefined && game.timeControl.preset !== 'untimed';
  }
  function getAnalysisState(colour: PlayerColour): GameState {
    return colour === PlayerColour.White ? GameState.AnalysisWhiteMove : GameState.AnalysisBlackMove;
  }
  function getLiveState(colour: PlayerColour): GameState {
    return colour === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn;
  }
  function getPausedState(colour: PlayerColour): GameState {
    return colour === PlayerColour.White ? GameState.PausedWhiteTurn : GameState.PausedBlackTurn;
  }
  function getLiveAnalysisState(liveColour: PlayerColour, currentColour: PlayerColour, isPaused: boolean = false): GameState {
    if (liveColour === PlayerColour.White) {
      if (currentColour === PlayerColour.White) return isPaused ? GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove : GameState.LiveAnalysisFromWhiteTurnWhiteMove;
      return isPaused ? GameState.PausedLiveAnalysisFromWhiteTurnBlackMove : GameState.LiveAnalysisFromWhiteTurnBlackMove;
    }
    if (currentColour === PlayerColour.White) return isPaused ? GameState.PausedLiveAnalysisFromBlackTurnWhiteMove : GameState.LiveAnalysisFromBlackTurnWhiteMove;
    return isPaused ? GameState.PausedLiveAnalysisFromBlackTurnBlackMove : GameState.LiveAnalysisFromBlackTurnBlackMove;
  }
  function _getLiveAnchorColour(game: IGame): PlayerColour {
    if (
      game.gameState === GameState.LiveAnalysisFromWhiteTurnWhiteMove
      || game.gameState === GameState.LiveAnalysisFromWhiteTurnBlackMove
      || game.gameState === GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove
      || game.gameState === GameState.PausedLiveAnalysisFromWhiteTurnBlackMove
    ) return PlayerColour.White;
    return PlayerColour.Black;
  }
  /** gets the path that leads to the currently rendered position */
  function _getCurrentPath(game: IGame): MovePath {
    return [...game.highlightPath];
  }
  /** get the node of the currently rendered position */
  function _getCurrentNode(game: IGame): IMoveNode {
    return _requireGameRuntime(game).renderedNode;
  }
  function getLiveNode(game: IGame): IMoveNode {
    const liveNode = _requireGameRuntime(game).liveNode;
    if (!liveNode) throw new Error(`Live node is not available for ${game.metadata.id}.`);
    return liveNode;
  }
  /** generates one final position by replaying the path's moves from the board root */
  function _genPositionAtPath(game: IGame, path: MovePath): IBoardPosition {
    return MoveApplicationService.genPosition(game.rootPosition, MoveHistoryService.getMoveSequence(game.moveTree, path));
  }
  /**
   * moves apply in place, so a committed move leaves these slots already correct; they are only
   * regenerated after something invalidates them.
   */
  function getRenderedPosition(game: IGame): IBoardPosition {
    const runtime = _requireGameRuntime(game);
    return runtime.renderedPosition ??= _genPositionAtPath(game, game.highlightPath);
  }
  function getLivePosition(game: IGame): IBoardPosition {
    const runtime = _requireGameRuntime(game);
    if (!game.livePath) throw new Error(`Live position is not available for ${game.metadata.id}.`);
    return runtime.livePosition ??= _genPositionAtPath(game, game.livePath);
  }
  function _invalidateRuntimePositions(game: IGame): void {
    const runtime = _requireGameRuntime(game);
    runtime.renderedPosition = undefined;
    runtime.livePosition = undefined;
  }
  function pathsEqual(left?: MovePath, right?: MovePath): boolean {
    if ((left?.length ?? 0) !== (right?.length ?? 0)) return false;
    return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  }
  /** note prefix cannot be whole match */
  function isPathPrefix(prefix: MovePath, candidate?: MovePath): boolean {
    if (!candidate || prefix.length >= candidate.length) return false;
    return prefix.every((segment, index) => candidate[index] === segment);
  }
  function getSideToMovePlayer(game: IGame, positionColour: PlayerColour): IPlayer | undefined {
    return positionColour === PlayerColour.White ? game.whitePlayer : game.blackPlayer;
  }
  function isEnginePlayer(player?: IPlayer): player is IEnginePlayer {
    return player?.type === PlayerType.Engine;
  }
  function hasRunningClock(snapshot: IClockSnapshot): boolean {
    return snapshot.activeColour !== undefined
      && snapshot.startedAtUtc !== undefined
      && (snapshot.white.isRunning || snapshot.black.isRunning);
  }
  function updateGameStateAfterPosition(game: IGame, positionColour: PlayerColour) {
    if (game.resultState !== ResultState.Ongoing) game.gameState = getAnalysisState(positionColour);
    else if (_isLiveState(game.gameState)) game.gameState = getLiveState(positionColour);
    else if (_isPausedLiveState(game.gameState)) game.gameState = getPausedState(positionColour);
    else if (_isAnyLiveAnalysisState(game.gameState))
      game.gameState = getLiveAnalysisState(_getLiveAnchorColour(game), positionColour, _isPausedLiveAnalysisState(game.gameState));
    else game.gameState = getAnalysisState(positionColour);
  }
  async function stopAssignedEngine(engine?: IAssignedEngine): Promise<void> {
    if (!engine) return;
    try {
      await EngineRuntimeService.stopEngine(engine);
    } catch (error) {
      logHandledError('GamesStore', 'stopEngine', error);
    }
  }
  function setGameUpdateTimeNow(game: IGame): void {
    game.metadata.updatedAt = new RecordTimestamp();
  }
  function hydrateMoveNode(node: IMoveNode, parent?: IMoveNode): IMoveNode {
    const hydratedMove = node.move ? structuredClone(node.move) : undefined;
    const hydratedNode: IMoveNode = {
      kind: node.kind,
      move: hydratedMove,
      clockSnapshot: node.clockSnapshot ? structuredClone(node.clockSnapshot) : undefined,
      plyIndex: node.plyIndex,
      mainlineChildIndex: node.mainlineChildIndex,
      children: [],
      $: parent ? { parent } : undefined,
    };
    hydratedNode.children = node.children.map((child) => hydrateMoveNode(child, hydratedNode));
    return hydratedNode;
  }
  function _getCurrentNodeOfPath(tree: IGame['moveTree'], path: MovePath): IMoveNode {
    return _getRuntimeNodeOfPath(tree, path);
  }
  function getPathToNode(node: IMoveNode): MovePath {
    const path: MovePath = [];
    let currentNode: IMoveNode | undefined = node;
    while (currentNode?.$?.parent) {
      const parentNode: IMoveNode = currentNode.$.parent;
      const childIndex = parentNode.children.indexOf(currentNode);
      if (childIndex < 0) throw new Error('Node is no longer attached to the hydrated tree.');
      path.unshift(childIndex);
      currentNode = parentNode;
    }
    return path;
  }
  function isNodeInTree(tree: IGame['moveTree'], node: IMoveNode): boolean {
    let currentNode: IMoveNode | undefined = node;
    while (currentNode?.$?.parent) currentNode = currentNode.$.parent;
    return currentNode === tree.root;
  }
  function hydrateGame(game: IGame): IGame {
    // rebuilds the runtime-only $.parent links a persisted tree cannot carry; getPathToNode walks them
    game.moveTree = { root: hydrateMoveNode(game.moveTree.root) };
    game.$ = createGameRuntime(game);
    _syncMoveNodeHighlights(game);
    return game;
  }
  function cloneAnalysisSnapshotForRead(snapshot: IAnalysisSnapshot): IAnalysisSnapshot {
    return {
      assignedEngine: {
        displayName: snapshot.assignedEngine.displayName,
        executablePath: snapshot.assignedEngine.executablePath,
        clientType: snapshot.assignedEngine.clientType,
        protocol: snapshot.assignedEngine.protocol,
        options: structuredClone(snapshot.assignedEngine.options),
      },
      positionKey: snapshot.positionKey,
      updatedAt: snapshot.updatedAt,
      bestMove: snapshot.bestMove ? structuredClone(snapshot.bestMove) : undefined,
      lines: structuredClone(snapshot.lines),
      isComplete: snapshot.isComplete,
    };
  }
  function _repairDuplicateGameId(game: IGame, existingGameIds: ReadonlySet<string>): IGame {
    if (!existingGameIds.has(game.metadata.id)) return game;
    return {
      ...game,
      metadata: {
        ...game.metadata,
        id: crypto.randomUUID(), //fix this so we append underscore + next integer available instead, game ids are the game name and folder name
        updatedAt: new RecordTimestamp(),
      },
    };
  }

  const _games = ref<IGame[]>([]);
  const _analysisDisposers = new WeakMap<IAssignedEngine, () => void>();

  function _getGameIndex(gameId: string): number {
    return _games.value.findIndex((game) => game.metadata.id === gameId);
  }
  function _getExistingGameIds(excludedGameId?: string): Set<string> {
    return new Set(_games.value.filter((game) => game.metadata.id !== excludedGameId).map((game) => game.metadata.id));
  }
  function _replaceGame(game: IGame): void {
    const gameIndex = _getGameIndex(game.metadata.id);
    if (gameIndex >= 0) _games.value.splice(gameIndex, 1, game);
    else _games.value.push(game);
  }
  function _assertNotPausedForAction(game: IGame, action: string): void {
    if (!_isPausedState(game.gameState)) return;
    throw new Error(`${action} is not allowed while gameState is ${game.gameState}.`);
  }
  function _assertMoveAllowed(game: IGame): void {
    switch (game.gameState) {
      case GameState.LiveWhiteTurn:
      case GameState.LiveBlackTurn:
      case GameState.AnalysisWhiteMove:
      case GameState.AnalysisBlackMove:
      case GameState.LiveAnalysisFromWhiteTurnWhiteMove:
      case GameState.LiveAnalysisFromWhiteTurnBlackMove:
      case GameState.LiveAnalysisFromBlackTurnWhiteMove:
      case GameState.LiveAnalysisFromBlackTurnBlackMove:
        return;
      case GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove:
      case GameState.PausedLiveAnalysisFromWhiteTurnBlackMove:
      case GameState.PausedLiveAnalysisFromBlackTurnWhiteMove:
      case GameState.PausedLiveAnalysisFromBlackTurnBlackMove:
      case GameState.PausedWhiteTurn:
      case GameState.PausedBlackTurn:
      case GameState.BoardEdit:
        throw new Error(`Move submission is not allowed while gameState is ${game.gameState}.`);
    }
  }
  function _canPauseForReason(game: IGame, reason: PauseReason): boolean {
    if (reason === PauseReason.Analysis) return true;
    return isTimedGame(game) && hasRunningClock(game.clockSnapshot);
  }
  function _clearDeferredPlayerMove(runtime: IGameRuntime): void {
    runtime.deferredPlayerMove = undefined;
  }
  function _clearPendingPlayerTurn(runtime: IGameRuntime): void {
    runtime.pendingPlayerTurnPromise?.reject(new Aborted()); //should be save since it would have been resolved or unassigned normally
    runtime.pendingPlayerTurnPromise = undefined;
    runtime.pendingPlayerTurnHandlePromise = undefined;
  }
  function _clearPlayerTurnRuntime(game: IGame): void {
    const runtime = _requireGameRuntime(game);
    _clearDeferredPlayerMove(runtime);
    _clearPendingPlayerTurn(runtime);
  }
  async function _flushDeferredPlayerMove(game: IGame) {
    const runtime = _requireGameRuntime(game);
    const deferredPlayerMove = runtime.deferredPlayerMove;
    if (!deferredPlayerMove) return;
    runtime.deferredPlayerMove = undefined;
    if (!isLiveTurnReadyForMove(game)) return;
    const player = getSideToMovePlayer(game, deferredPlayerMove.movingColour);
    if (isMoveLegal(getLivePosition(game), deferredPlayerMove)) _commitLiveMove(game, deferredPlayerMove, isEnginePlayer(player) ? player.assignedEngine : undefined);
    else _requestPlayerMoveIfNeeded(game);
  }
  function _disposeAnalysisSubscription(engine: IAssignedEngine): void {
    const dispose = _analysisDisposers.get(engine);
    if (dispose) dispose();
    _analysisDisposers.delete(engine);
  }
  function _refreshRuntimeRegistrations(game: IGame): void {
    const runtime = _requireGameRuntime(game);
    runtime.focusReturnUnsubscribe?.();
    runtime.focusReturnUnsubscribe = undefined;
    if (!_isLiveState(game.gameState) || game.resultState !== ResultState.Ongoing || !isTimedGame(game)) return;
    runtime.focusReturnUnsubscribe = PlatformEventService.subscribeToAppFocusReturned('GamesStore', () => syncClock(game, new ClockTimestamp()), `sync-clock-${game.metadata.id}`);
  }
  /** rebuilds the node cache only; the position slots are owned by whoever changes the paths */
  function _syncRuntimeNodeCache(game: IGame): void {
    _syncMoveNodeHighlights(game);
    game.$ = {
      ..._requireGameRuntime(game),
      ..._buildGameRuntime(game),
    };
  }
  function _syncMoveNodeHighlights(game: IGame): void {
    const highlightedPaths = [game.highlightPath, game.livePath ?? []];
    function _syncNode(node: IMoveNode, path: MovePath): void {
      node.$ = {
        ...node.$,
        isHighlighted: highlightedPaths.some((candidate) => candidate.length >= path.length && path.every((segment, index) => candidate[index] === segment)),
      };
      node.children.forEach((child, index) => _syncNode(child, [...path, index]));
    }
    _syncNode(game.moveTree.root, []);
  }
  function _resolveAnalysisSnapshot(game: IGame, engine: IAssignedEngine): IAnalysisSnapshot | undefined {
    return game.analysis.snapshots.find((snapshot) => snapshot.assignedEngine === engine);
  }
  function _subscribeToAnalysis(game: IGame, engine: IAssignedEngine): void {
    _disposeAnalysisSubscription(engine);
    const dispose = EngineRuntimeService.subscribeToAnalysis(engine, (update) => {
      const snapshot = _resolveAnalysisSnapshot(game, engine);
      if (!snapshot) return;
      snapshot.positionKey = update.positionKey;
      snapshot.updatedAt = new AnalysisTimestamp();
      snapshot.bestMove = update.bestMove ? structuredClone(update.bestMove) : undefined;
      snapshot.lines = structuredClone(update.lines);
      snapshot.isComplete = update.isFinal;
      setGameUpdateTimeNow(game);
    });
    _analysisDisposers.set(engine, dispose);
  }
  function _resetAnalysisSnapshot(snapshot: IAnalysisSnapshot, isComplete: boolean = false): void {
    snapshot.bestMove = undefined;
    snapshot.lines = [];
    snapshot.isComplete = isComplete;
  }
  async function _startAnalysisSnapshot(game: IGame, snapshot: IAnalysisSnapshot): Promise<void> {
    const position = getRenderedPosition(game); // also fills the slot the engine client reads
    _subscribeToAnalysis(game, snapshot.assignedEngine);
    snapshot.positionKey = PositionIdentityService.buildPositionKey(position);
    snapshot.updatedAt = new AnalysisTimestamp();
    _resetAnalysisSnapshot(snapshot);
    if (snapshot.assignedEngine.$) snapshot.assignedEngine.$.lastError = undefined;
    await EngineRuntimeService.ensureReady(snapshot.assignedEngine);
    await EngineRuntimeService.startAnalysis(snapshot.assignedEngine, game, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
  }
  async function _refreshAnalysisForGame(game: IGame, engineIndex?: number): Promise<void> {
    const targetSnapshots = engineIndex === undefined ? game.analysis.snapshots : [game.analysis.snapshots[engineIndex]!].filter((snapshot) => !!snapshot);
    for (const snapshot of targetSnapshots) {
      try {
        await _startAnalysisSnapshot(game, snapshot);
      } catch (error) {
        _resetAnalysisSnapshot(snapshot, true);
        if (snapshot.assignedEngine.$) snapshot.assignedEngine.$.lastError = error instanceof Error ? error.message : 'Analysis failed.';
        logHandledError('GamesStore', 'startAnalysis', error);
      }
    }
  }
  function _normalisePlayers(game: IGame): void {
    if (game.whitePlayer) game.whitePlayer.$ = { activityState: PlayerActivityState.Active };
    if (game.blackPlayer) game.blackPlayer.$ = { activityState: PlayerActivityState.Active };
  }
  function _updatePositionResult(game: IGame, nextPosition: IBoardPosition) {
      const resolvedResult = resolveGameResult(nextPosition);
      game.resultState = resolvedResult.resultState;
      game.resultReason = resolvedResult.resultReason;
  }
  //#region move committing
  function _finaliseMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, nextMove: IMove, nextClockSnapshot?: IClockSnapshot, asAnalysisMove: boolean = false): IMoveNode {
    // detailing needs the parent board, so it must run before the in-place apply
    const detailedMove = toDetailedMove(parentPosition, nextMove);
    // applying in place turns parentPosition into the child's position, so the cache slot stays valid
    const nextPosition = MoveApplicationService.applyMove(parentPosition, detailedMove);
    const nextNodeIdx = parentNode.children.length;
    const nextNode = asAnalysisMove
      ? MoveHistoryService.addAnalysisMove(parentNode, detailedMove)
      : MoveHistoryService.addMainlineMove(parentNode, detailedMove, nextClockSnapshot);
    game.highlightPath.push(nextNodeIdx);
    if (!asAnalysisMove) {
      if (!game.livePath) throw new ReferenceError('live path is undefined even though we are making a live move');
      game.livePath?.push(nextNodeIdx);
      if (nextClockSnapshot) game.clockSnapshot = nextClockSnapshot;
    }
    const runtime = _requireGameRuntime(game);
    runtime.renderedPosition = nextPosition;
    if (!asAnalysisMove) runtime.livePosition = nextPosition;
    _syncRuntimeNodeCache(game);
    _updatePositionResult(game, nextPosition);
    updateGameStateAfterPosition(game, nextPosition.sideToMove);
    setGameUpdateTimeNow(game);
    return nextNode;
  }
  function _finaliseAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, nextMove: IMove): IMoveNode {
    return _finaliseMove(game, parentNode, parentPosition, nextMove, undefined, true);
  }
  function _commitLiveMove(game: IGame, move: IMove, ponderEngine?: IAssignedEngine) {
    const baseClockSnapshot = game.clockSnapshot;
    const nextClockSnapshot = TimeControlService.applyMove(baseClockSnapshot, move.movingColour, new ClockTimestamp(), game.timeControl);

    let parentNode = getLiveNode(game);
    const parentPosition = getLivePosition(game);
    if (parentNode.children.length > 0) MoveHistoryService.pruneFutureMoves(parentNode);
    _finaliseMove(game, parentNode, parentPosition, move, nextClockSnapshot);
    _clearPlayerTurnRuntime(game);
    _refreshRuntimeRegistrations(game);
    _startPonderingIfAvailable(game, ponderEngine, move.$?.ponderMove);
    _refreshAnalysisForGame(game);
    _requestPlayerMoveIfNeeded(game);
  }
  function _commitHistoryRewriteMove(game: IGame, parentNode: IMoveNode, move: IMove): void {
    game.clockSnapshot = parentNode.clockSnapshot ?? game.clockSnapshot; //don't know if takeback should also revert time...

    //TODO: need to mark nodes that used to be live analysis, pass the original livePath
    //   live path will be part of move tree runtime, so just call MoveHistoryService new method to mark live path from the next live node of parentNode
    //   now live path is pruned we just commitLiveMove

    _commitLiveMove(game, move);
  }
  function _commitLiveHistoryAnalysisMove(game: IGame, parentNode: IMoveNode, parentPosition: IBoardPosition, move: IMove, exitBehaviour: AnalysisBranchExitBehaviour): void {
    const resultState = game.resultState;
    const resultReason = game.resultReason;
    const nextNode = _finaliseAnalysisMove(game, parentNode, parentPosition, move);
    game.resultState = resultState;
    game.resultReason = resultReason;
    if (exitBehaviour === AnalysisBranchExitBehaviour.ReturnToLiveNode) {
      game.highlightPath = [...game.livePath!];
      _requireGameRuntime(game).renderedPosition = getLivePosition(game); // back on the live node: alias it
      _syncRuntimeNodeCache(game);
      game.gameState = getLiveState(getLivePosition(game).sideToMove);
      setGameUpdateTimeNow(game);
      return;
    }
    game.highlightPath = getPathToNode(nextNode);
    _syncRuntimeNodeCache(game);
    game.gameState = getLiveAnalysisState(getLivePosition(game).sideToMove, getRenderedPosition(game).sideToMove);
    setGameUpdateTimeNow(game);
    _refreshAnalysisForGame(game);
  }
  function _replaceWithAnalysisRoot(game: IGame, boardRoot: IBoardPosition, nextState: GameState): void {
    const nextClockSnapshot = TimeControlService.initialiseClockSnapshot(game.timeControl);
    game.rootPosition = boardRoot;
    game.moveTree = MoveHistoryService.createMoveTree(nextClockSnapshot);
    _invalidateRuntimePositions(game);
    game.highlightPath = [];
    game.livePath = undefined;
    game.clockSnapshot = nextClockSnapshot;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    _clearPlayerTurnRuntime(game);
    game.gameState = nextState;
    _syncRuntimeNodeCache(game);
    setGameUpdateTimeNow(game);
  }
  function _assertBoardEdit(game: IGame): void {
    if (game.gameState !== GameState.BoardEdit) throw new Error('Board manipulation is only allowed while board edit mode is active.');
  }
  function _assertBoardId(boardId: BoardId): void {
    if (!isBoardId(boardId)) throw new RangeError(`Board id must be between 0 and 63: ${boardId}.`);
  }
  /**
   * Board edits mutate in place. The first effective edit promotes the edited rendered position to the
   * new board root and clears prior history; from then on the root and the rendered slot are the same
   * object, so later edits touch both at once.
   */
  function _applyBoardEdit(game: IGame, edit: (position: IBoardPosition) => boolean): void {
    _assertBoardEdit(game);
    const renderedPosition = getRenderedPosition(game);
    if (!edit(renderedPosition)) return; // nothing changed, so prior history survives
    if (renderedPosition !== game.rootPosition) {
      _replaceWithAnalysisRoot(game, renderedPosition, GameState.BoardEdit);
      _requireGameRuntime(game).renderedPosition = renderedPosition;
      return;
    }
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    _syncRuntimeNodeCache(game);
    setGameUpdateTimeNow(game);
  }
  //#endregion
  //#region states checking
  function _isOngoingLiveGame(game: IGame): game is LiveGame {
    return game.resultState === ResultState.Ongoing && !!game.livePath;
  }
  /** if clicked on a position in the live path in the past, not a variation */
  function _isLiveHistoryReview(game: LiveGame) {
    return isPathPrefix(game.highlightPath, game.livePath);
  }
  //#endregion
  function _startPonderingIfAvailable(game: IGame, engine: IAssignedEngine | undefined, ponderMove: IMove | undefined): void {
    if (!engine || !ponderMove || game.resultState !== ResultState.Ongoing || game.livePath === undefined) return;
    getLivePosition(game); // the engine client requires the live slot to be filled
    void EngineRuntimeService.startPondering(engine, game, ponderMove).catch((error) => logHandledError('GameStore', 'startPondering', error));
  }
  function _requestPlayerMove(game: IGame) {
    async function _requestEngineMove(game: IGame, engine: IAssignedEngine): Promise<IMove> {
      await EngineRuntimeService.ensureReady(engine);
      await EngineRuntimeService.startPlayerTurn(engine, game);
      const move = await EngineRuntimeService.awaitPlayerTurnMove(engine);
      return move;
    }
    async function _playerMoveHandler(game: IGame, pendingPlayerMove: Promise<IMove>, engine?: IAssignedEngine) {
      let move: IMove;
      try {
        move = await pendingPlayerMove;
      } catch(e) {
        if (!(e instanceof Aborted)) {
          logHandledError('GameStore', '_playerMoveHandler', e);
          setTimeout(()=>_requestPlayerMove(game), 500); //retry
        }
        return;
      } finally {
        const runtime = _requireGameRuntime(game);
        runtime.pendingPlayerTurnPromise = undefined;
        runtime.pendingPlayerTurnHandlePromise = undefined;
      }
      if (_isPausedState(game.gameState)) runtime.deferredPlayerMove = move;
      else _commitLiveMove(game, move, engine);
    }
    const player = getSideToMovePlayer(game, getLivePosition(game).sideToMove);
    const runtime = _requireGameRuntime(game);
    const pendingPlayerMove = isEnginePlayer(player)
      ? new Deferred<IMove>(_requestEngineMove(game, player.assignedEngine))
      : new Deferred<IMove>();
    runtime.pendingPlayerTurnPromise = pendingPlayerMove;
    runtime.pendingPlayerTurnHandlePromise = _playerMoveHandler(game, pendingPlayerMove, isEnginePlayer(player) ? player.assignedEngine : undefined);
  }
  function _requestPlayerMoveIfNeeded(game: IGame) {
    if (!_isOngoingLiveGame(game) || !_isLiveState(game.gameState) || !pathsEqual(game.highlightPath, game.livePath)) return;
    if (_requireGameRuntime(game).pendingPlayerTurnPromise) return;
    _requestPlayerMove(game);
  }
  async function _hydrateAndInsertGame(game: IGame): Promise<IGame> {
    const hydratedGame = hydrateGame(_repairDuplicateGameId(game, _getExistingGameIds()));
    _normalisePlayers(hydratedGame);
    _replaceGame(hydratedGame);
    _refreshRuntimeRegistrations(hydratedGame);
    return hydratedGame;
  }
  async function createGame(request: ICreateGameRequest): Promise<IGame> {
    const nowUtc = new Date();
    const rootPosition = request.rootPosition ?? createInitialBoardPosition();
    const initialClockSnapshot = TimeControlService.initialiseClockSnapshot(request.timeControl);
    const initialState = request.whitePlayer && request.blackPlayer ? getLiveState(rootPosition.sideToMove) : getAnalysisState(rootPosition.sideToMove);
    const livePath: MovePath | undefined = request.whitePlayer && request.blackPlayer ? [] : undefined;
    const initialPositionKey = PositionIdentityService.buildPositionKey(rootPosition);
    const game: IGame = {
      schemaVersion: 1,
      metadata: createGameMetadata(request.name, nowUtc),
      gameState: initialState,
      resultState: ResultState.Ongoing,
      whitePlayer: clonePlayer(request.whitePlayer),
      blackPlayer: clonePlayer(request.blackPlayer),
      rootPosition,
      moveTree: MoveHistoryService.createMoveTree(initialClockSnapshot),
      livePath,
      highlightPath: [],
      timeControl: structuredClone(request.timeControl),
      clockSnapshot: request.whitePlayer && request.blackPlayer ? TimeControlService.startClock(initialClockSnapshot, rootPosition.sideToMove, new ClockTimestamp(nowUtc)) : initialClockSnapshot,
      analysis: {
        snapshots: request.analysisEngineProfiles.map((engineProfile) => createAnalysisSnapshot(engineProfile, initialPositionKey, nowUtc)),
      },
      gameplayOptions: { allowTakeback: request.allowTakeback, showLiveAnalysisMoves: request.showLiveAnalysisMoves  },
    };
    const insertedGame = await _hydrateAndInsertGame(game);
    _requestPlayerMoveIfNeeded(insertedGame);
    if (insertedGame.analysis.snapshots.length > 0) await _refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  async function startGameFromSetup(game: IGame, request: IStartGameFromSetupRequest): Promise<void> {
    game.metadata.name = request.name ?? game.metadata.name;
    game.whitePlayer = clonePlayer(request.whitePlayer);
    game.blackPlayer = clonePlayer(request.blackPlayer);
    game.timeControl = structuredClone(request.timeControl);
    game.gameplayOptions = { showLiveAnalysisMoves:request.showLiveAnalysisMoves, allowTakeback: request.allowTakeback };
    const renderedPosition = getRenderedPosition(game);
    game.analysis.snapshots = request.analysisEngineProfiles.map((engineProfile) => createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(renderedPosition), new Date()));
    game.clockSnapshot = TimeControlService.initialiseClockSnapshot(game.timeControl);
    _clearPlayerTurnRuntime(game);
    if (game.whitePlayer && game.blackPlayer) {
      game.livePath = [...game.highlightPath];
      _requireGameRuntime(game).livePosition = renderedPosition; // the live node is now the rendered one
      game.clockSnapshot = TimeControlService.startClock(game.clockSnapshot, renderedPosition.sideToMove, new ClockTimestamp());
      game.resultState = ResultState.Ongoing;
      game.resultReason = undefined;
      game.gameState = getLiveState(renderedPosition.sideToMove);
    } else {
      game.livePath = undefined;
      _requireGameRuntime(game).livePosition = undefined;
      game.gameState = getAnalysisState(renderedPosition.sideToMove);
    }
    _syncRuntimeNodeCache(game);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    _requestPlayerMoveIfNeeded(game);
    await _refreshAnalysisForGame(game);
  }
  async function insertGame(game: IGame): Promise<IGame> {
    const insertedGame = await _hydrateAndInsertGame(game);
    const settings = await UserSettingService.getSettingsOrDefault();
    if (settings.analysis.resumeLiveAnalysisAfterRestore && insertedGame.analysis.snapshots.length > 0) await _refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  function getGame(gameId: string): IGame | undefined {
    return _games.value.find((game) => game.metadata.id === gameId);
  }
  function listGames(): IGame[] {
    return _games.value;
  }
  /** this makes moves to the rendered game, not the currently live game */
  async function makeMove(game: IGame, move: IMove) {
    //validating
    _assertMoveAllowed(game);
    const parentNode = _getCurrentNode(game);
    const parentPosition = getRenderedPosition(game);
    if (!isMoveLegal(parentPosition, move)) throw new InvalidMove(move);
    async function _makeMoveByState(game:IGame, move:IMove) {
      if (_isOngoingLiveGame(game) && (_isLiveHistoryReview(game) || _isLiveState(game.gameState))) {
        if (_isLiveHistoryReview(game)) {
          if (game.gameplayOptions.allowTakeback) return _commitHistoryRewriteMove(game, parentNode, move);
          else return _commitLiveHistoryAnalysisMove(game, parentNode, parentPosition, move, UserSettingService.getSettings().gameplay.analysisBranchExitBehaviour);
        } else {
          if (!game.$?.pendingPlayerTurnPromise || !game.$?.pendingPlayerTurnHandlePromise) throw new ReferenceError(`turn started to allow make move for ${move.movingColour} but move request was not made`);
          game.$.pendingPlayerTurnPromise.resolve(move);
          return await game.$.pendingPlayerTurnHandlePromise;
        }
        //TODO: throw exception if there is an ongoing live game but not doing analysis move
      }
      // othewise just move it in analysis mode
      const resultState = game.resultState;
      const resultReason = game.resultReason;
      _finaliseAnalysisMove(game, parentNode, parentPosition, move);
      if (game.livePath && resultState === ResultState.Ongoing) {
        game.resultState = resultState;
        game.resultReason = resultReason;
        game.gameState = getLiveAnalysisState(getLivePosition(game).sideToMove, getRenderedPosition(game).sideToMove);
        setGameUpdateTimeNow(game);
      }
    }
    await _makeMoveByState(game, move);
  }
  async function takeBack(game: IGame, moveCount: number = 1): Promise<void> {
    _assertNotPausedForAction(game, 'Takeback');
    const targetNode = _getCurrentNode(game);
    game.moveTree = MoveHistoryService.takeBack(targetNode, moveCount);
    const fallbackNode = targetNode.$?.parent ? _getCurrentNodeOfPath(game.moveTree, getPathToNode(targetNode.$.parent)) : game.moveTree.root;
    game.highlightPath = getPathToNode(fallbackNode);
    if (game.livePath) game.livePath = game.highlightPath;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    _clearPlayerTurnRuntime(game);
    _invalidateRuntimePositions(game); // the cached positions belonged to nodes that no longer exist
    _syncRuntimeNodeCache(game);
    updateGameStateAfterPosition(game, getRenderedPosition(game).sideToMove);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    _requestPlayerMoveIfNeeded(game);
    await _refreshAnalysisForGame(game);
  }
  function navigateToNode(game: IGame, node: IMoveNode): void {
    _assertNotPausedForAction(game, 'History navigation');
    if (!isNodeInTree(game.moveTree, node)) return;
    const nextPath = getPathToNode(node);
    const isLiveNode = game.livePath !== undefined && pathsEqual(nextPath, game.livePath);
    const hasLivePath = game.livePath !== undefined;
    game.highlightPath = nextPath;
    // returning to the live node re-aliases its position; anything else regenerates on next read
    _requireGameRuntime(game).renderedPosition = isLiveNode ? getLivePosition(game) : undefined;
    _syncRuntimeNodeCache(game);
    const renderedColour = getRenderedPosition(game).sideToMove;
    if (_isLiveState(game.gameState) && hasLivePath) {
      game.gameState = isLiveNode ? getLiveState(renderedColour) : getLiveAnalysisState(getLivePosition(game).sideToMove, renderedColour);
      return;
    }
    if (_isLiveAnalysisState(game.gameState) && hasLivePath) {
      const liveColour = getLivePosition(game).sideToMove;
      game.gameState = isLiveNode ? getLiveState(liveColour) : getLiveAnalysisState(liveColour, renderedColour);
      return;
    }
    updateGameStateAfterPosition(game, renderedColour);
  }
  function getVisibleAnalysis(game: IGame): IVisibleAnalysisSnapshot | undefined {
    const positionKey = PositionIdentityService.buildPositionKey(getRenderedPosition(game));
    const engineSnapshots = game.analysis.snapshots.filter((snapshot) => snapshot.positionKey === positionKey);
    if (engineSnapshots.length === 0) return;
    return { engineSnapshots: engineSnapshots.map((snapshot) => cloneAnalysisSnapshotForRead(snapshot)) };
  }
  async function syncClock(game: IGame, nowUtc: ClockTimestamp): Promise<void> {
    if (!_isLiveState(game.gameState) && !_isPausedLiveState(game.gameState)) return;
    if (!TimeControlService.hasExpired(game.clockSnapshot, nowUtc)) return;
    const remainingTime = TimeControlService.getRemainingTime(game.clockSnapshot, nowUtc);
    const expiredColour = (remainingTime.white ?? 1) <= 0 ? PlayerColour.White : PlayerColour.Black;
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, nowUtc);
    game.resultState = expiredColour === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon;
    game.resultReason = ResultReason.Timeout;
    game.gameState = getAnalysisState(getOpponentColour(expiredColour));
    _clearPlayerTurnRuntime(game);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function pauseGame(game: IGame, reason: PauseReason): Promise<void> {
    const runtime = _requireGameRuntime(game);
    if (!_canPauseForReason(game, reason)) return;
    if (_isPausedState(game.gameState)) {
      runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
      return;
    }
    if ((!_isLiveState(game.gameState) && !_isLiveAnalysisState(game.gameState)) || game.resultState !== ResultState.Ongoing) return;
    runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, new ClockTimestamp());
    if (_isLiveState(game.gameState)) game.gameState = getPausedState(getRenderedPosition(game).sideToMove);
    else game.gameState = getLiveAnalysisState(_getLiveAnchorColour(game), getRenderedPosition(game).sideToMove, true);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function resumeGame(game: IGame, reason: PauseReason): Promise<void> {
    if (reason !== PauseReason.Analysis && !isTimedGame(game)) return;
    if (!_isPausedState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const runtime = _requireGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== reason);
    if ((runtime.pauseReasons ?? []).length > 0) return;
    game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, new ClockTimestamp());
    if (_isPausedLiveState(game.gameState)) game.gameState = getLiveState(getRenderedPosition(game).sideToMove);
    else game.gameState = getLiveAnalysisState(_getLiveAnchorColour(game), getRenderedPosition(game).sideToMove);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    if (_isLiveState(game.gameState)) await _flushDeferredPlayerMove(game);
  }
  async function reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void> {
    const selectedPosition = getRenderedPosition(game);
    const liveColour = game.livePath ? getLivePosition(game).sideToMove : undefined;
    if (colour === PlayerColour.White) game.whitePlayer = clonePlayer(player);
    else game.blackPlayer = clonePlayer(player);
    _clearPlayerTurnRuntime(game);
    if (!game.whitePlayer || !game.blackPlayer) {
      _replaceWithAnalysisRoot(game, selectedPosition, getAnalysisState(selectedPosition.sideToMove));
      _requireGameRuntime(game).renderedPosition = selectedPosition;
    } else {
      if (_isPausedLiveState(game.gameState)) game.gameState = getPausedState(selectedPosition.sideToMove);
      else if (_isLiveState(game.gameState)) game.gameState = getLiveState(selectedPosition.sideToMove);
      else if (_isAnyLiveAnalysisState(game.gameState) && liveColour) game.gameState = getLiveAnalysisState(liveColour, selectedPosition.sideToMove, _isPausedLiveAnalysisState(game.gameState));
      else if (game.livePath && game.resultState === ResultState.Ongoing) game.gameState = getLiveState(selectedPosition.sideToMove);
      setGameUpdateTimeNow(game);
    }
    _refreshRuntimeRegistrations(game);
    _requestPlayerMoveIfNeeded(game);
  }
  async function addAnalysisEngine(game: IGame, engineProfile: IEngineRecord): Promise<void> {
    if (game.analysis.snapshots.some((snapshot) => snapshot.assignedEngine.displayName === engineProfile.displayName)) throw new Error(`Analysis engine already assigned: ${engineProfile.displayName}.`);
    if (game.analysis.snapshots.length >= 4) throw new Error('A game cannot have more than four analysis engines.');
    const snapshot = createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(getRenderedPosition(game)), new Date());
    game.analysis.snapshots.push(snapshot);
    setGameUpdateTimeNow(game);
    await _refreshAnalysisForGame(game, game.analysis.snapshots.length - 1);
  }
  async function removeAnalysisEngine(game: IGame, engineIndex: number): Promise<void> {
    const snapshot = game.analysis.snapshots[engineIndex];
    if (!snapshot) return;
    _disposeAnalysisSubscription(snapshot.assignedEngine);
    await stopAssignedEngine(snapshot.assignedEngine);
    game.analysis.snapshots.splice(engineIndex, 1);
    setGameUpdateTimeNow(game);
  }
  async function refreshAnalysis(game: IGame): Promise<void> {
    if (game.gameState === GameState.BoardEdit) throw new Error('Analysis refresh is not allowed during board edit.');
    await _refreshAnalysisForGame(game);
  }
  async function retryAnalysis(game: IGame, engineIndex: number): Promise<void> {
    if (game.gameState === GameState.BoardEdit) throw new Error('Analysis retry is not allowed during board edit.');
    await _refreshAnalysisForGame(game, engineIndex);
  }
  async function stopAnalysis(game: IGame, engineIndex?: number): Promise<void> {
    const targetSnapshots = engineIndex === undefined ? game.analysis.snapshots : [game.analysis.snapshots[engineIndex]!].filter((snapshot) => !!snapshot);
    for (const snapshot of targetSnapshots) {
      _disposeAnalysisSubscription(snapshot.assignedEngine);
      try {
        await EngineRuntimeService.stopAnalysis(snapshot.assignedEngine);
      } catch (error) {
        logHandledError('GamesStore', 'stopAnalysis', error);
      }
      _resetAnalysisSnapshot(snapshot, true);
    }
  }
  async function enterInGameAnalysis(game: IGame): Promise<void> {
    _assertNotPausedForAction(game, 'In-game analysis entry');
    if (_isLiveState(game.gameState)) {
      const liveNode = getLiveNode(game);
      await pauseGame(game, PauseReason.Analysis);
      game.highlightPath = getPathToNode(liveNode);
      _requireGameRuntime(game).renderedPosition = getLivePosition(game); // now on the live node
      _syncRuntimeNodeCache(game);
      const liveColour = getLivePosition(game).sideToMove;
      game.gameState = getLiveAnalysisState(liveColour, liveColour, true);
      setGameUpdateTimeNow(game);
      return;
    }
    if (game.resultReason !== ResultReason.Timeout || !game.livePath) return;
    game.gameState = getLiveAnalysisState(getLivePosition(game).sideToMove, getRenderedPosition(game).sideToMove);
    _syncRuntimeNodeCache(game);
    setGameUpdateTimeNow(game);
  }
  function exitInGameAnalysis(game: IGame): void {
    if (!_isAnyLiveAnalysisState(game.gameState)) return;
    game.highlightPath = getPathToNode(getLiveNode(game));
    _requireGameRuntime(game).renderedPosition = getLivePosition(game); // back on the live node
    _syncRuntimeNodeCache(game);
    const liveColour = getLivePosition(game).sideToMove;
    if (game.resultReason === ResultReason.Timeout && game.resultState !== ResultState.Ongoing) {
      game.gameState = getAnalysisState(getOpponentColour(liveColour));
      setGameUpdateTimeNow(game);
      return;
    }
    if (_isPausedLiveAnalysisState(game.gameState)) {
      const runtime = _requireGameRuntime(game);
      runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== PauseReason.Analysis);
      if ((runtime.pauseReasons ?? []).length > 0) game.gameState = getPausedState(liveColour);
      else {
        game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, new ClockTimestamp());
        game.gameState = getLiveState(liveColour);
      }
      _refreshRuntimeRegistrations(game);
      if (_isLiveState(game.gameState)) void _flushDeferredPlayerMove(game);
    } else game.gameState = getLiveState(liveColour);
    setGameUpdateTimeNow(game);
  }
  function enterBoardEdit(game: IGame): void {
    _assertNotPausedForAction(game, 'Board edit entry');
    if (game.gameState === GameState.BoardEdit) {
      game.gameState = getAnalysisState(game.rootPosition.sideToMove);
      _syncRuntimeNodeCache(game);
      setGameUpdateTimeNow(game);
      void _refreshAnalysisForGame(game);
      return;
    }
    if (_isLiveState(game.gameState) || _isPausedState(game.gameState) || _isAnyLiveAnalysisState(game.gameState)) return;
    void stopAnalysis(game);
    game.gameState = GameState.BoardEdit;
    _syncRuntimeNodeCache(game);
    setGameUpdateTimeNow(game);
  }
  function applyBoardEdit(game: IGame, boardRoot: IBoardPosition): void {
    if (game.gameState !== GameState.BoardEdit) throw new Error('Board edits are only allowed while board edit mode is active.');
    _replaceWithAnalysisRoot(game, boardRoot, GameState.BoardEdit);
  }
  function clearBoard(game: IGame): void {
    _applyBoardEdit(game, (position) => MoveApplicationService.clearBoard(position));
  }
  function deleteChessPiece(game: IGame, boardId: BoardId): void {
    _assertBoardEdit(game); // state is checked before input is validated
    _assertBoardId(boardId);
    _applyBoardEdit(game, (position) => MoveApplicationService.deletePiece(position, boardId));
  }
  function moveChessPiece(game: IGame, from: BoardId, to: BoardId): void {
    _assertBoardEdit(game);
    _assertBoardId(from);
    _assertBoardId(to);
    _applyBoardEdit(game, (position) => MoveApplicationService.movePiece(position, from, to));
  }
  function resetBoardToStartPosition(game: IGame): void {
    _assertBoardEdit(game);
    _replaceWithAnalysisRoot(game, createInitialBoardPosition(), GameState.BoardEdit);
  }
  function toggleChessPiece(game: IGame, boardId: BoardId, piece: IChessPiece): void {
    _assertBoardEdit(game);
    _assertBoardId(boardId);
    _applyBoardEdit(game, (position) => MoveApplicationService.togglePiece(position, boardId, piece));
  }
  async function resignGame(game: IGame, colour: PlayerColour): Promise<void> {
    _assertNotPausedForAction(game, 'Resignation');
    game.resultState = colour === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon;
    game.resultReason = ResultReason.Resignation;
    game.gameState = getAnalysisState(getOpponentColour(colour));
    game.drawOfferState = undefined;
    _clearPlayerTurnRuntime(game);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function offerDraw(game: IGame): Promise<void> {
    _assertNotPausedForAction(game, 'Draw offer');
    const offeringColour = getRenderedPosition(game).sideToMove;
    game.drawOfferState = {
      offeringColour,
      respondingColour: getOpponentColour(offeringColour),
      direction: DrawOfferDirection.Outgoing,
    };
    setGameUpdateTimeNow(game);
  }
  async function acceptDrawOffer(game: IGame): Promise<void> {
    _assertNotPausedForAction(game, 'Draw acceptance');
    if (!game.drawOfferState) return;
    game.resultState = ResultState.Drawn;
    game.resultReason = ResultReason.DrawAgreement;
    game.gameState = getAnalysisState(getRenderedPosition(game).sideToMove);
    game.drawOfferState = undefined;
    _clearPlayerTurnRuntime(game);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function declineDrawOffer(game: IGame): Promise<void> {
    _assertNotPausedForAction(game, 'Draw decline');
    game.drawOfferState = undefined;
    setGameUpdateTimeNow(game);
  }
  async function withdrawDrawOffer(game: IGame): Promise<void> {
    _assertNotPausedForAction(game, 'Draw withdrawal');
    if (game.drawOfferState?.direction === DrawOfferDirection.Outgoing) game.drawOfferState = undefined;
    setGameUpdateTimeNow(game);
  }

  return {
    createGame,
    startGameFromSetup,
    insertGame,
    getGame,
    listGames,
    makeMove,
    takeBack,
    navigateToNode,
    getVisibleAnalysis,
    syncClock,
    pauseGame,
    resumeGame,
    reassignPlayer,
    addAnalysisEngine,
    removeAnalysisEngine,
    refreshAnalysis,
    retryAnalysis,
    stopAnalysis,
    enterInGameAnalysis,
    exitInGameAnalysis,
    enterBoardEdit,
    applyBoardEdit,
    clearBoard,
    deleteChessPiece,
    moveChessPiece,
    resetBoardToStartPosition,
    toggleChessPiece,
    resignGame,
    offerDraw,
    acceptDrawOffer,
    declineDrawOffer,
    withdrawDrawOffer,
  };
});
