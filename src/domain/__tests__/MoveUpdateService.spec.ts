import { describe, expect, it } from 'vitest'
import { MoveBranchKind, MoveKind, PieceKind, PlayerColour, TimeControlPreset, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '@/contracts';
import { MoveUpdateService, TimeControlService } from '..'
import { createInitialBoardPosition, createSparseBoard } from '@/utility/chess'

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

describe('MoveUpdateService', () => {
  it('creates a root-only tree with the supplied clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), clockSnapshot)

    expect(tree.root.move).toBeUndefined()
    expect(tree.root.clockSnapshot).toEqual(clockSnapshot)
  })

  it('adds a mainline move and demotes the previous continuation to a variation', () => {
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition())
    const first = MoveUpdateService.addMainlineMove(tree.root, sampleMove, createInitialBoardPosition())
    const secondMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    const second = MoveUpdateService.addMainlineMove(first.root, secondMove, createInitialBoardPosition())

    expect(second.root.children).toHaveLength(2)
    expect(second.root.children[0]!.branchKind).toBe(MoveBranchKind.Variation)
    expect(second.root.children[1]!.branchKind).toBe(MoveBranchKind.Mainline)
    expect(second.root.mainlineChildIndex).toBe(1)
  })

  it('adds analysis moves without changing the mainline and inherits the parent clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Blitz,
      initialMs: 300000,
      incrementMs: 0,
    })
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), clockSnapshot)
    const analysisPosition = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])
    const analysisTree = MoveUpdateService.addAnalysisMove(tree.root, sampleMove, analysisPosition)
    const analysisNode = getNode(analysisTree, [0])

    expect(analysisTree.root.mainlineChildIndex).toBeUndefined()
    expect(analysisNode.branchKind).toBe(MoveBranchKind.Analysis)
    expect(analysisNode.clockSnapshot).toEqual(clockSnapshot)
  })

  it('rewrites the selected child to the mainline', () => {
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition())
    const first = MoveUpdateService.addAnalysisMove(tree.root, sampleMove, createInitialBoardPosition())
    const secondMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    const second = MoveUpdateService.addAnalysisMove(first.root, secondMove, createInitialBoardPosition())
    const rewritten = MoveUpdateService.rewriteMainline(second.root, second.root.children[1]!)

    expect(rewritten.root.mainlineChildIndex).toBe(1)
    expect(rewritten.root.children[1]!.branchKind).toBe(MoveBranchKind.Mainline)
  })

  it('takes back from the current mainline leaf and prunes future moves', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveUpdateService.createMoveTree(createInitialBoardPosition(), clockSnapshot)
    const first = MoveUpdateService.addMainlineMove(tree.root, sampleMove, createInitialBoardPosition(), clockSnapshot)
    const secondMove: IMove = { ...sampleMove, from: boardId(4, 6), to: boardId(4, 4), movingColour: PlayerColour.Black }
    const second = MoveUpdateService.addMainlineMove(first.root.children[0]!, secondMove, createInitialBoardPosition(), clockSnapshot)
    const takenBack = MoveUpdateService.takeBack(second.root.children[0]!.children[0]!, 1)

    expect(getNode(takenBack, [0]).mainlineChildIndex).toBeUndefined()
    expect(getNode(takenBack, [0]).children).toHaveLength(0)
  })

  it('replaces the board root with a fresh one-node tree', () => {
    const replacement = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])
    const tree = MoveUpdateService.replaceBoardRoot(replacement)

    expect(tree.root.children).toHaveLength(0)
    expect(tree.root.position).toEqual(replacement)
  })
})
