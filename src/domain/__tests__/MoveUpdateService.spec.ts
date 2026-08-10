import { describe, expect, it } from 'vitest'
import { MoveKind, MoveNodeKind, PieceKind, PlayerColour, TimeControlPreset, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '@/contracts';
import { GameRuleService, MoveHistoryService, TimeControlService } from '..'
import { createSparseBoard } from '@/utility/chess'

const boardId = (file: number, rank: number) => file + (rank * 8);

const sampleMove: IMove = {
  from: boardId(4, 1),
  to: boardId(4, 3),
  kind: MoveKind.Normal,
  movingColour: PlayerColour.White,
}

function getNode(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}

describe('MoveHistoryService', () => {
  it('creates a root-only tree with the supplied clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveHistoryService.createMoveTree(GameRuleService.createInitialBoardPosition(), clockSnapshot)

    expect(tree.root.move).toBeUndefined()
    expect(tree.root.clockSnapshot).toEqual(clockSnapshot)
  })

  it('adds a mainline move and keeps existing continuations as live nodes', () => {
    const tree = MoveHistoryService.createMoveTree(GameRuleService.createInitialBoardPosition())
    MoveHistoryService.addMainlineMove(tree.root, sampleMove, GameRuleService.createInitialBoardPosition())
    const secondMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    MoveHistoryService.addMainlineMove(tree.root, secondMove, GameRuleService.createInitialBoardPosition())

    expect(tree.root.children).toHaveLength(2)
    expect(tree.root.children[0]!.kind).toBe(MoveNodeKind.Live)
    expect(tree.root.children[1]!.kind).toBe(MoveNodeKind.Live)
    expect(tree.root.mainlineChildIndex).toBe(1)
  })

  it('adds analysis moves without changing the mainline and inherits the parent clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Blitz,
      initialMs: 300000,
      incrementMs: 0,
    })
    const tree = MoveHistoryService.createMoveTree(GameRuleService.createInitialBoardPosition(), clockSnapshot)
    const analysisPosition = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])
    MoveHistoryService.addAnalysisMove(tree.root, sampleMove, analysisPosition)
    const analysisNode = getNode(tree, [0])

    expect(tree.root.mainlineChildIndex).toBeUndefined()
    expect(analysisNode.kind).toBe(MoveNodeKind.Analysis)
    expect(analysisNode.clockSnapshot).toEqual(clockSnapshot)
  })

  it('rewrites the selected child to the mainline', () => {
    const tree = MoveHistoryService.createMoveTree(GameRuleService.createInitialBoardPosition())
    MoveHistoryService.addAnalysisMove(tree.root, sampleMove, GameRuleService.createInitialBoardPosition())
    const secondMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    MoveHistoryService.addAnalysisMove(tree.root, secondMove, GameRuleService.createInitialBoardPosition())
    const rewritten = MoveHistoryService.rewriteMainline(tree.root, tree.root.children[1]!)

    expect(rewritten.root.mainlineChildIndex).toBe(1)
    expect(rewritten.root.children[1]!.kind).toBe(MoveNodeKind.Live)
  })

  it('takes back from the current mainline leaf and prunes future moves', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveHistoryService.createMoveTree(GameRuleService.createInitialBoardPosition(), clockSnapshot)
    MoveHistoryService.addMainlineMove(tree.root, sampleMove, GameRuleService.createInitialBoardPosition(), clockSnapshot)
    const secondMove: IMove = { ...sampleMove, from: boardId(4, 6), to: boardId(4, 4), movingColour: PlayerColour.Black }
    MoveHistoryService.addMainlineMove(tree.root.children[0]!, secondMove, GameRuleService.createInitialBoardPosition(), clockSnapshot)
    const takenBack = MoveHistoryService.takeBack(tree.root.children[0]!.children[0]!, 1)

    expect(getNode(takenBack, [0]).mainlineChildIndex).toBeUndefined()
    expect(getNode(takenBack, [0]).children).toHaveLength(0)
  })

  it('replaces the board root with a fresh one-node tree', () => {
    const replacement = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])
    const tree = MoveHistoryService.replaceBoardRoot(replacement)

    expect(tree.root.children).toHaveLength(0)
    expect(tree.root.position).toEqual(replacement)
  })
})
