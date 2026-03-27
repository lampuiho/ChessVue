import { describe, expect, it } from 'vitest'
import {
  AnalysisBranchExitBehaviour,
  BoardOrientation,
  ClockStateKind,
  InteractionContext,
  PlayerColour,
  PlayerType,
  PromotionPolicy,
  RecentGameSourceKind,
  ResultState,
  TakebackPolicy,
  ThemeMode,
  TimeControlPreset,
  WorkspaceKind,
  type IGameSessionSnapshot,
  type IGameWorkspace,
  type IRecentGamesSnapshot,
  type ISettingsSnapshot,
} from '@/contracts';
import {
  createInitialBoardPosition,
  GameRuleService,
  MoveNotationService,
  MoveUpdateService,
  PositionIdentityService,
  SerializationError,
  SerializationService,
  TimeControlService,
} from '..';

const boardId = (file: number, rank: number) => file + (rank * 8);

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
      confirmPruneFutureMoves: true,
      allowRootPrune: false,
    },
    analysis: {
      resumeLiveAnalysisAfterRestore: true,
      engineInventory: [],
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
function createWorkspace(): IGameWorkspace {
  const timeControl = { preset: TimeControlPreset.Rapid, initialMs: 600000, incrementMs: 0 };
  const rootPosition = createInitialBoardPosition();
  const rootClock = TimeControlService.initialiseClockSnapshot(timeControl);
  const moveTree = MoveUpdateService.createMoveTree(rootPosition, rootClock);
  const move = GameRuleService.generateLegalMoves(rootPosition).find((candidate) => candidate.from === boardId(4, 1) && candidate.to === boardId(4, 3))!;
  const nextPosition = GameRuleService.applyMove(rootPosition, { ...move, promotionPiece: null });
  const started = TimeControlService.startClock(rootClock, PlayerColour.White, '2026-01-01T12:00:00.000Z');
  const nextClock = TimeControlService.applyMove(started, PlayerColour.White, '2026-01-01T12:00:05.000Z', timeControl);
  const updatedTree = MoveUpdateService.addMainlineMove(moveTree, moveTree.rootId, MoveNotationService.decorateMove(rootPosition, move), nextPosition, nextClock);
  const liveNodeId = updatedTree.nodeById[updatedTree.rootId]!.mainlineChildId!;

  return {
    schemaVersion: 1,
    metadata: {
      id: 'game-1',
      name: 'Example Game',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:05.000Z',
    },
    workspaceKind: WorkspaceKind.LiveGame,
    interactionContext: InteractionContext.CurrentPosition,
    clockState: ClockStateKind.Running,
    resultState: ResultState.Ongoing,
    resultReason: null,
    drawOfferState: null,
    whitePlayer: {
      colour: PlayerColour.White,
      type: PlayerType.Local,
      displayName: 'White',
      assignedEngine: null,
    },
    blackPlayer: {
      colour: PlayerColour.Black,
      type: PlayerType.Local,
      displayName: 'Black',
      assignedEngine: null,
    },
    boardRoot: rootPosition,
    moveTree: updatedTree,
    liveNodeId,
    visibleNodeId: liveNodeId,
    timeControl,
    clockSnapshot: nextClock,
    liveAnalysisOptions: {
      showLiveAnalysisMoves: false,
    },
    analysisAssignment: {
      assignedEngines: [],
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

  it('normalises and deduplicates recent games by latest saved time', () => {
    const snapshot: IRecentGamesSnapshot = {
      schemaVersion: 1,
      entries: [
        { gameId: 'a', displayName: 'Old', sourceKind: RecentGameSourceKind.Autosave, filePath: null, lastSavedAtUtc: '2026-01-01T12:00:00.000Z' },
        { gameId: 'a', displayName: 'New', sourceKind: RecentGameSourceKind.SaveFile, filePath: 'game.json', lastSavedAtUtc: '2026-01-01T12:05:00.000Z' },
      ],
    };

    const restored = SerializationService.deserialiseRecentGames(SerializationService.serialiseRecentGames(snapshot));

    expect(restored.entries).toHaveLength(1);
    expect(restored.entries[0]!.displayName).toBe('New');
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
    const workspace = createWorkspace();
    workspace.moveTree.nodeById[workspace.liveNodeId!]!.move = {
      ...workspace.moveTree.nodeById[workspace.liveNodeId!]!.move!,
      $: {
        san: 'e4',
        uci: 'e2e4',
      },
    };

    const serialised = SerializationService.serialiseGame(workspace);
    const restored = SerializationService.deserialiseGame(serialised);

    expect(serialised).not.toContain('"$"');
    expect(serialised).not.toContain('"fen"');
    expect(restored.moveTree.nodeById[restored.liveNodeId!]!.move?.$).toBeUndefined();
    expect(PositionIdentityService.buildPositionKey(restored.boardRoot)).toBe(PositionIdentityService.buildPositionKey(restored.moveTree.nodeById[restored.moveTree.rootId]!.position));
  });

  it('rejects broken move-tree payloads', () => {
    const workspace = createWorkspace();
    const rootNode = workspace.moveTree.nodeById[workspace.moveTree.rootId]!;
    rootNode.childIds.push('missing-node');

    expect(() => SerializationService.serialiseGame(workspace)).toThrow(SerializationError);
  });
});