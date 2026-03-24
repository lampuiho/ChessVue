import { describe, expect, it } from 'vitest'

import {
  createInitialBoardPosition,
  GameRuleService,
  MoveUpdateService,
  SerializationError,
  SerializationService,
  TimeControlService,
  type IGameWorkspace,
  type IRecentGamesSnapshot,
  type ISettingsSnapshot,
} from '../index'

function createSettingsSnapshot(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    session: {
      restorePreviousSession: true,
      autosaveEnabled: true,
      autosaveDebounceMs: 750,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: 'untimed', initialMs: null, incrementMs: 0 },
      defaultWhitePlayerType: 'local',
      defaultBlackPlayerType: 'local',
    },
    gameplay: {
      takebackPolicy: 'rewriteMainline',
      confirmMainlineRewrite: true,
      analysisBranchExitBehaviour: 'returnToLiveNode',
      promotionPolicy: 'requireExplicitSelection',
      confirmPruneFutureMoves: true,
      allowRootPrune: false,
    },
    analysis: {
      resumeLiveAnalysisAfterRestore: true,
      engineInventory: [],
    },
    appearance: {
      themeMode: 'system',
      boardTheme: 'classic',
      pieceTheme: 'classic',
      uiScalePercent: 100,
      boardOrientation: 'white',
      showCoordinates: true,
      highlightLastMove: true,
    },
  }
}

function createWorkspace(): IGameWorkspace {
  const timeControl = { preset: 'rapid' as const, initialMs: 600000, incrementMs: 0 }
  const rootPosition = createInitialBoardPosition()
  const rootClock = TimeControlService.initialiseClockSnapshot(timeControl)
  const moveTree = MoveUpdateService.createMoveTree(rootPosition, rootClock)
  const move = GameRuleService.generateLegalMoves(rootPosition).find((candidate) => candidate.uci === 'e2e4')!
  const nextPosition = GameRuleService.applyMove(rootPosition, { ...move, promotionPiece: null })
  const started = TimeControlService.startClock(rootClock, 'white', '2026-01-01T12:00:00.000Z')
  const nextClock = TimeControlService.applyMove(started, 'white', '2026-01-01T12:00:05.000Z', timeControl)
  const updatedTree = MoveUpdateService.addMainlineMove(moveTree, moveTree.rootId, move, nextPosition, nextClock)
  const liveNodeId = updatedTree.nodeById[updatedTree.rootId].mainlineChildId!

  return {
    schemaVersion: 1,
    metadata: {
      id: 'game-1',
      name: 'Example Game',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:05.000Z',
    },
    workspaceKind: 'liveGame',
    interactionContext: 'currentPosition',
    clockState: 'running',
    resultState: 'ongoing',
    resultReason: null,
    drawOfferState: null,
    whitePlayer: {
      colour: 'white',
      type: 'local',
      displayName: 'White',
      assignedEngine: null,
    },
    blackPlayer: {
      colour: 'black',
      type: 'local',
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
  }
}

describe('SerializationService', () => {
  it('round-trips settings snapshots', () => {
    const snapshot = createSettingsSnapshot()
    const restored = SerializationService.deserialiseSettings(SerializationService.serialiseSettings(snapshot))

    expect(restored).toEqual(snapshot)
  })

  it('normalises and deduplicates recent games by latest saved time', () => {
    const snapshot: IRecentGamesSnapshot = {
      schemaVersion: 1,
      entries: [
        { gameId: 'a', displayName: 'Old', sourceKind: 'autosave', filePath: null, lastSavedAtUtc: '2026-01-01T12:00:00.000Z' },
        { gameId: 'a', displayName: 'New', sourceKind: 'manualFile', filePath: 'game.json', lastSavedAtUtc: '2026-01-01T12:05:00.000Z' },
      ],
    }

    const restored = SerializationService.deserialiseRecentGames(SerializationService.serialiseRecentGames(snapshot))

    expect(restored.entries).toHaveLength(1)
    expect(restored.entries[0].displayName).toBe('New')
  })

  it('rejects invalid game-session snapshots', () => {
    const invalid = JSON.stringify({
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'missing',
      activeRoute: '/home',
    })

    expect(() => SerializationService.deserialiseGameSession(invalid)).toThrow(SerializationError)
  })

  it('round-trips saved games and normalises stale fen values', () => {
    const workspace = createWorkspace()
    workspace.boardRoot.fen = 'stale'
    workspace.moveTree.nodeById[workspace.moveTree.rootId].position.fen = 'stale'

    const restored = SerializationService.deserialiseGame(SerializationService.serialiseGame(workspace))

    expect(restored.boardRoot.fen).not.toBe('stale')
    expect(restored.boardRoot.fen).toBe(restored.moveTree.nodeById[restored.moveTree.rootId].position.fen)
  })

  it('rejects broken move-tree payloads', () => {
    const workspace = createWorkspace()
    const rootNode = workspace.moveTree.nodeById[workspace.moveTree.rootId]
    rootNode.childIds.push('missing-node')

    expect(() => SerializationService.serialiseGame(workspace)).toThrow(SerializationError)
  })
})
