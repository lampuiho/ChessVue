import { describe, expect, it } from 'vitest'

import {
  createInitialBoardPosition,
  GameRuleService,
  MoveUpdateService,
  SerializationService,
  TimeControlService,
} from '../index'

describe('Domain integration', () => {
  it('replays a move through rules, clocks, move tree, and serialisation', () => {
    const timeControl = { preset: 'rapid' as const, initialMs: 600000, incrementMs: 2000 }
    const rootPosition = createInitialBoardPosition()
    const rootClock = TimeControlService.initialiseClockSnapshot(timeControl)
    const started = TimeControlService.startClock(rootClock, 'white', '2026-01-01T12:00:00.000Z')
    const moveTree = MoveUpdateService.createMoveTree(rootPosition, rootClock)
    const move = GameRuleService.generateLegalMoves(rootPosition).find((candidate) => candidate.uci === 'e2e4')!
    const nextPosition = GameRuleService.applyMove(rootPosition, { ...move, promotionPiece: null })
    const nextClock = TimeControlService.applyMove(started, 'white', '2026-01-01T12:00:05.000Z', timeControl)
    const nextTree = MoveUpdateService.addMainlineMove(moveTree, moveTree.rootId, move, nextPosition, nextClock)
    const nodeId = nextTree.nodeById[nextTree.rootId].mainlineChildId!

    const workspace = {
      schemaVersion: 1,
      metadata: {
        id: 'integration-game',
        name: 'Integration',
        createdAt: '2026-01-01T12:00:00.000Z',
        updatedAt: '2026-01-01T12:00:05.000Z',
      },
      workspaceKind: 'liveGame' as const,
      interactionContext: 'currentPosition' as const,
      clockState: 'running' as const,
      resultState: 'ongoing' as const,
      resultReason: null,
      drawOfferState: null,
      whitePlayer: {
        colour: 'white' as const,
        type: 'local' as const,
        displayName: 'White',
        assignedEngine: null,
      },
      blackPlayer: {
        colour: 'black' as const,
        type: 'local' as const,
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
    }

    const restored = SerializationService.deserialiseGame(SerializationService.serialiseGame(workspace))

    expect(restored.moveTree.nodeById[nodeId].move?.uci).toBe('e2e4')
    expect(restored.clockSnapshot.activeColour).toBe('black')
    expect(restored.moveTree.nodeById[nodeId].clockSnapshot?.activeColour).toBe('black')
  })
})
