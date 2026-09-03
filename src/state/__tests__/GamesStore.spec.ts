import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CheckState,
  AnalysisBranchExitBehaviour,
  DrawOfferDirection,
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  GameState,
  MoveNodeKind,
  PauseReason,
  PieceKind,
  PlayerActivityState,
  PlayerColour,
  PlayerType,
  ResultReason,
  ResultState,
  TimeControlPreset,
  type IAssignedEngine,
  type IClockSnapshot,
  type IEngineAnalysisUpdate,
  type IEnginePlayer,
  type IEngineRecord,
  type IChessPiece,
  type IGame,
  type IMove,
  type IMoveNode,
  type IMoveTree,
  type MovePath,
} from '@/contracts';

import {
  appendChild,
  createAssignedEngine,
  createBoardPosition,
  createEngineRecord,
  createMove,
  createMoveTree,
  createSettingsSnapshot,
  emitAnalysisUpdate,
  randomDelay,
  resolveWithRandomDelay,
  stripRuntimeMetadata,
} from './StateStoreTestUtility';
import { ClockTimestamp } from '@/utility/date';

let useGamesStore: typeof import('..').useGamesStore;
let settingsSnapshot = createSettingsSnapshot();
let storedGamesByPath = new Map<string, IGame>();
let analysisSubscriptions = new Map<IAssignedEngine, (update: IEngineAnalysisUpdate) => void>();
let nextPlayerMove = createMove(PlayerColour.White);
let queuedEngineMovesByName = new Map<string, IMove[]>();
let createdGameIds: Array<ReturnType<Crypto['randomUUID']>> = [];
const unsubscribeMock = vi.fn();
type ITestBoardPosition = IGame['rootPosition'] & { _testMoveHistory?: string[]; }
type IResolvedResult = { resultState: ResultState; resultReason: ResultReason | undefined; }
const scholarMateMoves = {
  white: [
    createMove(PlayerColour.White, 12, 28),
    createMove(PlayerColour.White, 5, 26),
    createMove(PlayerColour.White, 3, 39),
    createMove(PlayerColour.White, 39, 53),
  ],
  black: [
    createMove(PlayerColour.Black, 52, 36),
    createMove(PlayerColour.Black, 57, 42),
    createMove(PlayerColour.Black, 62, 45),
  ],
};
const scholarMateSequence = [...scholarMateMoves.white.slice(0, 1), scholarMateMoves.black[0]!, scholarMateMoves.white[1]!, scholarMateMoves.black[1]!, scholarMateMoves.white[2]!, scholarMateMoves.black[2]!, scholarMateMoves.white[3]!];

function createResolvedAfterDelay<T>(value: T, waitMs: number = 8): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), waitMs));
}
function getMoveKey(move: IMove): string {
  return `${move.movingColour}:${move.from}-${move.to}:${move.kind}:${move.promotionPiece ?? 'none'}`;
}
function isSameMove(left: IMove, right: IMove): boolean {
  return getMoveKey(left) === getMoveKey(right);
}
function queueEngineMoves(displayName: string, moves: readonly IMove[]): void {
  queuedEngineMovesByName.set(displayName, moves.map((move) => structuredClone(move)));
}
function dequeueEngineMove(engine: IAssignedEngine): IMove {
  const queuedMoves = queuedEngineMovesByName.get(engine.displayName);
  if (queuedMoves?.length) {
    const nextMove = queuedMoves.shift()!;
    if (queuedMoves.length === 0) queuedEngineMovesByName.delete(engine.displayName);
    return nextMove;
  }
  return structuredClone(nextPlayerMove);
}
function applyDefaultMove(position: IGame['rootPosition'], move: IMove): IGame['rootPosition'] {
  const incrementsFullMove = position.sideToMove === PlayerColour.Black;
  position.sideToMove = move.movingColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
  position.halfMoveClock += 1;
  if (incrementsFullMove) position.fullMoveNumber += 1;
  return position;
}
function createOngoingResult(): IResolvedResult {
  return { resultState: ResultState.Ongoing, resultReason: undefined };
}
function isLegalMove(_position: IGame['rootPosition'], _move: IMove): boolean {
  return true;
}
function createScholarMatePosition(): ITestBoardPosition {
  const position = createBoardPosition(PlayerColour.White) as ITestBoardPosition;
  position.board[3] = { kind: PieceKind.Queen, colour: PlayerColour.White };
  position.board[4] = { kind: PieceKind.King, colour: PlayerColour.White };
  position.board[5] = { kind: PieceKind.Bishop, colour: PlayerColour.White };
  position.board[12] = { kind: PieceKind.Pawn, colour: PlayerColour.White };
  position.board[52] = { kind: PieceKind.Pawn, colour: PlayerColour.Black };
  position.board[53] = { kind: PieceKind.Pawn, colour: PlayerColour.Black };
  position.board[57] = { kind: PieceKind.Knight, colour: PlayerColour.Black };
  position.board[60] = { kind: PieceKind.King, colour: PlayerColour.Black };
  position.board[62] = { kind: PieceKind.Knight, colour: PlayerColour.Black };
  position._testMoveHistory = [];
  return position;
}
function getTestMoveHistory(position: IGame['rootPosition']): string[] {
  return [...((position as ITestBoardPosition)._testMoveHistory ?? [])];
}
function applyScholarMateMove(position: IGame['rootPosition'], move: IMove): IGame['rootPosition'] {
  const testPosition = position as ITestBoardPosition;
  const incrementsFullMove = position.sideToMove === PlayerColour.Black;
  testPosition.board[move.to] = testPosition.board[move.from];
  testPosition.board[move.from] = undefined;
  testPosition.sideToMove = move.movingColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
  testPosition.halfMoveClock += 1;
  if (incrementsFullMove) testPosition.fullMoveNumber += 1;
  testPosition._testMoveHistory = [...getTestMoveHistory(position), getMoveKey(move)];
  if (isSameMove(move, scholarMateMoves.white[3]!)) (testPosition.$ ??= {}).checkState = CheckState.Checkmate;
  return testPosition;
}
function installScholarMateRules(): void {
  utility.createInitialBoardPosition.mockImplementation(() => createScholarMatePosition());
  utility.genLegalMoves.mockImplementation((position: IGame['rootPosition']) => {
    const expectedMove = scholarMateSequence[getTestMoveHistory(position).length];
    return expectedMove ? [structuredClone(expectedMove)] : [];
  });
  utility.isMoveLegal.mockImplementation((position: IGame['rootPosition'], move: IMove) => {
    const expectedMove = scholarMateSequence[getTestMoveHistory(position).length];
    return !!expectedMove && isSameMove(expectedMove, move);
  });
  domain.MoveApplicationService.applyMove.mockImplementation((position: IGame['rootPosition'], move: IMove) => applyScholarMateMove(position, move));
  utility.resolveGameResult.mockImplementation((position: IGame['rootPosition']): IResolvedResult => {
    if (position.$?.checkState === CheckState.Checkmate) return { resultState: ResultState.WhiteWon, resultReason: ResultReason.RuleResolved };
    return createOngoingResult();
  });
}
async function awaitPendingPlayerTurn(game: IGame): Promise<void> {
  const pendingPlayerTurn = game.$?.pendingPlayerTurnHandlePromise;
  if (pendingPlayerTurn) await pendingPlayerTurn;
}
async function playEngineOnlyGame(game: IGame, maxTurns: number = scholarMateSequence.length): Promise<void> {
  for (let turnIndex = 0; turnIndex < maxTurns && game.resultState === ResultState.Ongoing; turnIndex += 1) await awaitPendingPlayerTurn(game);
}
function expectScholarMateFinished(game: IGame): void {
  expect(game.resultState).toBe(ResultState.WhiteWon);
  expect(game.resultReason).toBe(ResultReason.RuleResolved);
  expect(game.gameState).toBe(GameState.AnalysisBlackMove);
  expect(game.livePath).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect(game.renderedPath).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect(game.$?.pendingPlayerTurnPromise).toBeUndefined();
  expect(game.$?.pendingPlayerTurnHandlePromise).toBeUndefined();
}
const domain = {
  EngineRuntimeService: {
    ensureReady: vi.fn(async (engine: IAssignedEngine) => {
      engine.$ = engine.$ ?? { availability: EngineAvailability.Unavailable, analysisLines: new Map() };
      engine.$.availability = EngineAvailability.Ready;
      await randomDelay();
    }),
    startAnalysis: vi.fn(async (engine: IAssignedEngine, _game: IGame, request: { multiPv: number; searchMode: EngineAnalysisSearchMode }) => {
      engine.$ = engine.$ ?? { availability: EngineAvailability.Unavailable, analysisLines: new Map() };
      engine.$.availability = EngineAvailability.Running;
      engine.$.lastError = request.searchMode;
      await randomDelay();
    }),
    stopAnalysis: vi.fn(async (engine: IAssignedEngine) => {
      if (engine.$) engine.$.availability = EngineAvailability.Ready;
      await randomDelay();
    }),
    subscribeToAnalysis: vi.fn((engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void) => {
      analysisSubscriptions.set(engine, onUpdate);
      return () => {
        analysisSubscriptions.delete(engine);
        unsubscribeMock();
      };
    }),
    startPlayerTurn: vi.fn(async (engine: IAssignedEngine, game: IGame, attemptPlayerMove: (move: IMove) => Promise<void>) => {
      if (engine.$) engine.$.availability = EngineAvailability.Running;
      await randomDelay();
      const move = await domain.EngineRuntimeService.awaitPlayerTurnMove(engine, game.$!.livePosition!);
      const ponderMove = move.$?.ponderMove;
      const pondering = ponderMove && game.resultState === ResultState.Ongoing
        ? domain.EngineRuntimeService.startPondering(engine, game, move, ponderMove)
        : undefined;
      await attemptPlayerMove(move);
      await pondering;
    }),
    startPondering: vi.fn(async (engine: IAssignedEngine, _game: IGame, _engineMove: IMove, _ponderMove: IMove) => {
      if (engine.$) engine.$.availability = EngineAvailability.Ready;
      await randomDelay();
    }),
    awaitPlayerTurnMove: vi.fn(async (engine: IAssignedEngine, _searchedPosition: IGame['rootPosition']) => {
      if (engine.$) engine.$.availability = EngineAvailability.Ready;
      return createResolvedAfterDelay(dequeueEngineMove(engine));
    }),
    stopEngine: vi.fn(async (engine: IAssignedEngine) => {
      if (engine.$) engine.$.availability = EngineAvailability.Unavailable;
      await randomDelay();
    }),
  },
  MoveApplicationService: {
    applyMove: vi.fn((position: IGame['rootPosition'], move: IMove) => applyDefaultMove(position, move)),
    genPosition: vi.fn((rootPosition: IGame['rootPosition'], moves: readonly IMove[]) =>
      moves.reduce((position, move) => domain.MoveApplicationService.applyMove(position, move), structuredClone(rootPosition))),
    clearBoard: vi.fn((position: IGame['rootPosition']) => {
      if (position.board.every((piece) => piece === undefined)) return false;
      position.board.fill(undefined);
      position.$ = undefined;
      return true;
    }),
    deletePiece: vi.fn((position: IGame['rootPosition'], boardId: number) => {
      if (position.board[boardId] === undefined) return false;
      position.board[boardId] = undefined;
      position.$ = undefined;
      return true;
    }),
    movePiece: vi.fn((position: IGame['rootPosition'], from: number, to: number) => {
      const piece = position.board[from];
      if (piece === undefined || from === to) return false;
      position.board[from] = undefined;
      position.board[to] = piece;
      position.$ = undefined;
      return true;
    }),
    togglePiece: vi.fn((position: IGame['rootPosition'], boardId: number, piece: IChessPiece) => {
      const currentPiece = position.board[boardId];
      position.board[boardId] = currentPiece?.kind === piece.kind && currentPiece.colour === piece.colour ? undefined : piece;
      position.$ = undefined;
      return true;
    }),
  },
  MoveHistoryService: {
    createMoveTree: vi.fn((clockSnapshot?: IClockSnapshot) => createMoveTree(clockSnapshot)),
    addMainlineMove: vi.fn((parentNode: IMoveNode, move: IMove, clockSnapshot?: IClockSnapshot) => {
      return appendChild(parentNode, move, MoveNodeKind.Live, clockSnapshot);
    }),
    addAnalysisMove: vi.fn((parentNode: IMoveNode, move: IMove) => {
      return appendChild(parentNode, move, MoveNodeKind.Analysis);
    }),
    getMoveSequence: vi.fn((tree: IMoveTree, toPath: MovePath) => {
      const moves: IMove[] = [];
      let node = tree.root;
      for (const childIndex of toPath) {
        node = node.children[childIndex]!;
        moves.push(node.move!);
      }
      return moves;
    }),
    rewriteMainline: vi.fn((parentNode: IMoveNode, childNode: IMoveNode) => {
      const childIndex = parentNode.children.indexOf(childNode);
      if (childIndex >= 0) parentNode.mainlineChildIndex = childIndex;
      parentNode.children.forEach((candidate) => {
        candidate.kind = MoveNodeKind.Live;
      });
    }),
    pruneFutureMoves: vi.fn((node: IMoveNode) => {
      node.children.forEach((child) => child.$ = undefined);
      node.children.length = 0;
      node.mainlineChildIndex = undefined;
    }),
    takeBack: vi.fn((targetNode: IMoveNode, moveCount: number) => {
      let retainedNode = targetNode;
      for (let index = 0; index < moveCount && retainedNode.$?.parent; index += 1) retainedNode = retainedNode.$.parent;
      retainedNode.children.forEach((child) => child.$ = undefined);
      retainedNode.children.length = 0;
      retainedNode.mainlineChildIndex = undefined;
      return retainedNode;
    }),
  },
  PlatformEventService: {
    subscribeToAppCloseRequested: vi.fn(() => () => unsubscribeMock()),
    subscribeToAppFocusReturned: vi.fn(() => () => unsubscribeMock()),
  },
  PositionIdentityService: {
    buildPositionKey: vi.fn((position: IGame['rootPosition']) => `position:${position.sideToMove}:${position.fullMoveNumber}:${position.halfMoveClock}`),
  },
  SavedGameIndexService: {
    getAutosaveFilePath: vi.fn((rootPath: string, gameId: string) => `${rootPath}/${gameId}/auto.json`),
    getNamedSaveFilePath: vi.fn((rootPath: string, gameId: string, saveName: string) => `${rootPath}/${gameId}/${saveName}.json`),
    projectSaveGroups: vi.fn((_rootPath: string, entriesByDirectory: ReadonlyMap<string, { path: string; name: string; isDirectory: boolean; lastModifiedUtc?: string }[]>) => {
      const rootEntries = entriesByDirectory.get('saves') ?? [];
      return rootEntries.filter((entry) => entry.isDirectory).map((entry) => ({
        gameId: entry.name,
        gameFolderPath: entry.path,
        saves: (entriesByDirectory.get(entry.path) ?? []).filter((candidate) => !candidate.isDirectory).map((candidate) => ({
          gameId: entry.name,
          saveName: candidate.name.replace(/\.json$/i, ''),
          filePath: candidate.path,
          savedAtUtc: candidate.lastModifiedUtc,
          isAutosave: candidate.name === 'auto.json',
        })),
      }));
    }),
    getLatestSaveEntryForGame: vi.fn((groups, gameId: string) => groups.find((group: { gameId: string; saves: Array<{ filePath: string }> }) => group.gameId === gameId)?.saves[0]),
  },
  SerializationService: {
    writeGameDocument: vi.fn(async (filePath: string, game: IGame) => {
      storedGamesByPath.set(filePath, stripRuntimeMetadata(game));
      await randomDelay();
    }),
    readGameDocument: vi.fn(async (filePath: string) => {
      const game = storedGamesByPath.get(filePath);
      if (!game) throw new Error(`Missing test game document: ${filePath}.`);
      return resolveWithRandomDelay(game);
    }),
    listManagedSaveEntries: vi.fn(async () => {
      const entriesByDirectory = new Map<string, Array<{ path: string; name: string; isDirectory: boolean; lastModifiedUtc?: string }>>();
      const rootEntries: Array<{ path: string; name: string; isDirectory: boolean; lastModifiedUtc?: string }> = [];
      for (const filePath of storedGamesByPath.keys()) {
        const segments = filePath.split('/');
        const gameId = segments[1]!;
        const gameFolderPath = `saves/${gameId}`;
        if (!entriesByDirectory.has(gameFolderPath)) {
          rootEntries.push({ path: gameFolderPath, name: gameId, isDirectory: true });
          entriesByDirectory.set(gameFolderPath, []);
        }
        entriesByDirectory.get(gameFolderPath)!.push({
          path: filePath,
          name: segments[2]!,
          isDirectory: false,
          lastModifiedUtc: '2026-04-17T12:00:00.000Z',
        });
      }
      entriesByDirectory.set('saves', rootEntries);
      return entriesByDirectory;
    }),
  },
  TimeControlService: {
    initialiseClockSnapshot: vi.fn((timeControl: IGame['timeControl']) => {
      const remainingMs = timeControl.initialMs ?? 300000;
      return {
        white: { remainingMs, isRunning: false },
        black: { remainingMs, isRunning: false },
      } satisfies IClockSnapshot;
    }),
    startClock: vi.fn((clockSnapshot: IClockSnapshot, colour: PlayerColour, nowUtc: ClockTimestamp) => ({
      ...structuredClone(clockSnapshot),
      activeColour: colour,
      startedAtUtc: nowUtc,
      white: { ...structuredClone(clockSnapshot.white), isRunning: colour === PlayerColour.White },
      black: { ...structuredClone(clockSnapshot.black), isRunning: colour === PlayerColour.Black },
    })),
    applyMove: vi.fn((clockSnapshot: IClockSnapshot, movingColour: PlayerColour, nowUtc: ClockTimestamp) => ({
      ...structuredClone(clockSnapshot),
      activeColour: movingColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White,
      lastMoveAtUtc: nowUtc,
      white: { ...structuredClone(clockSnapshot.white), isRunning: movingColour !== PlayerColour.White },
      black: { ...structuredClone(clockSnapshot.black), isRunning: movingColour !== PlayerColour.Black },
    })),
    pauseClock: vi.fn((clockSnapshot: IClockSnapshot, nowUtc: ClockTimestamp) => ({
      ...structuredClone(clockSnapshot),
      pausedAtUtc: nowUtc,
      white: { ...structuredClone(clockSnapshot.white), isRunning: false },
      black: { ...structuredClone(clockSnapshot.black), isRunning: false },
    })),
    resumeClock: vi.fn((clockSnapshot: IClockSnapshot, nowUtc: ClockTimestamp) => ({
      ...structuredClone(clockSnapshot),
      startedAtUtc: nowUtc,
      pausedAtUtc: undefined,
      white: { ...structuredClone(clockSnapshot.white), isRunning: clockSnapshot.activeColour === PlayerColour.White },
      black: { ...structuredClone(clockSnapshot.black), isRunning: clockSnapshot.activeColour === PlayerColour.Black },
    })),
    hasExpired: vi.fn(() => false),
    getRemainingTime: vi.fn((clockSnapshot: IClockSnapshot) => ({
      white: clockSnapshot.white.remainingMs,
      black: clockSnapshot.black.remainingMs,
    })),
  },
  UserSettingService: {
    getSettingsOrDefault: vi.fn(() => resolveWithRandomDelay(settingsSnapshot)),
    getSettings: vi.fn(() => structuredClone(settingsSnapshot)),
  },
};
// @/utility/chess exports free functions, so the module mock is flat. The store reaches
// getOpponentColour and isBoardId by deep path, so they are unaffected by this barrel mock.
const utility = {
  createInitialBoardPosition: vi.fn(() => createBoardPosition()),
  genLegalMoves: vi.fn((position: IGame['rootPosition']) => [createMove(position.sideToMove)]),
  toDetailedMove: vi.fn((_position: IGame['rootPosition'], move: IMove) => structuredClone(move)),
  isMoveLegal: vi.fn((position: IGame['rootPosition'], move: IMove) => isLegalMove(position, move)),
  resolveGameResult: vi.fn((_position: IGame['rootPosition']): IResolvedResult => createOngoingResult()),
  getSan: vi.fn((move: IMove) => ((move.$ ??= {}).san ??= `${move.from}-${move.to}`)),
  getUci: vi.fn((move: IMove) => ((move.$ ??= {}).uci ??= `${move.from}-${move.to}`)),
};

function createLocalPlayer(colour: PlayerColour, displayName: string) {
  return {
    colour,
    type: PlayerType.Local,
    displayName,
    $: { activityState: PlayerActivityState.Active },
  };
}
function createEnginePlayer(colour: PlayerColour, displayName: string, engine: IEngineRecord = createEngineRecord(`${colour}-engine`, displayName)): IEnginePlayer {
  return {
    colour,
    type: PlayerType.Engine,
    displayName,
    assignedEngine: createAssignedEngine(engine),
    $: { activityState: PlayerActivityState.Active },
  };
}

describe('useGamesStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    settingsSnapshot = createSettingsSnapshot();
    storedGamesByPath = new Map();
    analysisSubscriptions = new Map();
    nextPlayerMove = createMove(PlayerColour.White);
    queuedEngineMovesByName = new Map();
    createdGameIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000006',
    ];
    unsubscribeMock.mockClear();
    Object.values(domain).forEach((service) => Object.values(service).forEach((mock) => mock.mockClear()));
    Object.values(utility).forEach((mock) => mock.mockClear());
    utility.createInitialBoardPosition.mockReset();
    utility.genLegalMoves.mockReset();
    utility.toDetailedMove.mockReset();
    utility.isMoveLegal.mockReset();
    utility.resolveGameResult.mockReset();
    domain.MoveApplicationService.applyMove.mockReset();
    utility.createInitialBoardPosition.mockImplementation(() => createBoardPosition());
    utility.genLegalMoves.mockImplementation((position: IGame['rootPosition']) => [createMove(position.sideToMove)]);
    utility.toDetailedMove.mockImplementation((_position: IGame['rootPosition'], move: IMove) => structuredClone(move));
    utility.isMoveLegal.mockImplementation((position: IGame['rootPosition'], move: IMove) => isLegalMove(position, move));
    domain.MoveApplicationService.applyMove.mockImplementation((position: IGame['rootPosition'], move: IMove) => applyDefaultMove(position, move));
    utility.resolveGameResult.mockImplementation((_position: IGame['rootPosition']): IResolvedResult => createOngoingResult());
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => createdGameIds.shift() ?? 'game-fallback-0000-0000-000000000000');
    vi.doMock('@/domain', () => domain);
    vi.doMock('@/utility/chess', () => utility);
    ({ useGamesStore } = await import('..'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates, inserts, and mutates live games through mocked domain services', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Workspace Game',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const move = createMove(PlayerColour.White);

    const pendingDeferred = game.$!.pendingPlayerTurnPromise!;
    const resolvePendingMove = vi.spyOn(pendingDeferred, 'resolve');
    const pendingMove = game.$?.pendingPlayerTurnHandlePromise;
    await store.makeMove(game, move);
    await pendingMove;
    expect(resolvePendingMove).toHaveBeenCalledOnce();
    expect(resolvePendingMove).toHaveBeenCalledWith(move);
    expect(game.livePath).toEqual([0]);
    expect(game.renderedPath).toEqual([0]);
    expect(game.gameState).toBe(GameState.LiveBlackTurn);

    await store.pauseGame(game, PauseReason.Manual);
    expect(game.gameState).toBe(GameState.PausedBlackTurn);
    await store.resumeGame(game, PauseReason.Manual);
    expect(game.gameState).toBe(GameState.LiveBlackTurn);

    await store.offerDraw(game);
    expect(game.drawOfferState).toEqual({
      offeringColour: PlayerColour.Black,
      respondingColour: PlayerColour.White,
      direction: DrawOfferDirection.Outgoing,
    });
    await store.withdrawDrawOffer(game);
    expect(game.drawOfferState).toBeUndefined();

    const insertedPayload = stripRuntimeMetadata(game);
    insertedPayload.metadata.id = game.metadata.id;
    const inserted = await store.insertGame(insertedPayload);
    void game.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.takeBack(game, 1);

    expect(inserted.metadata.id).not.toBe(game.metadata.id);
    expect(store.listGames()).toHaveLength(2);
    expect(game.livePath).toEqual([]);
    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(domain.PlatformEventService.subscribeToAppCloseRequested).not.toHaveBeenCalled();
  });
  it('retains time-control ownership and snapshots players only when assigning them to a game', async () => {
    const store = useGamesStore();
    const timeControl = { preset: TimeControlPreset.Untimed, incrementMs: 0 };
    const whitePlayer = createLocalPlayer(PlayerColour.White, 'White');
    const game = await store.createGame({
      name: 'Owned Inputs',
      whitePlayer,
      blackPlayer: undefined,
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl,
    });

    expect(game.timeControl).toBe(timeControl);
    expect(game.whitePlayer).not.toBe(whitePlayer);
    expect(game.whitePlayer).toMatchObject({ colour: PlayerColour.White, displayName: 'White' });
    const setupTimeControl = { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 };
    const blackPlayer = createLocalPlayer(PlayerColour.Black, 'Black');
    await store.startGameFromSetup(game, {
      blackPlayer,
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: setupTimeControl,
    });
    expect(game.timeControl).toBe(setupTimeControl);
    expect(game.blackPlayer).not.toBe(blackPlayer);
  });
  it('aliases rendered and live positions while committing a move at the live node', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Aliased Live Position',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const sharedPosition = game.$!.livePosition!;
    expect(game.$!.renderedPosition).toBe(sharedPosition);

    const pendingMove = game.$!.pendingPlayerTurnHandlePromise;
    store.makeMove(game, createMove(PlayerColour.White));
    await pendingMove;

    expect(game.$!.livePosition).toBe(sharedPosition);
    expect(game.$!.renderedPosition).toBe(sharedPosition);
    expect(sharedPosition.sideToMove).toBe(PlayerColour.Black);
    expect(sharedPosition.halfMoveClock).toBe(1);
  });
  it('detaches rendered analysis from the live position and re-aliases it on exit', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Detached Live Analysis',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const livePosition = game.$!.livePosition!;
    await store.enterInGameAnalysis(game);
    await store.resumeGame(game, PauseReason.Analysis);
    utility.resolveGameResult.mockClear();

    await store.makeMove(game, createMove(PlayerColour.White));

    expect(game.livePath).toEqual([]);
    expect(game.renderedPath).toEqual([0]);
    expect(game.$!.livePosition).toBe(livePosition);
    expect(game.$!.renderedPosition).not.toBe(livePosition);
    expect(livePosition.sideToMove).toBe(PlayerColour.White);
    expect(game.$!.renderedPosition!.sideToMove).toBe(PlayerColour.Black);
    expect(utility.resolveGameResult).not.toHaveBeenCalled();

    store.exitInGameAnalysis(game);
    expect(game.renderedPath).toEqual(game.livePath);
    expect(game.$!.renderedPosition).toBe(game.$!.livePosition);
  });
  it('moves the rendered history selection into live state before replacing its continuation', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Divergent Live Position',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const pendingLiveMove = game.$!.pendingPlayerTurnHandlePromise;
    store.makeMove(game, createMove(PlayerColour.White));
    await pendingLiveMove;
    store.navigateToNode(game, game.moveTree.root);
    game.gameplayOptions.allowTakeback = true;
    void game.$!.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    store.getVisibleAnalysis(game);
    const selectedClockSnapshot = game.moveTree.root.clockSnapshot!;
    const selectedPosition = game.$!.renderedPosition!;
    domain.TimeControlService.applyMove.mockClear();
    domain.MoveApplicationService.applyMove.mockImplementationOnce((position: IGame['rootPosition'], move: IMove) => {
      expect(position).toBe(selectedPosition);
      expect(game.$!.livePosition).toBe(position);
      expect(game.$!.renderedPosition).toBe(position);
      return applyDefaultMove(position, move);
    });

    await store.makeMove(game, createMove(PlayerColour.White, 11, 27));

    expect(game.livePath).toEqual([0]);
    expect(game.renderedPath).toEqual([0]);
    expect(game.$!.renderedPosition).toBe(game.$!.livePosition);
    expect(game.$!.renderedPosition!.halfMoveClock).toBe(1);
    expect(domain.TimeControlService.applyMove.mock.calls[0]?.[0]).toBe(selectedClockSnapshot);
  });
  it('resolves the result after committing a standalone analysis move', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Standalone Analysis Result',
      whitePlayer: undefined,
      blackPlayer: undefined,
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    utility.resolveGameResult.mockReturnValueOnce({ resultState: ResultState.WhiteWon, resultReason: ResultReason.RuleResolved });

    await store.makeMove(game, createMove(PlayerColour.White));

    expect(game.resultState).toBe(ResultState.WhiteWon);
    expect(game.resultReason).toBe(ResultReason.RuleResolved);
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);
  });
  it('tracks paused live-analysis states across analysis entry and pause or resume transitions', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Paused Analysis',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    await store.enterInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove);

    await store.resumeGame(game, PauseReason.Analysis);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromWhiteTurnWhiteMove);

    const analysisNode = appendChild(game.moveTree.root, createMove(PlayerColour.White), MoveNodeKind.Analysis);
    store.navigateToNode(game, analysisNode);
    await store.pauseGame(game, PauseReason.Menu);
    expect(game.gameState).toBe(GameState.PausedLiveAnalysisFromWhiteTurnBlackMove);
    await store.resumeGame(game, PauseReason.Menu);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromWhiteTurnBlackMove);
  });
  it('derives history navigation state for live and non-live analysis contexts', async () => {
    const store = useGamesStore();
    const liveGame = await store.createGame({
      name: 'History Live',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    const pendingLiveHistoryMove = liveGame.$?.pendingPlayerTurnHandlePromise;
    store.makeMove(liveGame, createMove(PlayerColour.White));
    await pendingLiveHistoryMove;
    store.navigateToNode(liveGame, liveGame.moveTree.root);
    expect(liveGame.gameState).toBe(GameState.LiveAnalysisFromBlackTurnWhiteMove);
    store.navigateToNode(liveGame, liveGame.moveTree.root.children[0]!);
    expect(liveGame.gameState).toBe(GameState.LiveBlackTurn);

    const analysisGame = await store.createGame({
      name: 'History Analysis',
      whitePlayer: undefined,
      blackPlayer: undefined,
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    appendChild(analysisGame.moveTree.root, createMove(PlayerColour.White), MoveNodeKind.Analysis);
    store.navigateToNode(analysisGame, analysisGame.moveTree.root.children[0]!);
    expect(analysisGame.gameState).toBe(GameState.AnalysisBlackMove);
  });

  it('manages analysis engines, visible analysis, and direct board editing with mocked engine services', async () => {
    const store = useGamesStore();
    const primaryEngine = createEngineRecord('engine-c', 'Komodo');
    const game = await store.createGame({
      name: 'Analysis Game',
      whitePlayer: undefined,
      blackPlayer: undefined,
      analysisEngineProfiles: [primaryEngine],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    await store.refreshAnalysis(game);
    expect(store.getVisibleAnalysis(game)?.engineSnapshots).toHaveLength(1);

    await store.addAnalysisEngine(game, createEngineRecord('engine-d', 'Berserk'));
    const addedEngine = game.analysis.snapshots[1]!.assignedEngine;
    const analysisUpdate: IEngineAnalysisUpdate = {
      position: structuredClone(game.rootPosition),
      positionKey: domain.PositionIdentityService.buildPositionKey(game.rootPosition),
      bestMove: createMove(PlayerColour.White),
      lines: [{ depth: 12, pv: [createMove(PlayerColour.White)], scoreCp: 32 }],
      isFinal: false,
    };
    emitAnalysisUpdate(analysisSubscriptions, addedEngine, analysisUpdate);
    const addedSnapshot = game.analysis.snapshots[1]!;
    expect(addedSnapshot.bestMove).toBe(analysisUpdate.bestMove);
    expect(addedSnapshot.lines).toBe(analysisUpdate.lines);
    expect(store.getVisibleAnalysis(game)?.engineSnapshots[1]).toBe(addedSnapshot);
    expect(addedSnapshot.bestMove?.from).toBe(12);

    await store.stopAnalysis(game, 1);
    expect(game.analysis.snapshots[1]!.isComplete).toBe(true);
    await store.removeAnalysisEngine(game, 1);
    expect(game.analysis.snapshots).toHaveLength(1);

    store.enterBoardEdit(game);
    expect(game.gameState).toBe(GameState.BoardEdit);
    await expect(store.refreshAnalysis(game)).rejects.toThrow('board edit');
    const sparseBoard = createBoardPosition(PlayerColour.White);
    store.applyBoardEdit(game, sparseBoard);
    expect(game.gameState).toBe(GameState.BoardEdit);
    expect(game.livePath).toBeUndefined();
    expect(game.renderedPath).toEqual([]);
    expect(game.rootPosition).toEqual(sparseBoard);
    const darkRoot = createBoardPosition(PlayerColour.Black);
    store.applyBoardEdit(game, darkRoot);
    expect(game.rootPosition).toEqual(darkRoot);
    store.enterBoardEdit(game);
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);
    expect(() => store.applyBoardEdit(game, sparseBoard)).toThrow('board edit mode');
  });
  it('manipulates pieces only in board edit and promotes the first edited position to root', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Piece Editing',
      whitePlayer: undefined,
      blackPlayer: undefined,
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    expect(() => store.toggleChessPiece(game, 64, { kind: PieceKind.Rook, colour: PlayerColour.White })).toThrow('board edit mode');
    expect(() => store.resetBoardToStartPosition(game)).toThrow('board edit mode');
    const renderedNode = appendChild(game.moveTree.root, createMove(PlayerColour.White), MoveNodeKind.Analysis);
    store.navigateToNode(game, renderedNode);
    store.enterBoardEdit(game);
    // a fresh tree is only built when an effective edit promotes the edited board to the root
    domain.MoveHistoryService.createMoveTree.mockClear();
    store.deleteChessPiece(game, 0);
    store.clearBoard(game);
    expect(game.renderedPath).toEqual([0]);
    expect(domain.MoveHistoryService.createMoveTree).not.toHaveBeenCalled();

    // the derived rendered position is the object the first effective edit promotes to the root
    const editedPosition = game.$!.renderedPosition!;
    editedPosition.$ = { isStandardInitialPosition: true };
    store.toggleChessPiece(game, 0, { kind: PieceKind.Rook, colour: PlayerColour.White });

    expect(game.rootPosition).toBe(editedPosition);
    expect(game.moveTree.root.children).toHaveLength(0);
    expect(game.renderedPath).toEqual([]);
    expect(editedPosition.board[0]).toEqual({ kind: PieceKind.Rook, colour: PlayerColour.White });
    expect(editedPosition.$?.isStandardInitialPosition).toBeUndefined();
    expect(domain.MoveHistoryService.createMoveTree).toHaveBeenCalledTimes(1);

    // later edits mutate the root in place, so the tree is never rebuilt again
    store.toggleChessPiece(game, 0, { kind: PieceKind.Queen, colour: PlayerColour.Black });
    expect(editedPosition.board[0]).toEqual({ kind: PieceKind.Queen, colour: PlayerColour.Black });
    store.toggleChessPiece(game, 0, { kind: PieceKind.Queen, colour: PlayerColour.Black });
    expect(editedPosition.board[0]).toBeUndefined();
    store.toggleChessPiece(game, 1, { kind: PieceKind.Knight, colour: PlayerColour.White });
    store.moveChessPiece(game, 1, 2);
    expect(editedPosition.board[1]).toBeUndefined();
    expect(editedPosition.board[2]).toEqual({ kind: PieceKind.Knight, colour: PlayerColour.White });
    store.deleteChessPiece(game, 2);
    expect(editedPosition.board[2]).toBeUndefined();
    store.toggleChessPiece(game, 3, { kind: PieceKind.Bishop, colour: PlayerColour.Black });
    store.clearBoard(game);
    expect(editedPosition.board.every((piece) => piece === undefined)).toBe(true);
    expect(game.rootPosition).toBe(editedPosition);
    expect(domain.MoveHistoryService.createMoveTree).toHaveBeenCalledTimes(1);

    const startPosition = createBoardPosition(PlayerColour.White);
    startPosition.$ = { isStandardInitialPosition: true };
    utility.createInitialBoardPosition.mockReturnValueOnce(startPosition);
    store.resetBoardToStartPosition(game);
    expect(game.rootPosition).toBe(startPosition);
    expect(startPosition.$.isStandardInitialPosition).toBe(true);
    expect(domain.MoveHistoryService.createMoveTree).toHaveBeenCalledTimes(2);
  });
  it('allows paused non-play exceptions for reassignment and analysis actions', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Paused Exceptions',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    await store.pauseGame(game, PauseReason.Manual);
    void game.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await expect(store.reassignPlayer(game, PlayerColour.Black, createEnginePlayer(PlayerColour.Black, 'Engine Black'))).resolves.toBeUndefined();
    await expect(store.addAnalysisEngine(game, createEngineRecord('engine-e', 'Dragon'))).resolves.toBeUndefined();
    await expect(store.refreshAnalysis(game)).resolves.toBeUndefined();
    await expect(store.removeAnalysisEngine(game, 0)).resolves.toBeUndefined();
  });

  it('supports engine player turns, draw resolution, reassignment, and resignation', async () => {
    const store = useGamesStore();
    const ponderMove = createMove(PlayerColour.Black, 52, 36);
    nextPlayerMove = createMove(PlayerColour.White);
    nextPlayerMove.$!.ponderMove = ponderMove;
    const engineGame = await store.createGame({
      name: 'Engine Turn',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    const pendingDeferred = engineGame.$!.pendingPlayerTurnPromise!;
    const resolvePendingMove = vi.spyOn(pendingDeferred, 'resolve');
    await engineGame.$?.pendingPlayerTurnHandlePromise;
    const committedMove = engineGame.moveTree.root.children[0]!.move!;
    expect(engineGame.livePath).toEqual([0]);
    expect(engineGame.gameState).toBe(GameState.LiveBlackTurn);
    expect(resolvePendingMove).toHaveBeenCalledOnce();
    expect(resolvePendingMove).toHaveBeenCalledWith(committedMove);
    expect(domain.EngineRuntimeService.startPondering).toHaveBeenCalledWith((engineGame.whitePlayer as IEnginePlayer).assignedEngine, engineGame, committedMove, committedMove.$!.ponderMove);
    expect(domain.EngineRuntimeService.startPondering.mock.invocationCallOrder[0]).toBeLessThan(domain.MoveHistoryService.addMainlineMove.mock.invocationCallOrder[0]!);

    await store.offerDraw(engineGame);
    void engineGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.acceptDrawOffer(engineGame);
    expect(engineGame.resultState).toBe(ResultState.Drawn);
    expect(engineGame.resultReason).toBe(ResultReason.DrawAgreement);

    const localGame = await store.createGame({
      name: 'Editable Game',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    void localGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.reassignPlayer(localGame, PlayerColour.Black, undefined);
    await store.resignGame(localGame, PlayerColour.White);

    expect(localGame.gameState).toBe(GameState.AnalysisBlackMove);
    expect(localGame.resultState).toBe(ResultState.BlackWon);
    expect(localGame.resultReason).toBe(ResultReason.Resignation);
  });
  it('plays scholar mate through local player turns only', async () => {
    installScholarMateRules();
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Scholar Mate PvP',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    for (const move of scholarMateSequence) await store.makeMove(game, move);
    expectScholarMateFinished(game);
    expect(domain.MoveApplicationService.applyMove).toHaveBeenCalledTimes(scholarMateSequence.length);
    expect(domain.MoveHistoryService.addMainlineMove).toHaveBeenCalledTimes(scholarMateSequence.length);
    expect(domain.EngineRuntimeService.startPlayerTurn).not.toHaveBeenCalled();
    expect(domain.EngineRuntimeService.awaitPlayerTurnMove).not.toHaveBeenCalled();
  });
  it('plays scholar mate with a delayed engine reply for black', async () => {
    installScholarMateRules();
    queueEngineMoves('Engine Black', scholarMateMoves.black);
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Scholar Mate PvE',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createEnginePlayer(PlayerColour.Black, 'Engine Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    for (const move of scholarMateMoves.white) {
      await store.makeMove(game, move);
      if (game.resultState === ResultState.Ongoing) await awaitPendingPlayerTurn(game);
    }

    expectScholarMateFinished(game);
    expect(domain.MoveApplicationService.applyMove).toHaveBeenCalledTimes(scholarMateSequence.length);
    expect(domain.MoveHistoryService.addMainlineMove).toHaveBeenCalledTimes(scholarMateSequence.length);
    expect(domain.EngineRuntimeService.startPlayerTurn).toHaveBeenCalledTimes(3);
    expect(domain.EngineRuntimeService.awaitPlayerTurnMove).toHaveBeenCalledTimes(3);
  });
  it('plays scholar mate with delayed engines on both sides', async () => {
    installScholarMateRules();
    queueEngineMoves('Engine White', scholarMateMoves.white);
    queueEngineMoves('Engine Black', scholarMateMoves.black);
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Scholar Mate EvE',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createEnginePlayer(PlayerColour.Black, 'Engine Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    await playEngineOnlyGame(game);
    expectScholarMateFinished(game);
    expect(domain.MoveApplicationService.applyMove).toHaveBeenCalledTimes(scholarMateSequence.length);
    expect(domain.MoveHistoryService.addMainlineMove).toHaveBeenCalledTimes(scholarMateSequence.length);
    expect(domain.EngineRuntimeService.startPlayerTurn).toHaveBeenCalledTimes(7);
    expect(domain.EngineRuntimeService.awaitPlayerTurnMove).toHaveBeenCalledTimes(7);
  });
  it('defers player-engine moves while paused and replays them after resume', async () => {
    const store = useGamesStore();
    nextPlayerMove = createMove(PlayerColour.White);
    nextPlayerMove.$!.ponderMove = createMove(PlayerColour.Black, 52, 36);
    const game = await store.createGame({
      name: 'Deferred Engine Move',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    const pendingMove = game.$?.pendingPlayerTurnHandlePromise;
    await store.pauseGame(game, PauseReason.Manual);
    await pendingMove;
    expect(game.gameState).toBe(GameState.PausedWhiteTurn);
    expect(game.livePath).toEqual([]);
    expect(domain.EngineRuntimeService.startPondering).toHaveBeenCalledOnce();

    await store.resumeGame(game, PauseReason.Manual);
    await randomDelay();
    expect(game.gameState).toBe(GameState.LiveBlackTurn);
    expect(game.livePath).toEqual([0]);
    expect(domain.EngineRuntimeService.startPondering).toHaveBeenCalledOnce();
  });
  it('rewrites mainline or adds analysis branches from live history based on per-game policy', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'History Policy',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    const pendingLiveMove = game.$?.pendingPlayerTurnHandlePromise;
    store.makeMove(game, createMove(PlayerColour.White));
    await pendingLiveMove;
    store.navigateToNode(game, game.moveTree.root);
    game.gameplayOptions.allowTakeback = true;
    void game.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.makeMove(game, createMove(PlayerColour.White, 11, 27));
    expect(domain.MoveHistoryService.rewriteMainline).not.toHaveBeenCalled();
    expect(game.livePath).toEqual([0]);
    expect(game.renderedPath).toEqual([0]);
    expect(game.moveTree.root.mainlineChildIndex).toBe(0);
    expect(game.moveTree.root.children).toHaveLength(1);
    expect(game.moveTree.root.children[0]!.kind).toBe(MoveNodeKind.Live);
    expect(game.moveTree.root.children[0]!.move?.from).toBe(11);
    expect(game.moveTree.root.children[0]!.move?.to).toBe(27);

    const branchGame = await store.createGame({
      name: 'History Analysis Only',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const pendingBranchMove = branchGame.$?.pendingPlayerTurnHandlePromise;
    store.makeMove(branchGame, createMove(PlayerColour.White));
    await pendingBranchMove;
    store.navigateToNode(branchGame, branchGame.moveTree.root);
    branchGame.gameplayOptions.allowTakeback = false;
    settingsSnapshot.gameplay.analysisBranchExitBehaviour = AnalysisBranchExitBehaviour.ReturnToLiveNode;
    void branchGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.makeMove(branchGame, createMove(PlayerColour.White, 10, 26));
    expect(branchGame.livePath).toEqual([0]);
    expect(branchGame.renderedPath).toEqual([0]);
    expect(branchGame.gameState).toBe(GameState.LiveBlackTurn);

    store.navigateToNode(branchGame, branchGame.moveTree.root);
    settingsSnapshot.gameplay.analysisBranchExitBehaviour = AnalysisBranchExitBehaviour.StayOnBranch;
    void branchGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.makeMove(branchGame, createMove(PlayerColour.White, 9, 25));
    expect(branchGame.livePath).toEqual([0]);
    expect(branchGame.renderedPath).toEqual([2]);
    expect(branchGame.gameState).toBe(GameState.LiveAnalysisFromBlackTurnBlackMove);
  });
  it('prunes exploratory descendants on the next real live move after exiting in-game analysis', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Prune After Analysis',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    await store.enterInGameAnalysis(game);
    await store.resumeGame(game, PauseReason.Analysis);
    store.makeMove(game, createMove(PlayerColour.White, 8, 24));
    expect(domain.MoveHistoryService.pruneFutureMoves).not.toHaveBeenCalled();
    expect(game.livePath).toEqual([]);
    expect(game.renderedPath).toEqual([0]);

    store.exitInGameAnalysis(game);
    const pendingPrunedMove = game.$?.pendingPlayerTurnHandlePromise;
    store.makeMove(game, createMove(PlayerColour.White, 12, 28));
    await pendingPrunedMove;
    expect(domain.MoveHistoryService.pruneFutureMoves).toHaveBeenCalledTimes(1);
    expect(game.livePath).toEqual([0]);
    expect(game.moveTree.root.children).toHaveLength(1);
    expect(game.moveTree.root.children[0]!.move?.from).toBe(12);
  });
  it('restarts restored analysis only when the setting enables it', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Restore Analysis',
      whitePlayer: undefined,
      blackPlayer: undefined,
      analysisEngineProfiles: [createEngineRecord('engine-f', 'Ethereal')],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    const payload = stripRuntimeMetadata(game);

    domain.EngineRuntimeService.startAnalysis.mockClear();
    settingsSnapshot.analysis.resumeLiveAnalysisAfterRestore = false;
    await store.insertGame(payload);
    expect(domain.EngineRuntimeService.startAnalysis).not.toHaveBeenCalled();

    settingsSnapshot.analysis.resumeLiveAnalysisAfterRestore = true;
    await store.insertGame(payload);
    expect(domain.EngineRuntimeService.startAnalysis).toHaveBeenCalled();
  });
  it('requests exactly one eligible player-engine turn after restoring the game runtime', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Restore Engine Turn',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    const payload = stripRuntimeMetadata(game);
    payload.whitePlayer = createEnginePlayer(PlayerColour.White, 'Engine White');
    domain.EngineRuntimeService.startPlayerTurn.mockClear();

    const restoredGame = await store.insertGame(payload);
    const restoredTurn = restoredGame.$?.pendingPlayerTurnHandlePromise;
    expect(restoredTurn).toBeDefined();
    await restoredTurn;

    expect(restoredGame.$?.livePosition).toBeDefined();
    expect(restoredGame.whitePlayer?.$?.activityState).toBe(PlayerActivityState.Active);
    expect(restoredGame.gameState).toBe(GameState.LiveBlackTurn);
    expect(domain.EngineRuntimeService.startPlayerTurn).toHaveBeenCalledOnce();
  });
  it('preserves live families across reassignment and clears stale engine-turn requests for the replaced seat', async () => {
    const store = useGamesStore();
    const pausedGame = await store.createGame({
      name: 'Paused Reassign',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    await store.enterInGameAnalysis(pausedGame);
    void pausedGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.reassignPlayer(pausedGame, PlayerColour.White, createEnginePlayer(PlayerColour.White, 'Engine White'));
    expect(pausedGame.gameState).toBe(GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove);

    const staleGame = await store.createGame({
      name: 'Stale Seat Request',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const pendingMove = staleGame.$?.pendingPlayerTurnHandlePromise;
    void pendingMove?.catch(() => undefined);
    await store.reassignPlayer(staleGame, PlayerColour.White, createLocalPlayer(PlayerColour.White, 'Replacement White'));
    await randomDelay();
    await randomDelay();
    await randomDelay();
    expect(staleGame.livePath).toEqual([]);

    const dueGame = await store.createGame({
      name: 'Due Engine Reassign',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    void dueGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    domain.EngineRuntimeService.startPlayerTurn.mockClear();
    await store.reassignPlayer(dueGame, PlayerColour.White, createEnginePlayer(PlayerColour.White, 'Engine White'));
    const duePendingMove = dueGame.$?.pendingPlayerTurnHandlePromise;
    await randomDelay();
    await randomDelay();
    await randomDelay();
    await duePendingMove;
    expect(domain.EngineRuntimeService.startPlayerTurn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
  it('preserves history and awaits turn cancellation before removing an engine player', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Engine To Analysis',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    await game.$!.pendingPlayerTurnHandlePromise;
    const previousPlayer = game.whitePlayer as IEnginePlayer;
    const previousEngine = previousPlayer.assignedEngine;
    const rootPosition = game.rootPosition;
    const moveTree = game.moveTree;
    const rootNode = moveTree.root;
    const renderedPath = [...game.renderedPath];
    const renderedPosition = game.$!.renderedPosition;
    const pendingPlayerTurnHandle = game.$!.pendingPlayerTurnHandlePromise;
    const pendingPlayerTurnAbortController = game.$!.pendingPlayerTurnAbortController!;
    const remainingTime = { white: game.clockSnapshot.white.remainingMs, black: game.clockSnapshot.black.remainingMs };
    domain.MoveHistoryService.createMoveTree.mockClear();
    domain.EngineRuntimeService.stopEngine.mockClear();
    domain.EngineRuntimeService.stopEngine.mockImplementationOnce(async (engine: IAssignedEngine) => {
      expect(engine).toBe(previousEngine);
      expect(game.whitePlayer).toBe(previousPlayer);
      await randomDelay();
    });

    await store.reassignPlayer(game, PlayerColour.White, undefined);
    await expect(pendingPlayerTurnHandle).resolves.toBeUndefined();

    expect(pendingPlayerTurnAbortController.signal.aborted).toBe(true);
    expect(domain.EngineRuntimeService.stopEngine).toHaveBeenCalledOnce();
    expect(domain.MoveHistoryService.createMoveTree).not.toHaveBeenCalled();
    expect(game.rootPosition).toBe(rootPosition);
    expect(game.moveTree).toBe(moveTree);
    expect(game.moveTree.root).toBe(rootNode);
    expect(game.renderedPath).toEqual(renderedPath);
    expect(game.$!.renderedPosition).toBe(renderedPosition);
    expect(game.livePath).toBeUndefined();
    expect(game.whitePlayer).toBeUndefined();
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);
    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(game.clockSnapshot.white.remainingMs).toBe(remainingTime.white);
    expect(game.clockSnapshot.black.remainingMs).toBe(remainingTime.black);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    expect(game.clockSnapshot.black.isRunning).toBe(false);
  });
  it('supports timeout review analysis and clears stale best-move data on analysis lifecycle changes', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Timeout Analysis',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [createEngineRecord('engine-g', 'Storm')],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const snapshot = game.analysis.snapshots[0]!;
    emitAnalysisUpdate(analysisSubscriptions, snapshot.assignedEngine, {
      position: structuredClone(game.rootPosition),
      positionKey: domain.PositionIdentityService.buildPositionKey(game.rootPosition),
      bestMove: createMove(PlayerColour.White),
      lines: [{ depth: 10, pv: [createMove(PlayerColour.White)], scoreCp: 24 }],
      isFinal: false,
    });
    expect(snapshot.bestMove?.from).toBe(12);

    await store.stopAnalysis(game);
    expect(snapshot.bestMove).toBeUndefined();

    snapshot.bestMove = createMove(PlayerColour.White, 14, 30);
    await store.refreshAnalysis(game);
    expect(snapshot.bestMove).toBeUndefined();

    snapshot.bestMove = createMove(PlayerColour.White, 15, 31);
    domain.EngineRuntimeService.startAnalysis.mockImplementationOnce(async () => {
      throw new Error('analysis boom');
    });
    await store.retryAnalysis(game, 0);
    expect(snapshot.bestMove).toBeUndefined();
    expect(snapshot.assignedEngine.$?.lastError).toBe('analysis boom');

    domain.TimeControlService.hasExpired.mockReturnValueOnce(true);
    domain.TimeControlService.getRemainingTime.mockReturnValueOnce({ white: 0, black: 1000 });
    void game.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.syncClock(game, new ClockTimestamp('2026-04-18T12:00:00.000Z'));
    expect(game.resultReason).toBe(ResultReason.Timeout);
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);

    await store.enterInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromWhiteTurnWhiteMove);
    store.exitInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);
    expect(game.resultReason).toBe(ResultReason.Timeout);
  });
  it('throws when paused gameplay actions are requested and keeps move submission blocked by state', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Blocked Move',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    const move = createMove(PlayerColour.White);

    game.gameState = GameState.PausedWhiteTurn;
    await expect(store.makeMove(game, move)).rejects.toThrow('pausedWhiteTurn');
    await expect(store.takeBack(game, 1)).rejects.toThrow('pausedWhiteTurn');
    expect(() => store.navigateToNode(game, game.moveTree.root)).toThrow('pausedWhiteTurn');
    await expect(store.resignGame(game, PlayerColour.White)).rejects.toThrow('pausedWhiteTurn');
    await expect(store.offerDraw(game)).rejects.toThrow('pausedWhiteTurn');
    await expect(store.acceptDrawOffer(game)).rejects.toThrow('pausedWhiteTurn');
    await expect(store.declineDrawOffer(game)).rejects.toThrow('pausedWhiteTurn');
    await expect(store.withdrawDrawOffer(game)).rejects.toThrow('pausedWhiteTurn');
    await expect(store.enterInGameAnalysis(game)).rejects.toThrow('pausedWhiteTurn');
    expect(() => store.enterBoardEdit(game)).toThrow('pausedWhiteTurn');
    game.gameState = GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove;
    await expect(store.makeMove(game, move)).rejects.toThrow('pausedLiveAnalysisFromWhiteTurnWhiteMove');
    game.gameState = GameState.BoardEdit;
    await expect(store.makeMove(game, move)).rejects.toThrow('boardEdit');
  });

  it('allows move submission from playable game states and inserts duplicate ids with repair', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Playable Move',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    game.gameState = GameState.AnalysisWhiteMove;
    expect(store.makeMove(game, createMove(PlayerColour.White))).toBeDefined();
    const insertedPayload = stripRuntimeMetadata(game);
    insertedPayload.metadata.id = game.metadata.id;
    const insertedGame = await store.insertGame(insertedPayload);

    expect(insertedGame).toBe(insertedPayload);
    expect(insertedGame.metadata.id).not.toBe(game.metadata.id);
    expect(store.listGames()).toHaveLength(2);
  });
  it('keeps untimed live games out of timed pause and focus-return flows', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Untimed Live',
      whitePlayer: createLocalPlayer(PlayerColour.White, 'White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    domain.PlatformEventService.subscribeToAppFocusReturned.mockClear();
    expect(domain.PlatformEventService.subscribeToAppFocusReturned).not.toHaveBeenCalled();
    await store.pauseGame(game, PauseReason.Manual);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    await store.pauseGame(game, PauseReason.Menu);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
  });
});
