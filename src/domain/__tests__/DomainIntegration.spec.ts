import { describe, expect, it } from 'vitest';

import {
  ClockStateKind,
  InteractionContext,
  PlayerColour,
  PlayerType,
  ResultState,
  TimeControlPreset,
  WorkspaceKind,
} from '@/contracts';
import {
  GameRuleService,
  MoveNotationService,
  MoveUpdateService,
  SerializationService,
  TimeControlService,
} from '..';
import { createInitialBoardPosition } from '@/utility/chess';

const boardId = (file: number, rank: number) => file + (rank * 8);

describe('Domain integration', () => {
  it('replays a move through rules, clocks, move tree, and serialisation', () => {
    const timeControl = { preset: TimeControlPreset.Rapid, initialMs: 600000, incrementMs: 2000 };
    const rootPosition = createInitialBoardPosition();
    const rootClock = TimeControlService.initialiseClockSnapshot(timeControl);
    const started = TimeControlService.startClock(rootClock, PlayerColour.White, '2026-01-01T12:00:00.000Z');
    const moveTree = MoveUpdateService.createMoveTree(rootPosition, rootClock);
    const move = GameRuleService.generateLegalMoves(rootPosition).find((candidate) => candidate.from === boardId(4, 1) && candidate.to === boardId(4, 3))!;
    const nextPosition = GameRuleService.applyMove(rootPosition, { ...move, promotionPiece: null });
    const nextClock = TimeControlService.applyMove(started, PlayerColour.White, '2026-01-01T12:00:05.000Z', timeControl);
    const nextTree = MoveUpdateService.addMainlineMove(moveTree, moveTree.rootId, MoveNotationService.decorateMove(rootPosition, move), nextPosition, nextClock);
    const nodeId = nextTree.nodeById[nextTree.rootId]!.mainlineChildId!;

    const workspace = {
      schemaVersion: 1,
      metadata: {
        id: 'integration-game',
        name: 'Integration',
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
      moveTree: nextTree,
      liveNodeId: nodeId,
      visibleNodeId: nodeId,
      timeControl,
      clockSnapshot: nextClock,
      liveAnalysisOptions: { showLiveAnalysisMoves: false },
      analysisAssignment: { assignedEngines: [] },
    };

    const restored = SerializationService.deserialiseGame(SerializationService.serialiseGame(workspace));

    expect(restored.moveTree.nodeById[nodeId]!.move?.$).toBeUndefined();
    expect(restored.clockSnapshot.activeColour).toBe(PlayerColour.Black);
    expect(restored.moveTree.nodeById[nodeId]!.clockSnapshot?.activeColour).toBe(PlayerColour.Black);
  });
});
