import { describe, expect, it } from 'vitest'
import {
  AnalysisBranchExitBehaviour,
  BoardOrientation,
  EngineAvailability,
  EngineClientType,
  GameState,
  PlayerColour,
  PlayerType,
  PromotionPolicy,
  ResultState,
  ThemeMode,
  TimeControlPreset,
  type IGameSessionSnapshot,
  type IGame,
  type ISettingsSnapshot,
  type IMoveNode,
  type IMoveTree,
  type MovePath,
} from '@/contracts';
import {
  MoveHistoryService,
  PositionIdentityService,
  SerializationError,
  SerializationService,
  TimeControlService,
} from '..';
import { createInitialBoardPosition, getSan, getUci, toDetailedMove } from '@/utility/chess';
import { AnalysisTimestamp, ClockTimestamp, RecordTimestamp } from '@/utility/date';
import { createAnalysisSeat } from '@/state/__tests__/StateStoreTestUtility';

const _boardId = (file: number, rank: number) => file + (rank * 8);

function _getNode(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}
function _createSettingsSnapshot(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    gameSession: {
      restorePreviousSession: true,
      saveRootPath: 'saves',
      autosaveAfterMoveCount: 1,
      autosaveOnClose: true,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      name: 'New Game',
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
      whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
      blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' }, analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: false,
    },
    gameplay: {
      analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode,
      promotionPolicy: PromotionPolicy.RequireExplicitSelection,
    },
    analysis: {
      resumeLiveAnalysisAfterRestore: true,
      engineInventory: [{
        id: 'engine-1',
        displayName: 'Stockfish',
        entryPath: 'stockfish.exe',
        clientType: EngineClientType.Uci,
        options: { Threads: 1 },
      }],
    },
    appearance: {
      themeMode: ThemeMode.System,
      boardTheme: 'classic',
      pieceTheme: 'classic',
      uiScalePercent: 100,
      boardOrientation: BoardOrientation.White,
      showCoordinates: true,
      highlightLastMove: true,
    },
  };
}
function _createGame(): IGame {
  const timeControl = { preset: TimeControlPreset.Rapid, initialMs: 600000, incrementMs: 0 };
  const rootPosition = createInitialBoardPosition();
  const rootClock = TimeControlService.initialiseClockSnapshot(timeControl);
  const moveTree = MoveHistoryService.createMoveTree(rootClock);
  const move = toDetailedMove(rootPosition, { from: _boardId(4, 1), to: _boardId(4, 3) });
  const started = TimeControlService.startClock(rootClock, PlayerColour.White, new ClockTimestamp('2026-01-01T12:00:00.000Z'));
  const nextClock = TimeControlService.applyMove(started, PlayerColour.White, new ClockTimestamp('2026-01-01T12:00:05.000Z'), timeControl);
  getSan(move);
  getUci(move);
  MoveHistoryService.addMainlineMove(moveTree.root, move, nextClock);

  return {
    schemaVersion: 1,
    metadata: {
      id: 'game-1',
      name: 'Example Game',
      createdAt: new RecordTimestamp('2026-01-01T12:00:00.000Z'),
      updatedAt: new RecordTimestamp('2026-01-01T12:00:05.000Z'),
    },
    gameState: GameState.LiveBlackTurn,
    resultState: ResultState.Ongoing,
    whitePlayer: {
      colour: PlayerColour.White,
      type: PlayerType.Local,
      displayName: 'White',
    },
    blackPlayer: {
      colour: PlayerColour.Black,
      type: PlayerType.Local,
      displayName: 'Black',
    },
    rootPosition,
    moveTree,
    livePath: [0],
    renderedPath: [0],
    timeControl,
    clockSnapshot: nextClock,
    gameplayOptions: {
      allowTakeback: true,
      showLiveAnalysisMoves: false,
    },
    analysis: {
      seats: [],
    },
  };
}

describe('SerializationService', () => {
  it('round-trips empty and populated analysis seats without runtime data or position keys', () => {
    const game = _createGame();
    const seat = createAnalysisSeat();
    seat.updatedAt = new AnalysisTimestamp();
    seat.lines = [{ depth: 10, scoreCp: 25, pv: [], $: { reference: 1 } }];
    seat.assignedEngine.$ = { availability: EngineAvailability.Running, analysisLines: new Map([[4, { depth: 12, pv: [] }]]) };
    game.analysis.seats = [seat, createAnalysisSeat()];
    const raw = SerializationService.serialiseGame(game);
    const restored = SerializationService.deserialiseGame(raw);
    expect(restored.analysis.seats).toHaveLength(2);
    expect(restored.analysis.seats[0]!.lines).toEqual([{ depth: 10, scoreCp: 25, pv: [] }]);
    expect(restored.analysis.seats[1]!.lines).toEqual([]);
    expect(restored.analysis.seats[0]!.assignedEngine.$).toBeUndefined();
    expect(raw).not.toContain('positionKey');
    expect(raw).not.toContain('analysisLines');
    expect(raw).not.toContain('reference');
    expect(restored.renderedPath).toEqual(game.renderedPath);
  });
  it('rejects saved seats with more than three rendered lines', () => {
    const game = _createGame();
    const document = JSON.parse(SerializationService.serialiseGame(game));
    const seat = createAnalysisSeat();
    seat.lines = Array.from({ length: 4 }, () => ({ depth: 1, pv: [] }));
    game.analysis.seats = [seat];
    expect(() => SerializationService.serialiseGame(game)).toThrow(SerializationError);
    document.analysis.seats = [seat];
    expect(() => SerializationService.deserialiseGame(JSON.stringify(document))).toThrow(SerializationError);
  });
  it('round-trips settings snapshots', () => {
    const snapshot = _createSettingsSnapshot();
    const restored = SerializationService.deserialiseSettings(SerializationService.serialiseSettings(snapshot));

    expect(restored).toEqual(snapshot);
  });

  it('round-trips game-session snapshots with saved-games routes', () => {
    const snapshot: IGameSessionSnapshot = {
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'game-1',
      activeRoute: '/saved-games/load/game-1',
    };
    const restored = SerializationService.deserialiseGameSession(SerializationService.serialiseGameSession(snapshot));

    expect(restored).toEqual(snapshot);
  });

  it('rejects invalid game-session snapshots', () => {
    const invalid = JSON.stringify({
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'missing',
      activeRoute: '/home',
    });

    expect(() => SerializationService.deserialiseGameSession(invalid)).toThrow(SerializationError);
  });

  it('round-trips saved games without persisting runtime metadata', () => {
    const game = _createGame();
    (game as unknown as { $?: { isHydrated: boolean } }).$ = { isHydrated: true };
    ((game.whitePlayer as unknown) as { $?: unknown }).$ = { isSelected: true };
    _getNode(game.moveTree, game.livePath!).move = {
      ..._getNode(game.moveTree, game.livePath!).move!,
      $: {
        san: 'e4',
        uci: 'e2e4',
      },
    };

    const serialised = SerializationService.serialiseGame(game);
    const restored = SerializationService.deserialiseGame(serialised);

    expect(serialised).not.toContain('"$"');
    expect(serialised).not.toContain('"fen"');
    expect((restored as IGame & { $?: unknown }).$).toBeUndefined();
    expect((restored.whitePlayer as typeof restored.whitePlayer & { $?: unknown }).$).toBeUndefined();
    expect(_getNode(restored.moveTree, restored.livePath!).move?.$).toBeUndefined();
    expect(PositionIdentityService.buildPositionKey(restored.rootPosition)).toBe(PositionIdentityService.buildPositionKey(game.rootPosition));
  });

  it('rejects an undeclared highlighted move selector alias', () => {
    const invalidGame = JSON.parse(SerializationService.serialiseGame(_createGame())) as Record<string, unknown>;
    invalidGame.highlightPath = invalidGame.renderedPath;
    delete invalidGame.renderedPath;

    expect(() => SerializationService.deserialiseGame(JSON.stringify(invalidGame))).toThrow(SerializationError);
  });

  it('rejects broken move-tree payloads', () => {
    const game = _createGame();
    game.moveTree.root.mainlineChildIndex = 1;

    expect(() => SerializationService.serialiseGame(game)).toThrow(SerializationError);
  });
})
