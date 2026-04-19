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
  TakebackPolicy,
  type IAnalysisSnapshot,
  type IAssignedEngine,
  type IClockSnapshot,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IEnginePositionState,
  type IEngineRecord,
  type IGame,
  type IGameRuntime,
  type IPlayer,
  type IStartGameFromSetupRequest,
  type IVisibleAnalysisSnapshot,
  type IMove,
  type IMoveNode,
  type MovePath,
  PlatformError,
  PlatformErrorKind,
} from '@/contracts';
import {
  EngineRuntimeService,
  GameRuleService,
  MoveUpdateService,
  MoveNotationService,
  PlatformEventService,
  PositionIdentityService,
  TimeControlService,
  UserSettingService,
} from '@/domain';
import { createInitialBoardPosition, getOpponentColour } from '@/utility/chess/BoardUtility';
import { logHandledError } from '@/utility/errors';
import { Deferred } from '@/utility/async/Deferred';
import Aborted from '@/utility/errors/Aborted';
import InvalidMove from '@/utility/errors/InvalidMove';

type LiveGame = IGame & {
  livePath: MovePath;
}

function getNowUtc(): string {
  return new Date().toISOString();
}
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
function createAnalysisSnapshot(engineProfile: IEngineRecord, positionKey: string, updatedAt: string): IAnalysisSnapshot {
  return {
    assignedEngine: createAssignedEngine(engineProfile),
    positionKey,
    updatedAt,
    lines: [],
    isComplete: false,
  };
}
function createGameMetadata(name: string, nowUtc: string) {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: nowUtc,
    updatedAt: nowUtc,
  };
}
function createGameRuntime(): IGameRuntime {
  return {};
}
function requireGameRuntime(game: IGame): IGameRuntime {
  if (!game.$) throw new Error(`Game runtime is not initialised for ${game.metadata.id}.`);
  return game.$;
}
function isLiveState(state: GameState): boolean {
  return state === GameState.LiveWhiteTurn || state === GameState.LiveBlackTurn;
}
function isPausedLiveState(state: GameState): boolean {
  return state === GameState.PausedWhiteTurn || state === GameState.PausedBlackTurn;
}
function isPausedState(state: GameState): boolean {
  return isPausedLiveState(state) || isPausedLiveAnalysisState(state);
}
function isLiveAnalysisState(state: GameState): boolean {
  return state === GameState.LiveAnalysisFromWhiteTurnWhiteMove
    || state === GameState.LiveAnalysisFromWhiteTurnBlackMove
    || state === GameState.LiveAnalysisFromBlackTurnWhiteMove
    || state === GameState.LiveAnalysisFromBlackTurnBlackMove;
}
function isPausedLiveAnalysisState(state: GameState): boolean {
  return state === GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove
    || state === GameState.PausedLiveAnalysisFromWhiteTurnBlackMove
    || state === GameState.PausedLiveAnalysisFromBlackTurnWhiteMove
    || state === GameState.PausedLiveAnalysisFromBlackTurnBlackMove;
}
function isAnyLiveAnalysisState(state: GameState): boolean {
  return isLiveAnalysisState(state) || isPausedLiveAnalysisState(state);
}
function isAnalysisState(state: GameState): boolean {
  return state === GameState.AnalysisWhiteMove || state === GameState.AnalysisBlackMove || isAnyLiveAnalysisState(state);
}

function isLiveTurnReadyForMove(game: IGame): boolean {
  return isLiveState(game.gameState) && game.resultState === ResultState.Ongoing && pathsEqual(game.highlightPath, game.livePath ?? []);
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
function getLiveAnchorColour(game: IGame): PlayerColour {
  if (
    game.gameState === GameState.LiveAnalysisFromWhiteTurnWhiteMove
    || game.gameState === GameState.LiveAnalysisFromWhiteTurnBlackMove
    || game.gameState === GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove
    || game.gameState === GameState.PausedLiveAnalysisFromWhiteTurnBlackMove
  ) return PlayerColour.White;
  return PlayerColour.Black;
}
function getSelectedPath(game: IGame): MovePath {
  if (isLiveState(game.gameState) || isPausedLiveState(game.gameState)) return game.livePath ? [...game.livePath] : [];
  return [...game.highlightPath];
}
function getSelectedNode(game: IGame): IMoveNode {
  return getNodeAtPath(game.moveTree, getSelectedPath(game));
}
function getLiveNode(game: IGame): IMoveNode {
  return getNodeAtPath(game.moveTree, game.livePath ?? []);
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
function updateGameStateAfterPosition(game: IGame, positionColour: PlayerColour): void {
  if (game.resultState !== ResultState.Ongoing) {
    game.gameState = game.resultReason === ResultReason.RuleResolved && (game.resultState === ResultState.WhiteWon || game.resultState === ResultState.BlackWon)
      ? GameState.Checkmate
      : getAnalysisState(positionColour);
    return;
  }
  if (isLiveState(game.gameState)) {
    game.gameState = getLiveState(positionColour);
    return;
  }
  if (isPausedLiveState(game.gameState)) {
    game.gameState = getPausedState(positionColour);
    return;
  }
  if (isAnyLiveAnalysisState(game.gameState)) {
    game.gameState = getLiveAnalysisState(getLiveAnchorColour(game), positionColour, isPausedLiveAnalysisState(game.gameState));
    return;
  }
  game.gameState = getAnalysisState(positionColour);
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
  game.metadata.updatedAt = getNowUtc();
}
function hydrateMoveNode(node: IMoveNode, parent?: IMoveNode): IMoveNode {
  const hydratedMove = node.move ? MoveNotationService.decorateMove(parent?.position ?? node.position, node.move) : undefined;
  const hydratedNode: IMoveNode = {
    branchKind: node.branchKind,
    move: hydratedMove,
    position: structuredClone(node.position),
    clockSnapshot: node.clockSnapshot ? structuredClone(node.clockSnapshot) : undefined,
    plyIndex: node.plyIndex,
    mainlineChildIndex: node.mainlineChildIndex,
    children: [],
    $: parent ? { parent } : undefined,
  };
  hydratedNode.children = node.children.map((child) => hydrateMoveNode(child, hydratedNode));
  return hydratedNode;
}
function getNodeAtPath(tree: IGame['moveTree'], path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) {
    const nextNode = currentNode.children[childIndex];
    if (!nextNode) throw new Error('Move path does not exist in the hydrated tree.');
    currentNode = nextNode;
  }
  return currentNode;
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
  return {
    schemaVersion: game.schemaVersion,
    metadata: structuredClone(game.metadata),
    gameState: game.gameState,
    resultState: game.resultState,
    resultReason: game.resultReason,
    drawOfferState: game.drawOfferState ? structuredClone(game.drawOfferState) : undefined,
    whitePlayer: game.whitePlayer ? structuredClone(game.whitePlayer) : undefined,
    blackPlayer: game.blackPlayer ? structuredClone(game.blackPlayer) : undefined,
    moveTree: { root: hydrateMoveNode(game.moveTree.root) },
    rootPosition: structuredClone(game.rootPosition),
    livePath: game.livePath ? [...game.livePath] : undefined,
    highlightPath: [...game.highlightPath],
    timeControl: structuredClone(game.timeControl),
    clockSnapshot: structuredClone(game.clockSnapshot),
    liveAnalysisOptions: structuredClone(game.liveAnalysisOptions),
    gameplayOptions: structuredClone(game.gameplayOptions ?? { allowTakeback: TakebackPolicy.RewriteMainline }),
    analysis: structuredClone(game.analysis),
    $: createGameRuntime(),
  };
}
function getMovesFromPath(game: IGame, path: MovePath): IMove[] {
  const moves: IMove[] = [];
  let currentNode = game.moveTree.root;
  for (const childIndex of path) {
    const nextNode = currentNode.children[childIndex];
    if (!nextNode?.move) throw new Error(`Move path is invalid for game ${game.metadata.id}.`);
    moves.push(nextNode.move);
    currentNode = nextNode;
  }
  return moves;
}
function buildEnginePositionState(game: IGame, path: MovePath = game.highlightPath, previous?: IEnginePositionState): IEnginePositionState {
  const currentNode = getNodeAtPath(game.moveTree, path);
  const movesFromRoot = getMovesFromPath(game, path);
  const requiresNewGameBoundary = !previous
    || JSON.stringify(previous.rootPosition) !== JSON.stringify(game.rootPosition)
    || JSON.stringify(previous.movesFromRoot) !== JSON.stringify(movesFromRoot);
  return {
    rootPosition: game.rootPosition,
    movesFromRoot,
    currentPosition: currentNode.position,
    requiresNewGameBoundary,
  };
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
      id: crypto.randomUUID(),
      updatedAt: getNowUtc(),
    },
  };
}

export const useGamesStore = defineStore('gamesStore', () => {
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
    if (!isPausedState(game.gameState)) return;
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
      case GameState.Checkmate:
        throw new Error(`Move submission is not allowed while gameState is ${game.gameState}.`);
    }
  }
  function _canPauseForReason(game: IGame, reason: PauseReason): boolean {
    if (reason === PauseReason.Analysis) return true;
    return isTimedGame(game) && hasRunningClock(game.clockSnapshot);
  }
  function _canRequestPlayerMove(game: IGame): boolean {
    if (!isLiveState(game.gameState) || game.resultState !== ResultState.Ongoing || !game.livePath) return false;
    const liveNode = getLiveNode(game);
    return isEnginePlayer(getSideToMovePlayer(game, liveNode.position.sideToMove));
  }
  function _clearDeferredPlayerMove(game: IGame): void {
    const runtime = requireGameRuntime(game);
    runtime.deferredPlayerMove = undefined;
  }
  function _clearPendingPlayerTurn(game: IGame): void {
    const runtime = requireGameRuntime(game);
    runtime.pendingPlayerTurnPromise?.reject(new Aborted());
    runtime.pendingPlayerTurnPromise = undefined;
    runtime.pendingPlayerTurnHandlePromise = undefined;
  }
  function _clearPlayerTurnRuntime(game: IGame): void {
    _clearDeferredPlayerMove(game);
    _clearPendingPlayerTurn(game);
  }
  async function _flushDeferredPlayerMove(game: IGame): Promise<IMove | undefined> {
    const runtime = requireGameRuntime(game);
    const deferredPlayerMove = runtime.deferredPlayerMove;
    if (!deferredPlayerMove) return;
    runtime.deferredPlayerMove = undefined;
    if (!isLiveTurnReadyForMove(game)) return;
    const liveNode = getLiveNode(game);
    if (GameRuleService.isMoveLegal(liveNode.position, deferredPlayerMove)) {
      makeMove(game, deferredPlayerMove);
      return deferredPlayerMove;
    }
    if (_canRequestPlayerMove(game)) return _requestPlayerMove(game);
  }
  function _commitResolvedLiveMove(game: IGame, move: IMove): IMove {
    if (!isLiveTurnReadyForMove(game)) return;
    const liveNode = getLiveNode(game);
    if (!GameRuleService.isMoveLegal(liveNode.position, move)) {
      _clearPlayerTurnRuntime(game);
      if (_canRequestPlayerMove(game)) void _requestPlayerMove(game);
      return;
    }
    _commitLiveMove(game, liveNode, move, game.clockSnapshot);
    _refreshRuntimeRegistrations(game);
    void _refreshAnalysisForGame(game);
    return move;
  }
  function _disposeAnalysisSubscription(engine: IAssignedEngine): void {
    const dispose = _analysisDisposers.get(engine);
    if (dispose) dispose();
    _analysisDisposers.delete(engine);
  }
  function _refreshRuntimeRegistrations(game: IGame): void {
    const runtime = requireGameRuntime(game);
    runtime.focusReturnUnsubscribe?.();
    runtime.focusReturnUnsubscribe = undefined;
    if (!isLiveState(game.gameState) || game.resultState !== ResultState.Ongoing || !isTimedGame(game)) return;
    runtime.focusReturnUnsubscribe = PlatformEventService.subscribeToAppFocusReturned('GamesStore', () => syncClock(game, getNowUtc()), `sync-clock-${game.metadata.id}`);
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
      snapshot.updatedAt = getNowUtc();
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
    const positionState = buildEnginePositionState(game, game.highlightPath);
    _subscribeToAnalysis(game, snapshot.assignedEngine);
    snapshot.positionKey = PositionIdentityService.buildPositionKey(positionState.currentPosition);
    snapshot.updatedAt = getNowUtc();
    _resetAnalysisSnapshot(snapshot);
    if (snapshot.assignedEngine.$) snapshot.assignedEngine.$.lastError = undefined;
    await EngineRuntimeService.ensureReady(snapshot.assignedEngine);
    await EngineRuntimeService.syncPosition(snapshot.assignedEngine, positionState);
    await EngineRuntimeService.startAnalysis(snapshot.assignedEngine, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
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
  //#region move committing
  function _finaliseMove(game: IGame, parentNode: IMoveNode, nextMove: IMove, nextClockSnapshot?: IClockSnapshot, asAnalysisMove: boolean = false): IMoveNode {
    const decoratedMove = MoveNotationService.decorateMove(parentNode.position, nextMove);
    const nextPosition = GameRuleService.applyMove(parentNode.position, decoratedMove);
    if (asAnalysisMove) game.moveTree = MoveUpdateService.addAnalysisMove(parentNode, decoratedMove, nextPosition);
    else game.moveTree = MoveUpdateService.addMainlineMove(parentNode, decoratedMove, nextPosition, nextClockSnapshot);
    const nextNode = parentNode.children[parentNode.children.length - 1]!;
    const nextPath = getPathToNode(nextNode);
    game.highlightPath = nextPath;
    if (!asAnalysisMove) {
      game.livePath = nextPath;
      if (nextClockSnapshot) game.clockSnapshot = structuredClone(nextClockSnapshot);
    }
    const resolvedResult = GameRuleService.resolveResult(nextPosition);
    game.resultState = resolvedResult.resultState;
    game.resultReason = resolvedResult.resultReason;
    updateGameStateAfterPosition(game, nextPosition.sideToMove);
    setGameUpdateTimeNow(game);
    return nextNode;
  }
  function _finaliseAnalysisMove(game: IGame, parentNode: IMoveNode, nextMove: IMove): IMoveNode {
    return _finaliseMove(game, parentNode, nextMove, undefined, true);
  }
  function _commitLiveMove(game: IGame, move: IMove) {

  }
  function _commitLiveMove(game: IGame, parentNode: IMoveNode, move: IMove, baseClockSnapshot: IClockSnapshot): void {
    const parentPath = getPathToNode(parentNode);
    if (parentNode.children.length > 0) {
      game.moveTree = MoveUpdateService.pruneFutureMoves(parentNode);
      parentNode = getNodeAtPath(game.moveTree, parentPath);
    }
    const nextClockSnapshot = TimeControlService.applyMove(baseClockSnapshot, move.movingColour, getNowUtc(), game.timeControl);
    _finaliseMove(game, parentNode, move, nextClockSnapshot);
    _clearPlayerTurnRuntime(game);
  }
  function _commitHistoryRewriteMove(game: IGame, parentNode: IMoveNode, move: IMove): void {
    const parentPath = getPathToNode(parentNode);
    const decoratedMove = MoveNotationService.decorateMove(parentNode.position, move);
    const nextPosition = GameRuleService.applyMove(parentNode.position, decoratedMove);
    const baseClockSnapshot = structuredClone(parentNode.clockSnapshot ?? game.clockSnapshot);
    const nextClockSnapshot = TimeControlService.applyMove(baseClockSnapshot, move.movingColour, getNowUtc(), game.timeControl);
    game.moveTree = MoveUpdateService.addAnalysisMove(parentNode, decoratedMove, nextPosition);
    const nextChildIndex = parentNode.children.length - 1;
    const nextNode = parentNode.children[nextChildIndex]!;
    game.moveTree = MoveUpdateService.rewriteMainline(parentNode, nextNode);
    const nextPath = [...parentPath, nextChildIndex];
    game.highlightPath = nextPath;
    game.livePath = nextPath;
    game.clockSnapshot = structuredClone(nextClockSnapshot);
    const resolvedResult = GameRuleService.resolveResult(nextPosition);
    game.resultState = resolvedResult.resultState;
    game.resultReason = resolvedResult.resultReason;
    updateGameStateAfterPosition(game, nextPosition.sideToMove);
    _clearPlayerTurnRuntime(game);
    setGameUpdateTimeNow(game);
  }
  function _commitLiveHistoryAnalysisMove(game: IGame, parentNode: IMoveNode, move: IMove, exitBehaviour: AnalysisBranchExitBehaviour): void {
    const resultState = game.resultState;
    const resultReason = game.resultReason;
    const nextNode = _finaliseAnalysisMove(game, parentNode, move);
    game.resultState = resultState;
    game.resultReason = resultReason;
    const liveNode = getLiveNode(game);
    if (exitBehaviour === AnalysisBranchExitBehaviour.ReturnToLiveNode) {
      game.highlightPath = [...game.livePath!];
      game.gameState = getLiveState(liveNode.position.sideToMove);
      setGameUpdateTimeNow(game);
      return;
    }
    game.highlightPath = getPathToNode(nextNode);
    game.gameState = getLiveAnalysisState(liveNode.position.sideToMove, nextNode.position.sideToMove);
    setGameUpdateTimeNow(game);
  }
  function _replaceWithAnalysisRoot(game: IGame, boardRoot: IGame['rootPosition'], nextState: GameState): void {
    const nextClockSnapshot = TimeControlService.initialiseClockSnapshot(game.timeControl);
    game.rootPosition = structuredClone(boardRoot);
    game.moveTree = MoveUpdateService.replaceBoardRoot(boardRoot, nextClockSnapshot);
    game.highlightPath = [];
    game.livePath = undefined;
    game.clockSnapshot = nextClockSnapshot;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    _clearPlayerTurnRuntime(game);
    game.gameState = nextState;
    setGameUpdateTimeNow(game);
  }
  //#endregion
  //#region states checking
  function _gameStateToMoveColour(game: IGame) {

  }
  function _isOngoingLiveGame(game: IGame): game is LiveGame {
    return game.resultState === ResultState.Ongoing && !!game.livePath;
  }
  /** if clicked on a position in the live path in the past, not a variation */
  function _isLiveHistoryReview(game: LiveGame) {
    return isPathPrefix(game.highlightPath, game.livePath);
  }
  //#endregion
  function _requestPlayerMove(game: IGame) {
    async function _requestEngineMove(game: IGame, engine: IAssignedEngine): Promise<IMove> {
      await EngineRuntimeService.ensureReady(engine);
      await EngineRuntimeService.startPlayerTurn(engine);
      const positionState = buildEnginePositionState(game, game.livePath ?? []);
      await EngineRuntimeService.syncPosition(engine, positionState);
      const move = await EngineRuntimeService.awaitPlayerTurnMove(engine);
      return move;
    }
    async function _playerMoveHandler(game: IGame, pendingPlayerMove: Promise<IMove>) {
      const move = await pendingPlayerMove;
      const runtime = requireGameRuntime(game);
      runtime.pendingPlayerTurnPromise = undefined;
      runtime.pendingPlayerTurnHandlePromise = undefined;
      if (isPausedState(game.gameState)) { runtime.deferredPlayerMove = structuredClone(move); }
      else makeMove(game, move);
    }
    const liveNode = getLiveNode(game);
    const player = getSideToMovePlayer(game, liveNode.position.sideToMove);
    const runtime = requireGameRuntime(game);
    const pendingPlayerMove = isEnginePlayer(player)
      ? new Deferred<IMove>(_requestEngineMove(game, player.assignedEngine))
      : new Deferred<IMove>();
    runtime.pendingPlayerTurnPromise = pendingPlayerMove;
    runtime.pendingPlayerTurnHandlePromise = _playerMoveHandler(game, pendingPlayerMove);
  }
  async function _hydrateAndInsertGame(game: IGame): Promise<IGame> {
    const hydratedGame = hydrateGame(_repairDuplicateGameId(game, _getExistingGameIds()));
    _normalisePlayers(hydratedGame);
    _replaceGame(hydratedGame);
    _refreshRuntimeRegistrations(hydratedGame);
    return hydratedGame;
  }
  async function createGame(request: ICreateGameRequest): Promise<IGame> {
    const nowUtc = getNowUtc();
    const boardRoot = structuredClone(request.boardRoot ?? createInitialBoardPosition());
    const initialClockSnapshot = TimeControlService.initialiseClockSnapshot(request.timeControl);
    const initialState = request.whitePlayer && request.blackPlayer ? getLiveState(boardRoot.sideToMove) : getAnalysisState(boardRoot.sideToMove);
    const livePath: MovePath | undefined = request.whitePlayer && request.blackPlayer ? [] : undefined;
    const initialPositionKey = PositionIdentityService.buildPositionKey(boardRoot);
    const game: IGame = {
      schemaVersion: 1,
      metadata: createGameMetadata(request.name, nowUtc),
      gameState: initialState,
      resultState: ResultState.Ongoing,
      whitePlayer: clonePlayer(request.whitePlayer),
      blackPlayer: clonePlayer(request.blackPlayer),
      rootPosition: boardRoot,
      moveTree: MoveUpdateService.createMoveTree(boardRoot, initialClockSnapshot),
      livePath,
      highlightPath: [],
      timeControl: structuredClone(request.timeControl),
      clockSnapshot: request.whitePlayer && request.blackPlayer ? TimeControlService.startClock(initialClockSnapshot, boardRoot.sideToMove, nowUtc) : initialClockSnapshot,
      liveAnalysisOptions: { showLiveAnalysisMoves: request.showLiveAnalysisMoves },
      analysis: {
        snapshots: request.analysisEngineProfiles.map((engineProfile) => createAnalysisSnapshot(engineProfile, initialPositionKey, nowUtc)),
      },
      gameplayOptions: { allowTakeback: TakebackPolicy.RewriteMainline },
      $: createGameRuntime(),
    };
    const insertedGame = await _hydrateAndInsertGame(game);
    _armPendingPlayerTurn(insertedGame);
    if (insertedGame.analysis.snapshots.length > 0) await _refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  async function startGameFromSetup(game: IGame, request: IStartGameFromSetupRequest): Promise<void> {
    game.metadata.name = request.name ?? game.metadata.name;
    game.whitePlayer = clonePlayer(request.whitePlayer);
    game.blackPlayer = clonePlayer(request.blackPlayer);
    game.timeControl = structuredClone(request.timeControl);
    game.liveAnalysisOptions.showLiveAnalysisMoves = request.showLiveAnalysisMoves;
    game.analysis.snapshots = request.analysisEngineProfiles.map((engineProfile) => createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(getSelectedNode(game).position), getNowUtc()));
    game.clockSnapshot = TimeControlService.initialiseClockSnapshot(game.timeControl);
    _clearPlayerTurnRuntime(game);
    if (game.whitePlayer && game.blackPlayer) {
      game.livePath = [...game.highlightPath];
      game.clockSnapshot = TimeControlService.startClock(game.clockSnapshot, getSelectedNode(game).position.sideToMove, getNowUtc());
      game.resultState = ResultState.Ongoing;
      game.resultReason = undefined;
      game.gameState = getLiveState(getSelectedNode(game).position.sideToMove);
    } else {
      game.livePath = undefined;
      game.gameState = getAnalysisState(getSelectedNode(game).position.sideToMove);
    }
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    _armPendingPlayerTurn(game);
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
  function makeMove(game: IGame, move: IMove): IMove {
    //validating
    _assertMoveAllowed(game);
    const parentNode = getSelectedNode(game);
    if (!GameRuleService.isMoveLegal(parentNode.position, move)) throw new InvalidMove(move);

    function _makeMoveByState(game:IGame, move:IMove) {

      if (_isOngoingLiveGame(game)) {
        if (_isLiveHistoryReview(game)) {
          if (game.gameplayOptions.allowTakeback === TakebackPolicy.RewriteMainline) _commitHistoryRewriteMove(game, parentNode, move);
          else _commitLiveHistoryAnalysisMove(game, parentNode, move, UserSettingService.getSettings().gameplay.analysisBranchExitBehaviour);
          return;
        } else {
          _commitLiveMove(game, move);
        }
      }
      // othewise just move it in analysis mode
      const resultState = game.resultState;
      const resultReason = game.resultReason;
      const nextNode = _finaliseAnalysisMove(game, parentNode, move);
      if (game.livePath && resultState === ResultState.Ongoing) {
        game.resultState = resultState;
        game.resultReason = resultReason;
        game.gameState = getLiveAnalysisState(getLiveNode(game).position.sideToMove, nextNode.position.sideToMove);
        setGameUpdateTimeNow(game);
      }
    }

    if (isLiveTurnReadyForMove(game)) return _commitResolvedLiveMove(game, move);
    else if (_isLiveHistoryReviewMove(game)) {
      if (game.gameplayOptions.allowTakeback === TakebackPolicy.RewriteMainline) _commitHistoryRewriteMove(game, parentNode, move);
      else _commitLiveHistoryAnalysisMove(game, parentNode, move, UserSettingService.getSettings().gameplay.analysisBranchExitBehaviour);
    } else {
      const resultState = game.resultState;
      const resultReason = game.resultReason;
      const nextNode = _finaliseAnalysisMove(game, parentNode, move);
      if (game.livePath && resultState === ResultState.Ongoing) {
        game.resultState = resultState;
        game.resultReason = resultReason;
        game.gameState = getLiveAnalysisState(getLiveNode(game).position.sideToMove, nextNode.position.sideToMove);
        setGameUpdateTimeNow(game);
      }
    }
    _refreshRuntimeRegistrations(game);
    void _refreshAnalysisForGame(game);
    return move;
  }
  async function takeBack(game: IGame, moveCount: number = 1): Promise<void> {
    _assertNotPausedForAction(game, 'Takeback');
    const targetNode = getSelectedNode(game);
    game.moveTree = MoveUpdateService.takeBack(targetNode, moveCount);
    const fallbackNode = targetNode.$?.parent ? getNodeAtPath(game.moveTree, getPathToNode(targetNode.$.parent)) : game.moveTree.root;
    game.highlightPath = getPathToNode(fallbackNode);
    if (game.livePath) game.livePath = game.highlightPath;
    const positionColour = fallbackNode.position.sideToMove;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    _clearPlayerTurnRuntime(game);
    updateGameStateAfterPosition(game, positionColour);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    _armPendingPlayerTurn(game);
    await _refreshAnalysisForGame(game);
  }
  function navigateToNode(game: IGame, node: IMoveNode): void {
    _assertNotPausedForAction(game, 'History navigation');
    if (!isNodeInTree(game.moveTree, node)) return;
    const nextPath = getPathToNode(node);
    const isLiveNode = pathsEqual(nextPath, game.livePath ?? []);
    const liveNode = game.livePath ? getLiveNode(game) : undefined;
    game.highlightPath = nextPath;
    if (isLiveState(game.gameState) && liveNode) {
      game.gameState = isLiveNode ? getLiveState(node.position.sideToMove) : getLiveAnalysisState(liveNode.position.sideToMove, node.position.sideToMove);
      return;
    }
    if (isLiveAnalysisState(game.gameState) && liveNode) {
      game.gameState = isLiveNode ? getLiveState(liveNode.position.sideToMove) : getLiveAnalysisState(liveNode.position.sideToMove, node.position.sideToMove);
      return;
    }
    updateGameStateAfterPosition(game, node.position.sideToMove);
  }
  function getVisibleAnalysis(game: IGame): IVisibleAnalysisSnapshot | undefined {
    const selectedNode = getSelectedNode(game);
    const positionKey = PositionIdentityService.buildPositionKey(selectedNode.position);
    const engineSnapshots = game.analysis.snapshots.filter((snapshot) => snapshot.positionKey === positionKey);
    if (engineSnapshots.length === 0) return;
    return { engineSnapshots: engineSnapshots.map((snapshot) => cloneAnalysisSnapshotForRead(snapshot)) };
  }
  async function syncClock(game: IGame, nowUtc: string): Promise<void> {
    if (!isLiveState(game.gameState) && !isPausedLiveState(game.gameState)) return;
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
    const runtime = requireGameRuntime(game);
    if (!_canPauseForReason(game, reason)) return;
    if (isPausedState(game.gameState)) {
      runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
      return;
    }
    if ((!isLiveState(game.gameState) && !isLiveAnalysisState(game.gameState)) || game.resultState !== ResultState.Ongoing) return;
    runtime.pauseReasons = [...new Set([...(runtime.pauseReasons ?? []), reason])];
    game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, getNowUtc());
    if (isLiveState(game.gameState)) game.gameState = getPausedState(getSelectedNode(game).position.sideToMove);
    else game.gameState = getLiveAnalysisState(getLiveAnchorColour(game), getSelectedNode(game).position.sideToMove, true);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function resumeGame(game: IGame, reason: PauseReason): Promise<void> {
    if (reason !== PauseReason.Analysis && !isTimedGame(game)) return;
    if (!isPausedState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const runtime = requireGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== reason);
    if ((runtime.pauseReasons ?? []).length > 0) return;
    game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, getNowUtc());
    if (isPausedLiveState(game.gameState)) game.gameState = getLiveState(getSelectedNode(game).position.sideToMove);
    else game.gameState = getLiveAnalysisState(getLiveAnchorColour(game), getSelectedNode(game).position.sideToMove);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    if (isLiveState(game.gameState)) await _flushDeferredPlayerMove(game);
  }
  async function reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void> {
    const selectedNode = getSelectedNode(game);
    const liveNode = game.livePath ? getLiveNode(game) : undefined;
    if (colour === PlayerColour.White) game.whitePlayer = clonePlayer(player);
    else game.blackPlayer = clonePlayer(player);
    _clearPlayerTurnRuntime(game);
    if (!game.whitePlayer || !game.blackPlayer) _replaceWithAnalysisRoot(game, selectedNode.position, getAnalysisState(selectedNode.position.sideToMove));
    else {
      if (isPausedLiveState(game.gameState)) game.gameState = getPausedState(selectedNode.position.sideToMove);
      else if (isLiveState(game.gameState)) game.gameState = getLiveState(selectedNode.position.sideToMove);
      else if (isAnyLiveAnalysisState(game.gameState) && liveNode) game.gameState = getLiveAnalysisState(liveNode.position.sideToMove, selectedNode.position.sideToMove, isPausedLiveAnalysisState(game.gameState));
      else if (game.livePath && game.resultState === ResultState.Ongoing) game.gameState = getLiveState(selectedNode.position.sideToMove);
      setGameUpdateTimeNow(game);
    }
    _refreshRuntimeRegistrations(game);
    if (_canRequestPlayerMove(game)) _requestPlayerMove(game);
  }
  async function addAnalysisEngine(game: IGame, engineProfile: IEngineRecord): Promise<void> {
    if (game.analysis.snapshots.some((snapshot) => snapshot.assignedEngine.displayName === engineProfile.displayName)) throw new Error(`Analysis engine already assigned: ${engineProfile.displayName}.`);
    if (game.analysis.snapshots.length >= 4) throw new Error('A game cannot have more than four analysis engines.');
    const snapshot = createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(getSelectedNode(game).position), getNowUtc());
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
    if (isLiveState(game.gameState)) {
      const liveNode = getLiveNode(game);
      await pauseGame(game, PauseReason.Analysis);
      game.highlightPath = getPathToNode(liveNode);
      game.gameState = getLiveAnalysisState(liveNode.position.sideToMove, liveNode.position.sideToMove, true);
      setGameUpdateTimeNow(game);
      return;
    }
    if (game.resultReason !== ResultReason.Timeout || !game.livePath) return;
    const liveNode = getLiveNode(game);
    game.gameState = getLiveAnalysisState(liveNode.position.sideToMove, getSelectedNode(game).position.sideToMove);
    setGameUpdateTimeNow(game);
  }
  function exitInGameAnalysis(game: IGame): void {
    if (!isAnyLiveAnalysisState(game.gameState)) return;
    const liveNode = getLiveNode(game);
    game.highlightPath = getPathToNode(liveNode);
    if (game.resultReason === ResultReason.Timeout && game.resultState !== ResultState.Ongoing) {
      game.gameState = getAnalysisState(getOpponentColour(liveNode.position.sideToMove));
      setGameUpdateTimeNow(game);
      return;
    }
    if (isPausedLiveAnalysisState(game.gameState)) {
      const runtime = requireGameRuntime(game);
      runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== PauseReason.Analysis);
      if ((runtime.pauseReasons ?? []).length > 0) game.gameState = getPausedState(liveNode.position.sideToMove);
      else {
        game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, getNowUtc());
        game.gameState = getLiveState(liveNode.position.sideToMove);
      }
      _refreshRuntimeRegistrations(game);
      _armPendingPlayerTurn(game);
      if (isLiveState(game.gameState)) void _flushDeferredPlayerMove(game);
    } else game.gameState = getLiveState(liveNode.position.sideToMove);
    setGameUpdateTimeNow(game);
  }
  function enterBoardEdit(game: IGame): void {
    _assertNotPausedForAction(game, 'Board edit entry');
    if (game.gameState === GameState.BoardEdit) {
      game.gameState = getAnalysisState(game.rootPosition.sideToMove);
      setGameUpdateTimeNow(game);
      void _refreshAnalysisForGame(game);
      return;
    }
    if (isLiveState(game.gameState) || isPausedState(game.gameState) || isAnyLiveAnalysisState(game.gameState)) return;
    void stopAnalysis(game);
    game.gameState = GameState.BoardEdit;
    setGameUpdateTimeNow(game);
  }
  function applyBoardEdit(game: IGame, boardRoot: IGame['rootPosition']): void {
    if (game.gameState !== GameState.BoardEdit) throw new Error('Board edits are only allowed while board edit mode is active.');
    _replaceWithAnalysisRoot(game, boardRoot, GameState.BoardEdit);
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
    const selectedNode = getSelectedNode(game);
    const offeringColour = selectedNode.position.sideToMove;
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
    game.gameState = getAnalysisState(getSelectedNode(game).position.sideToMove);
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
    resignGame,
    offerDraw,
    acceptDrawOffer,
    declineDrawOffer,
    withdrawDrawOffer,
  };
});
