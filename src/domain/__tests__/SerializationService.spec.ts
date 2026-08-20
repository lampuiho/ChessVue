import { describe, expect, it } from 'vitest'
import {
  AnalysisBranchExitBehaviour,
  BoardOrientation,
  EngineClientType,
  EngineProtocol,
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
  MoveApplicationService,
  MoveHistoryService,
  PositionIdentityService,
  SerializationError,
  SerializationService,
  TimeControlService,
} from '..';
import { GameRuleUtility, MoveNotationUtility } from '@/utility/chess';

const boardId = (file: number, rank: number) => file + (rank * 8);

function getNode(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}
function createSettingsSnapshot(): ISettingsSnapshot {
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
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
      defaultWhitePlayerType: PlayerType.Local,
      defaultBlackPlayerType: PlayerType.Local,
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
        executablePath: 'stockfish.exe',
        clientType: EngineClientType.Uci,
        protocol: EngineProtocol.Uci,
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
function createGame(): IGame {
  const timeControl = { preset: TimeControlPreset.Rapid, initialMs: 600000, incrementMs: 0 };
  const rootPosition = GameRuleUtility.createInitialBoardPosition();
  const rootClock = TimeControlService.initialiseClockSnapshot(timeControl);
  const moveTree = MoveHistoryService.createMoveTree(rootPosition, rootClock);
  const move = GameRuleUtility.genDetailedMove(rootPosition, { from: boardId(4, 1), to: boardId(4, 3) });
  const nextPosition = MoveApplicationService.applyMove(rootPosition, move);
  const started = TimeControlService.startClock(rootClock, PlayerColour.White, '2026-01-01T12:00:00.000Z');
  const nextClock = TimeControlService.applyMove(started, PlayerColour.White, '2026-01-01T12:00:05.000Z', timeControl);
  MoveNotationUtility.getSan(move);
  MoveNotationUtility.getUci(move);
  MoveHistoryService.addMainlineMove(moveTree.root, move, nextPosition, nextClock);

  return {
    schemaVersion: 1,
    metadata: {
      id: 'game-1',
      name: 'Example Game',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:05.000Z',
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
    highlightPath: [0],
    timeControl,
    clockSnapshot: nextClock,
    gameplayOptions: {
      allowTakeback: true,
      showLiveAnalysisMoves: false,
    },
    analysis: {
      snapshots: [],
    },
  };
}

describe('SerializationService', () => {
  it('round-trips settings snapshots', () => {
    const snapshot = createSettingsSnapshot();
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
    const game = createGame();
    (game as unknown as { $?: { isHydrated: boolean } }).$ = { isHydrated: true };
    ((game.whitePlayer as unknown) as { $?: unknown }).$ = { isSelected: true };
    getNode(game.moveTree, game.livePath!).move = {
      ...getNode(game.moveTree, game.livePath!).move!,
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
    expect(getNode(restored.moveTree, restored.livePath!).move?.$).toBeUndefined();
    expect(PositionIdentityService.buildPositionKey(restored.rootPosition)).toBe(PositionIdentityService.buildPositionKey(restored.moveTree.root.position));
  });

  it('rejects broken move-tree payloads', () => {
    const game = createGame();
    game.moveTree.root.mainlineChildIndex = 1;

    expect(() => SerializationService.serialiseGame(game)).toThrow(SerializationError);
  });
})
