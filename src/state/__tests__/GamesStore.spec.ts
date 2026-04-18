import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DrawOfferDirection,
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  GameState,
  MoveBranchKind,
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
    generateLegalMoves: vi.fn((position: IGame['boardRoot']) => [createMove(position.sideToMove)]),
    isMoveLegal: vi.fn(() => true),
    applyMove: vi.fn((position: IGame['boardRoot'], move: IMove) => ({
      ...structuredClone(position),
      sideToMove: move.movingColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White,
      halfMoveClock: position.halfMoveClock + 1,
      fullMoveNumber: position.fullMoveNumber + (position.sideToMove === PlayerColour.Black ? 1 : 0),
    })),
    resolveResult: vi.fn(() => ({ resultState: ResultState.Ongoing, resultReason: undefined })),
  },
  MoveNotationService: {
    decorateMove: vi.fn((_position: IGame['boardRoot'], move: IMove) => ({
      ...structuredClone(move),
      $: {
        san: `${move.from}-${move.to}`,
        uci: `${move.from}-${move.to}`,
      },
    })),
  },
  MoveUpdateService: {
    createMoveTree: vi.fn((boardRoot: IGame['boardRoot'], clockSnapshot?: IClockSnapshot) => createMoveTree(boardRoot, clockSnapshot)),
    addMainlineMove: vi.fn((parentNode: IMoveNode, move: IMove, position: IGame['boardRoot'], clockSnapshot?: IClockSnapshot) => {
      appendChild(parentNode, move, position, MoveBranchKind.Mainline, clockSnapshot);
      return { root: getRootNode(parentNode) };
    }),
    addAnalysisMove: vi.fn((parentNode: IMoveNode, move: IMove, position: IGame['boardRoot']) => {
      appendChild(parentNode, move, position, MoveBranchKind.Analysis);
      return { root: getRootNode(parentNode) };
    }),
    takeBack: vi.fn((targetNode: IMoveNode, moveCount: number) => {
      let retainedNode = targetNode;
      for (let index = 0; index < moveCount && retainedNode.$?.parent; index += 1) retainedNode = retainedNode.$.parent;
      retainedNode.children = [];
      retainedNode.mainlineChildIndex = undefined;
      return { root: getRootNode(retainedNode) };
    }),
    replaceBoardRoot: vi.fn((boardRoot: IGame['boardRoot'], clockSnapshot?: IClockSnapshot) => createMoveTree(boardRoot, clockSnapshot)),
  },
  PlatformEventService: {
    subscribeToAppCloseRequested: vi.fn(() => () => unsubscribeMock()),
    subscribeToAppFocusReturned: vi.fn(() => () => unsubscribeMock()),
  },
  PositionIdentityService: {
    buildPositionKey: vi.fn((position: IGame['boardRoot']) => `position:${position.sideToMove}:${position.fullMoveNumber}:${position.halfMoveClock}`),
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
function createEnginePlayer(colour: PlayerColour, displayName: string, engine: IEngineRecord = createEngineRecord(`${colour}-engine`, displayName)): IGame['whitePlayer'] {
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

    await store.makeMove(game, move);
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

    game.gameState = GameState.LiveAnalysisFromWhiteTurnBlackMove;
    game.highlightPath = [0];
    appendChild(game.moveTree.root, createMove(PlayerColour.White), createBoardPosition(PlayerColour.Black), MoveBranchKind.Analysis);
    await store.pauseGame(game, PauseReason.Menu);
    expect(game.gameState).toBe(GameState.PausedLiveAnalysisFromWhiteTurnBlackMove);
    await store.resumeGame(game, PauseReason.Menu);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromWhiteTurnBlackMove);
  });

  it('manages analysis engines, visible analysis, and board editing with mocked engine services', async () => {
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
      position: structuredClone(game.boardRoot),
      positionKey: domain.PositionIdentityService.buildPositionKey(game.boardRoot),
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
    const sparseBoard = createBoardPosition(PlayerColour.White);
    await store.confirmBoardEdit(game, sparseBoard);
    expect(game.gameState).toBe(GameState.AnalysisWhiteMove);
  });

  it('supports engine player turns, draw resolution, reassignment, and resignation', async () => {
    const store = useGamesStore();
    const engineGame = await store.createGame({
      name: 'Engine Turn',
      whitePlayer: createEnginePlayer(PlayerColour.White, 'Engine White'),
      blackPlayer: createLocalPlayer(PlayerColour.Black, 'Black'),
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    nextPlayerMove = createMove(PlayerColour.White);
    const requestedMove = await store.requestPlayerMove(engineGame);
    expect(requestedMove).toMatchObject({ from: 12, to: 28 });
    expect(engineGame.gameState).toBe(GameState.LiveBlackTurn);

    await store.offerDraw(engineGame);
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
    await store.reassignPlayer(localGame, PlayerColour.Black, undefined);
    await store.resignGame(localGame, PlayerColour.White);

    expect(localGame.gameState).toBe(GameState.AnalysisBlackMove);
    expect(localGame.resultState).toBe(ResultState.BlackWon);
    expect(localGame.resultReason).toBe(ResultReason.Resignation);
  });
  it('throws when move submission is blocked by game state', async () => {
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
    game.gameState = GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove;
    await expect(store.makeMove(game, move)).rejects.toThrow('pausedLiveAnalysisFromWhiteTurnWhiteMove');
    game.gameState = GameState.BoardEdit;
    await expect(store.makeMove(game, move)).rejects.toThrow('boardEdit');
    game.gameState = GameState.Checkmate;
    await expect(store.makeMove(game, move)).rejects.toThrow('checkmate');
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
    await expect(store.makeMove(game, createMove(PlayerColour.White))).resolves.toBeDefined();
    const insertedPayload = stripRuntimeMetadata(game);
    insertedPayload.metadata.id = game.metadata.id;
    const insertedGame = await store.insertGame(insertedPayload);

    expect(insertedGame.metadata.id).not.toBe(game.metadata.id);
    expect(store.listGames()).toHaveLength(2);
  });
});
