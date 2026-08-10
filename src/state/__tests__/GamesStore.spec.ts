import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalysisBranchExitBehaviour,
  DrawOfferDirection,
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  GameState,
  MoveNodeKind,
  PauseReason,
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
  type IEnginePositionState,
  type IEngineRecord,
  type IGame,
  type IMove,
  type IMoveNode,
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
  getRootNode,
  randomDelay,
  resolveWithRandomDelay,
  stripRuntimeMetadata,
} from './StateStoreTestUtility';

let useGamesStore: typeof import('..').useGamesStore;
let settingsSnapshot = createSettingsSnapshot();
let storedGamesByPath = new Map<string, IGame>();
let analysisSubscriptions = new Map<IAssignedEngine, (update: IEngineAnalysisUpdate) => void>();
let nextPlayerMove = createMove(PlayerColour.White);
let createdGameIds: Array<ReturnType<Crypto['randomUUID']>> = [];
const unsubscribeMock = vi.fn();
const domain = {
  EngineRuntimeService: {
    ensureReady: vi.fn(async (engine: IAssignedEngine) => {
      engine.$ = engine.$ ?? { availability: EngineAvailability.Unavailable, analysisLines: new Map() };
      engine.$.availability = EngineAvailability.Ready;
      await randomDelay();
    }),
    syncPosition: vi.fn(async (_engine: IAssignedEngine, _positionState: IEnginePositionState) => {
      await randomDelay();
    }),
    startAnalysis: vi.fn(async (engine: IAssignedEngine, request: { multiPv: number; searchMode: EngineAnalysisSearchMode }) => {
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
    startPlayerTurn: vi.fn(async (engine: IAssignedEngine) => {
      if (engine.$) engine.$.availability = EngineAvailability.Running;
      await randomDelay();
    }),
    awaitPlayerTurnMove: vi.fn(async (engine: IAssignedEngine) => {
      if (engine.$) engine.$.availability = EngineAvailability.Ready;
      return resolveWithRandomDelay(nextPlayerMove);
    }),
    stopEngine: vi.fn(async (engine: IAssignedEngine) => {
      if (engine.$) engine.$.availability = EngineAvailability.Unavailable;
      await randomDelay();
    }),
  },
  GameRuleService: {
    createInitialBoardPosition: vi.fn(() => createBoardPosition()),
    generateLegalMoves: vi.fn((position: IGame['rootPosition']) => [createMove(position.sideToMove)]),
    isMoveLegal: vi.fn(() => true),
    applyMove: vi.fn((position: IGame['rootPosition'], move: IMove) => ({
      ...structuredClone(position),
      sideToMove: move.movingColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White,
      halfMoveClock: position.halfMoveClock + 1,
      fullMoveNumber: position.fullMoveNumber + (position.sideToMove === PlayerColour.Black ? 1 : 0),
    })),
    resolveResult: vi.fn(() => ({ resultState: ResultState.Ongoing, resultReason: undefined })),
  },
  MoveNotationService: {
    decorateMove: vi.fn((_position: IGame['rootPosition'], move: IMove) => ({
      ...structuredClone(move),
      $: {
        san: `${move.from}-${move.to}`,
        uci: `${move.from}-${move.to}`,
      },
    })),
  },
  MoveHistoryService: {
    createMoveTree: vi.fn((rootPosition: IGame['rootPosition'], clockSnapshot?: IClockSnapshot) => createMoveTree(rootPosition, clockSnapshot)),
    addMainlineMove: vi.fn((parentNode: IMoveNode, move: IMove, position: IGame['rootPosition'], clockSnapshot?: IClockSnapshot) => {
      return appendChild(parentNode, move, position, MoveNodeKind.Live, clockSnapshot);
    }),
    addAnalysisMove: vi.fn((parentNode: IMoveNode, move: IMove, position: IGame['rootPosition']) => {
      return appendChild(parentNode, move, position, MoveNodeKind.Analysis);
    }),
    rewriteMainline: vi.fn((parentNode: IMoveNode, childNode: IMoveNode) => {
      const childIndex = parentNode.children.indexOf(childNode);
      if (childIndex >= 0) parentNode.mainlineChildIndex = childIndex;
      parentNode.children.forEach((candidate) => {
        candidate.kind = MoveNodeKind.Live;
      });
      return getRootNode(parentNode);
    }),
    pruneFutureMoves: vi.fn((node: IMoveNode) => {
      node.children = [];
      node.mainlineChildIndex = undefined;
      return getRootNode(node);
    }),
    takeBack: vi.fn((targetNode: IMoveNode, moveCount: number) => {
      let retainedNode = targetNode;
      for (let index = 0; index < moveCount && retainedNode.$?.parent; index += 1) retainedNode = retainedNode.$.parent;
      retainedNode.children = [];
      retainedNode.mainlineChildIndex = undefined;
      return { root: getRootNode(retainedNode) };
    }),
    replaceBoardRoot: vi.fn((rootPosition: IGame['rootPosition'], clockSnapshot?: IClockSnapshot) => createMoveTree(rootPosition, clockSnapshot)),
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
    startClock: vi.fn((clockSnapshot: IClockSnapshot, colour: PlayerColour, nowUtc: string) => ({
      ...structuredClone(clockSnapshot),
      activeColour: colour,
      startedAtUtc: nowUtc,
      white: { ...structuredClone(clockSnapshot.white), isRunning: colour === PlayerColour.White },
      black: { ...structuredClone(clockSnapshot.black), isRunning: colour === PlayerColour.Black },
    })),
    applyMove: vi.fn((clockSnapshot: IClockSnapshot, movingColour: PlayerColour, nowUtc: string) => ({
      ...structuredClone(clockSnapshot),
      activeColour: movingColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White,
      lastMoveAtUtc: nowUtc,
      white: { ...structuredClone(clockSnapshot.white), isRunning: movingColour !== PlayerColour.White },
      black: { ...structuredClone(clockSnapshot.black), isRunning: movingColour !== PlayerColour.Black },
    })),
    pauseClock: vi.fn((clockSnapshot: IClockSnapshot, nowUtc: string) => ({
      ...structuredClone(clockSnapshot),
      pausedAtUtc: nowUtc,
      white: { ...structuredClone(clockSnapshot.white), isRunning: false },
      black: { ...structuredClone(clockSnapshot.black), isRunning: false },
    })),
    resumeClock: vi.fn((clockSnapshot: IClockSnapshot, nowUtc: string) => ({
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
    domain.GameRuleService.isMoveLegal.mockReset();
    domain.GameRuleService.isMoveLegal.mockImplementation(() => true);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => createdGameIds.shift() ?? 'game-fallback-0000-0000-000000000000');
    vi.doMock('@/domain', () => domain);
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

    const pendingMove = game.$?.pendingPlayerTurnHandlePromise;
    store.makeMove(game, move);
    await pendingMove;
    expect(game.livePath).toEqual([0]);
    expect(game.highlightPath).toEqual([0]);
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

    const analysisNode = appendChild(game.moveTree.root, createMove(PlayerColour.White), createBoardPosition(PlayerColour.Black), MoveNodeKind.Analysis);
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
    appendChild(analysisGame.moveTree.root, createMove(PlayerColour.White), createBoardPosition(PlayerColour.Black), MoveNodeKind.Analysis);
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
    emitAnalysisUpdate(analysisSubscriptions, addedEngine, {
      position: structuredClone(game.rootPosition),
      positionKey: domain.PositionIdentityService.buildPositionKey(game.rootPosition),
      bestMove: createMove(PlayerColour.White),
      lines: [{ depth: 12, pv: [createMove(PlayerColour.White)], scoreCp: 32 }],
      isFinal: false,
    });
    expect(store.getVisibleAnalysis(game)?.engineSnapshots[1]?.bestMove?.from).toBe(12);

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
    expect(game.highlightPath).toEqual([]);
    expect(game.moveTree.root.position).toEqual(sparseBoard);
    const darkRoot = createBoardPosition(PlayerColour.Black);
    store.applyBoardEdit(game, darkRoot);
    expect(game.moveTree.root.position).toEqual(darkRoot);
    store.enterBoardEdit(game);
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);
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
    nextPlayerMove = createMove(PlayerColour.White);
    const engineGame = await store.createGame({
      name: 'Engine Turn',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    await engineGame.$?.pendingPlayerTurnHandlePromise;
    expect(engineGame.livePath).toEqual([0]);
    expect(engineGame.gameState).toBe(GameState.LiveBlackTurn);

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
  it('defers player-engine moves while paused and replays them after resume', async () => {
    const store = useGamesStore();
    nextPlayerMove = createMove(PlayerColour.White);
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

    await store.resumeGame(game, PauseReason.Manual);
    await randomDelay();
    expect(game.gameState).toBe(GameState.LiveBlackTurn);
    expect(game.livePath).toEqual([0]);
  });
  it('discards stale deferred player-engine moves and requests a fresh turn on resume', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Stale Deferred Engine Move',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createEnginePlayer(PlayerColour.Black, 'Engine Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });

    nextPlayerMove = createMove(PlayerColour.White);
    const pendingMove = game.$?.pendingPlayerTurnHandlePromise;
    await store.pauseGame(game, PauseReason.Manual);
    await pendingMove;
    domain.GameRuleService.isMoveLegal.mockImplementationOnce(() => false);
    nextPlayerMove = createMove(PlayerColour.Black, 52, 36);

    await store.resumeGame(game, PauseReason.Manual);
    await randomDelay();
    await randomDelay();
    await randomDelay();
    await randomDelay();
    await randomDelay();
    await randomDelay();
    domain.GameRuleService.isMoveLegal.mockImplementation(() => true);

    expect(domain.EngineRuntimeService.startPlayerTurn.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    expect(game.livePath).toEqual([0]);
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
    expect(domain.MoveHistoryService.rewriteMainline).toHaveBeenCalledTimes(1);
    expect(game.livePath).toEqual([1]);
    expect(game.highlightPath).toEqual([1]);
    expect(game.moveTree.root.mainlineChildIndex).toBe(1);
    expect(game.moveTree.root.children[0]!.kind).toBe(MoveNodeKind.Live);

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
    expect(branchGame.highlightPath).toEqual([0]);
    expect(branchGame.gameState).toBe(GameState.LiveBlackTurn);

    store.navigateToNode(branchGame, branchGame.moveTree.root);
    settingsSnapshot.gameplay.analysisBranchExitBehaviour = AnalysisBranchExitBehaviour.StayOnBranch;
    void branchGame.$?.pendingPlayerTurnHandlePromise?.catch(() => undefined);
    await store.makeMove(branchGame, createMove(PlayerColour.White, 9, 25));
    expect(branchGame.livePath).toEqual([0]);
    expect(branchGame.highlightPath).toEqual([2]);
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
    expect(game.highlightPath).toEqual([0]);

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
    await store.syncClock(game, '2026-04-18T12:00:00.000Z');
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
    expect(() => store.makeMove(game, move)).toThrow('pausedWhiteTurn');
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
    expect(() => store.makeMove(game, move)).toThrow('pausedLiveAnalysisFromWhiteTurnWhiteMove');
    game.gameState = GameState.BoardEdit;
    expect(() => store.makeMove(game, move)).toThrow('boardEdit');
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
