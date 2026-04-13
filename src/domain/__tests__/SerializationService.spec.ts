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
  TakebackPolicy,
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
  GameRuleService,
  MoveNotationService,
  MoveUpdateService,
  PositionIdentityService,
  SerializationError,
  SerializationService,
  TimeControlService,
} from '..';
import { createInitialBoardPosition } from '@/utility/chess';

const boardId = (file: number, rank: number) => file + (rank * 8);

function getNode(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}
function createSettingsSnapshot(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    session: {
      restorePreviousSession: true,
      saveRootPath: 'saves',
      autosaveAfterMoveCount: 1,
      autosaveOnClose: true,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: TimeControlPreset.Untimed, initialMs: null, incrementMs: 0 },
      defaultWhitePlayerType: PlayerType.Local,
      defaultBlackPlayerType: PlayerType.Local,
    },
    gameplay: {
      takebackPolicy: TakebackPolicy.RewriteMainline,
      confirmMainlineRewrite: true,
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
  const rootPosition = createInitialBoardPosition();
  const rootClock = TimeControlService.initialiseClockSnapshot(timeControl);
  const moveTree = MoveUpdateService.createMoveTree(rootPosition, rootClock);
  const move = GameRuleService.generateLegalMoves(rootPosition).find((candidate) => candidate.from === boardId(4, 1) && candidate.to === boardId(4, 3))!;
  const nextPosition = GameRuleService.applyMove(rootPosition, { ...move, promotionPiece: null });
  const started = TimeControlService.startClock(rootClock, PlayerColour.White, '2026-01-01T12:00:00.000Z');
  const nextClock = TimeControlService.applyMove(started, PlayerColour.White, '2026-01-01T12:00:05.000Z', timeControl);
  const updatedTree = MoveUpdateService.addMainlineMove(moveTree, [], MoveNotationService.decorateMove(rootPosition, move), nextPosition, nextClock);

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
    resultReason: null,
    drawOfferState: null,
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
    boardRoot: rootPosition,
    moveTree: updatedTree,
    livePath: [0],
    highlightPath: [0],
    timeControl,
    clockSnapshot: nextClock,
    liveAnalysisOptions: {
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
    expect(getNode(restored.moveTree, restored.livePath!).move?.$).toBeUndefined();
    expect(PositionIdentityService.buildPositionKey(restored.boardRoot)).toBe(PositionIdentityService.buildPositionKey(restored.moveTree.root.position));
  });

  it('rejects broken move-tree payloads', () => {
    const game = createGame();
    game.moveTree.root.mainlineChildIndex = 1;

    expect(() => SerializationService.serialiseGame(game)).toThrow(SerializationError);
  });
})
