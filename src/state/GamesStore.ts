import { defineStore } from 'pinia';
import { ref } from 'vue';

import {
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
  type IEnginePositionState,
  type IEngineRecord,
  type IGame,
  type IPlayer,
  type IStartGameFromSetupRequest,
  type IVisibleAnalysisSnapshot,
  type IMove,
  type IMoveNode,
  type MovePath,
} from '@/contracts';
import {
  EngineRuntimeService,
  GameRuleService,
  MoveUpdateService,
  MoveNotationService,
  PlatformEventService,
  PositionIdentityService,
  TimeControlService,
} from '@/domain';
import { createInitialBoardPosition, getOpponentColour } from '@/utility/chess/BoardUtility';
import { logHandledError } from '@/utility/errors';

interface IGameStoreRuntime {
  pauseReasons?: PauseReason[];
  focusReturnUnsubscribe?: () => void;
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
function getGameRuntime(game: IGame): IGameStoreRuntime {
  const runtime = game.$ as IGameStoreRuntime | undefined;
  if (runtime) return runtime;
  const nextRuntime: IGameStoreRuntime = {};
  game.$ = nextRuntime;
  return nextRuntime;
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
function getSideToMovePlayer(game: IGame, positionColour: PlayerColour): IPlayer | undefined {
  return positionColour === PlayerColour.White ? game.whitePlayer : game.blackPlayer;
}
function isEnginePlayer(player?: IPlayer): player is IEnginePlayer {
  return player?.type === PlayerType.Engine;
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
    ...structuredClone(game),
    moveTree: { root: hydrateMoveNode(game.moveTree.root) },
    boardRoot: structuredClone(game.boardRoot),
    livePath: game.livePath ? [...game.livePath] : undefined,
    highlightPath: [...game.highlightPath],
    timeControl: structuredClone(game.timeControl),
    clockSnapshot: structuredClone(game.clockSnapshot),
    analysis: structuredClone(game.analysis),
  };
}
function getMovesFromPath(game: IGame, path: MovePath): IMove[] {
  const moves: IMove[] = [];
  let currentNode = game.moveTree.root;
  for (const childIndex of path) {
    const nextNode = currentNode.children[childIndex];
    if (!nextNode?.move) throw new Error(`Move path is invalid for game ${game.metadata.id}.`);
    moves.push(structuredClone(nextNode.move));
    currentNode = nextNode;
  }
  return moves;
}
function buildEnginePositionState(game: IGame, path: MovePath = game.highlightPath, previous?: IEnginePositionState): IEnginePositionState {
  const currentNode = getNodeAtPath(game.moveTree, path);
  const movesFromRoot = getMovesFromPath(game, path);
  const requiresNewGameBoundary = !previous
    || JSON.stringify(previous.rootPosition) !== JSON.stringify(game.boardRoot)
    || JSON.stringify(previous.movesFromRoot) !== JSON.stringify(movesFromRoot);
  return {
    rootPosition: structuredClone(game.boardRoot),
    movesFromRoot,
    currentPosition: structuredClone(currentNode.position),
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
  function _disposeAnalysisSubscription(engine: IAssignedEngine): void {
    const dispose = _analysisDisposers.get(engine);
    if (dispose) dispose();
    _analysisDisposers.delete(engine);
  }
  function _refreshRuntimeRegistrations(game: IGame): void {
    const runtime = getGameRuntime(game);
    runtime.focusReturnUnsubscribe?.();
    runtime.focusReturnUnsubscribe = undefined;
    if (!isLiveState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
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
  async function _startAnalysisSnapshot(game: IGame, snapshot: IAnalysisSnapshot): Promise<void> {
    const positionState = buildEnginePositionState(game, game.highlightPath);
    _subscribeToAnalysis(game, snapshot.assignedEngine);
    snapshot.positionKey = PositionIdentityService.buildPositionKey(positionState.currentPosition);
    snapshot.updatedAt = getNowUtc();
    snapshot.lines = [];
    snapshot.isComplete = false;
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
        snapshot.isComplete = true;
        snapshot.lines = [];
        if (snapshot.assignedEngine.$) snapshot.assignedEngine.$.lastError = error instanceof Error ? error.message : 'Analysis failed.';
        logHandledError('GamesStore', 'startAnalysis', error);
      }
    }
  }
  function _normalisePlayers(game: IGame): void {
    if (game.whitePlayer) game.whitePlayer.$ = { activityState: PlayerActivityState.Active };
    if (game.blackPlayer) game.blackPlayer.$ = { activityState: PlayerActivityState.Active };
  }
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
      boardRoot,
      moveTree: MoveUpdateService.createMoveTree(boardRoot, initialClockSnapshot),
      livePath,
      highlightPath: [],
      timeControl: structuredClone(request.timeControl),
      clockSnapshot: request.whitePlayer && request.blackPlayer ? TimeControlService.startClock(initialClockSnapshot, boardRoot.sideToMove, nowUtc) : initialClockSnapshot,
      liveAnalysisOptions: { showLiveAnalysisMoves: request.showLiveAnalysisMoves },
      analysis: {
        snapshots: request.analysisEngineProfiles.map((engineProfile) => createAnalysisSnapshot(engineProfile, initialPositionKey, nowUtc)),
      },
    };
    const insertedGame = await _hydrateAndInsertGame(game);
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
    await _refreshAnalysisForGame(game);
  }
  async function insertGame(game: IGame): Promise<IGame> {
    return _hydrateAndInsertGame(game);
  }
  function getGame(gameId: string): IGame | undefined {
    return _games.value.find((game) => game.metadata.id === gameId);
  }
  function listGames(): IGame[] {
    return _games.value;
  }
  async function makeMove(game: IGame, move: IMove): Promise<IMove | undefined> {
    _assertMoveAllowed(game);
    const parentNode = getSelectedNode(game);
    if (!GameRuleService.isMoveLegal(parentNode.position, move)) return;
    const wasLiveState = isLiveState(game.gameState);
    const shouldCommitLiveMove = isLiveState(game.gameState) && JSON.stringify(game.highlightPath) === JSON.stringify(game.livePath ?? []);
    const nextClockSnapshot = shouldCommitLiveMove ? TimeControlService.applyMove(game.clockSnapshot, move.movingColour, getNowUtc(), game.timeControl) : undefined;
    _finaliseMove(game, parentNode, move, nextClockSnapshot, !shouldCommitLiveMove);
    if (!shouldCommitLiveMove && wasLiveState) game.gameState = getLiveAnalysisState(move.movingColour, getSelectedNode(game).position.sideToMove);
    _refreshRuntimeRegistrations(game);
    await _refreshAnalysisForGame(game);
    return move;
  }
  async function takeBack(game: IGame, moveCount: number = 1): Promise<void> {
    const targetNode = getSelectedNode(game);
    game.moveTree = MoveUpdateService.takeBack(targetNode, moveCount);
    const fallbackNode = targetNode.$?.parent ? getNodeAtPath(game.moveTree, getPathToNode(targetNode.$.parent)) : game.moveTree.root;
    game.highlightPath = getPathToNode(fallbackNode);
    if (game.livePath) game.livePath = game.highlightPath;
    const positionColour = fallbackNode.position.sideToMove;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    updateGameStateAfterPosition(game, positionColour);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
    await _refreshAnalysisForGame(game);
  }
  function navigateToNode(game: IGame, node: IMoveNode): void {
    if (!isNodeInTree(game.moveTree, node)) return;
    game.highlightPath = getPathToNode(node);
    if (isLiveState(game.gameState) || isPausedState(game.gameState)) return;
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
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function pauseGame(game: IGame, reason: PauseReason): Promise<void> {
    const runtime = getGameRuntime(game);
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
    if (!isPausedState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const runtime = getGameRuntime(game);
    runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== reason);
    if ((runtime.pauseReasons ?? []).length > 0) return;
    game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, getNowUtc());
    if (isPausedLiveState(game.gameState)) game.gameState = getLiveState(getSelectedNode(game).position.sideToMove);
    else game.gameState = getLiveAnalysisState(getLiveAnchorColour(game), getSelectedNode(game).position.sideToMove);
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void> {
    if (colour === PlayerColour.White) game.whitePlayer = clonePlayer(player);
    else game.blackPlayer = clonePlayer(player);
    const selectedNode = getSelectedNode(game);
    if (game.whitePlayer && game.blackPlayer && !isAnalysisState(game.gameState)) game.gameState = getLiveState(selectedNode.position.sideToMove);
    else if (!game.whitePlayer || !game.blackPlayer) {
      game.livePath = undefined;
      game.gameState = getAnalysisState(selectedNode.position.sideToMove);
    }
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
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
    await _refreshAnalysisForGame(game);
  }
  async function retryAnalysis(game: IGame, engineIndex: number): Promise<void> {
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
      snapshot.isComplete = true;
    }
  }
  async function requestPlayerMove(game: IGame): Promise<IMove | undefined> {
    if (!isLiveState(game.gameState) || game.resultState !== ResultState.Ongoing) return;
    const liveNode = getLiveNode(game);
    const player = getSideToMovePlayer(game, liveNode.position.sideToMove);
    if (!isEnginePlayer(player)) return;
    const engine = player.assignedEngine;
    const positionState = buildEnginePositionState(game, game.livePath ?? []);
    await EngineRuntimeService.ensureReady(engine);
    await EngineRuntimeService.syncPosition(engine, positionState);
    await EngineRuntimeService.startPlayerTurn(engine);
    const move = await EngineRuntimeService.awaitPlayerTurnMove(engine);
    await makeMove(game, move);
    return move;
  }
  async function enterInGameAnalysis(game: IGame): Promise<void> {
    if (!isLiveState(game.gameState)) return;
    const liveNode = getLiveNode(game);
    await pauseGame(game, PauseReason.Analysis);
    game.highlightPath = getPathToNode(liveNode);
    game.gameState = getLiveAnalysisState(liveNode.position.sideToMove, liveNode.position.sideToMove, true);
    setGameUpdateTimeNow(game);
  }
  function exitInGameAnalysis(game: IGame): void {
    if (!isAnyLiveAnalysisState(game.gameState)) return;
    const liveNode = getLiveNode(game);
    game.highlightPath = getPathToNode(liveNode);
    if (isPausedLiveAnalysisState(game.gameState)) {
      const runtime = getGameRuntime(game);
      runtime.pauseReasons = (runtime.pauseReasons ?? []).filter((candidate) => candidate !== PauseReason.Analysis);
      if ((runtime.pauseReasons ?? []).length > 0) game.gameState = getPausedState(liveNode.position.sideToMove);
      else {
        game.clockSnapshot = TimeControlService.resumeClock(game.clockSnapshot, getNowUtc());
        game.gameState = getLiveState(liveNode.position.sideToMove);
      }
      _refreshRuntimeRegistrations(game);
    } else game.gameState = getLiveState(liveNode.position.sideToMove);
    setGameUpdateTimeNow(game);
  }
  function enterBoardEdit(game: IGame): void {
    if (isLiveState(game.gameState) || isPausedState(game.gameState) || isAnyLiveAnalysisState(game.gameState)) return;
    game.gameState = GameState.BoardEdit;
    setGameUpdateTimeNow(game);
  }
  async function confirmBoardEdit(game: IGame, boardRoot: IGame['boardRoot']): Promise<void> {
    const nextClockSnapshot = TimeControlService.initialiseClockSnapshot(game.timeControl);
    game.boardRoot = structuredClone(boardRoot);
    game.moveTree = MoveUpdateService.replaceBoardRoot(boardRoot, nextClockSnapshot);
    game.highlightPath = [];
    game.livePath = undefined;
    game.clockSnapshot = nextClockSnapshot;
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.gameState = getAnalysisState(boardRoot.sideToMove);
    setGameUpdateTimeNow(game);
    await _refreshAnalysisForGame(game);
  }
  async function resignGame(game: IGame, colour: PlayerColour): Promise<void> {
    game.resultState = colour === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon;
    game.resultReason = ResultReason.Resignation;
    game.gameState = getAnalysisState(getOpponentColour(colour));
    game.drawOfferState = undefined;
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function offerDraw(game: IGame): Promise<void> {
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
    if (!game.drawOfferState) return;
    game.resultState = ResultState.Drawn;
    game.resultReason = ResultReason.DrawAgreement;
    game.gameState = getAnalysisState(getSelectedNode(game).position.sideToMove);
    game.drawOfferState = undefined;
    setGameUpdateTimeNow(game);
    _refreshRuntimeRegistrations(game);
  }
  async function declineDrawOffer(game: IGame): Promise<void> {
    game.drawOfferState = undefined;
    setGameUpdateTimeNow(game);
  }
  async function withdrawDrawOffer(game: IGame): Promise<void> {
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
    requestPlayerMove,
    enterInGameAnalysis,
    exitInGameAnalysis,
    enterBoardEdit,
    confirmBoardEdit,
    resignGame,
    offerDraw,
    acceptDrawOffer,
    declineDrawOffer,
    withdrawDrawOffer,
  };
});
