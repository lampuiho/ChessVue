import { describe, expect, it } from 'vitest'

import { createInitialBoardPosition, createSparseBoard, MoveUpdateService, TimeControlService, type IMove } from '../index'

const sampleMove: IMove = {
  from: 'e2',
  to: 'e4',
  kind: 'normal',
  movingColour: 'white',
  promotionPiece: null,
  san: 'e4',
  uci: 'e2e4',
}

describe('MoveUpdateService', () => {
  it('creates a root-only tree with the supplied clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: 'rapid',
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), clockSnapshot)
    const rootNode = tree.nodeById[tree.rootId]

    expect(rootNode.move).toBeNull()
    expect(rootNode.clockSnapshot).toEqual(clockSnapshot)
  })

  it('adds a mainline move and demotes the previous continuation to a variation', () => {
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), null)
    const first = MoveUpdateService.addMainlineMove(tree, tree.rootId, sampleMove, createInitialBoardPosition(), null)
    const secondMove: IMove = { ...sampleMove, from: 'd2', to: 'd4', san: 'd4', uci: 'd2d4' }
    const second = MoveUpdateService.addMainlineMove(first, first.rootId, secondMove, createInitialBoardPosition(), null)

    const childIds = second.nodeById[second.rootId].childIds
    expect(childIds).toHaveLength(2)
    expect(second.nodeById[childIds[0]].branchKind).toBe('variation')
    expect(second.nodeById[childIds[1]].branchKind).toBe('mainline')
  })

  it('adds analysis moves without changing the mainline and inherits the parent clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: 'blitz',
      initialMs: 300000,
      incrementMs: 0,
    })
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), clockSnapshot)
    const analysisPosition = createSparseBoard([
      { square: 'a1', piece: { kind: 'king', colour: 'white' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ])
    const analysisTree = MoveUpdateService.addAnalysisMove(tree, tree.rootId, sampleMove, analysisPosition)
    const analysisNode = analysisTree.nodeById[analysisTree.nodeById[analysisTree.rootId].childIds[0]]

    expect(analysisTree.nodeById[analysisTree.rootId].mainlineChildId).toBeNull()
    expect(analysisNode.branchKind).toBe('analysis')
    expect(analysisNode.clockSnapshot).toEqual(clockSnapshot)
  })

  it('rewrites the selected child to the mainline', () => {
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), null)
    const first = MoveUpdateService.addAnalysisMove(tree, tree.rootId, sampleMove, createInitialBoardPosition())
    const secondMove: IMove = { ...sampleMove, from: 'd2', to: 'd4', san: 'd4', uci: 'd2d4' }
    const second = MoveUpdateService.addAnalysisMove(first, first.rootId, secondMove, createInitialBoardPosition())
    const promotedId = second.nodeById[second.rootId].childIds[1]
    const rewritten = MoveUpdateService.rewriteMainline(second, second.rootId, promotedId)

    expect(rewritten.nodeById[rewritten.rootId].mainlineChildId).toBe(promotedId)
    expect(rewritten.nodeById[promotedId].branchKind).toBe('mainline')
  })

  it('takes back from the current mainline leaf and prunes future moves', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: 'rapid',
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), clockSnapshot)
    const first = MoveUpdateService.addMainlineMove(tree, tree.rootId, sampleMove, createInitialBoardPosition(), clockSnapshot)
    const childId = first.nodeById[first.rootId].mainlineChildId!
    const secondMove: IMove = { ...sampleMove, from: 'e7', to: 'e5', movingColour: 'black', san: '...e5', uci: 'e7e5' }
    const second = MoveUpdateService.addMainlineMove(first, childId, secondMove, createInitialBoardPosition(), clockSnapshot)
    const takenBack = MoveUpdateService.takeBack(second, 1)

    expect(takenBack.nodeById[childId].mainlineChildId).toBeNull()
    expect(Object.keys(takenBack.nodeById)).toHaveLength(2)
  })

  it('replaces the board root with a fresh one-node tree', () => {
    const replacement = createSparseBoard([
      { square: 'a1', piece: { kind: 'king', colour: 'white' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ])
    const tree = MoveUpdateService.replaceBoardRoot(replacement, null)

    expect(Object.keys(tree.nodeById)).toHaveLength(1)
    expect(tree.nodeById[tree.rootId].position.fen).toBe(replacement.fen)
  })
})
