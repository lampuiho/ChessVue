import { describe, expect, it } from 'vitest'
import { MoveKind, MoveNodeKind, PieceKind, PlayerColour, TimeControlPreset, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '@/contracts';
import { MoveHistoryService, TimeControlService } from '..'

const boardId = (file: number, rank: number) => file + (rank * 8);

const sampleMove: IMove = {
  from: boardId(4, 1),
  to: boardId(4, 3),
  kind: MoveKind.Normal,
  movingColour: PlayerColour.White,
  movingPiece: PieceKind.Pawn,
}

function getNode(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}

describe('MoveHistoryService', () => {
  it('removes released analysis children while preserving actual mainline and array ownership', () => {
    const tree = MoveHistoryService.createMoveTree();
    const analysis = MoveHistoryService.addAnalysisMove(tree.root, sampleMove);
    const actual = MoveHistoryService.addMainlineMove(tree.root, sampleMove);
    const children = tree.root.children;
    expect(MoveHistoryService.pruneAnalysisMoves(tree.root)).toBe(true);
    expect(tree.root.children).toBe(children);
    expect(children).toEqual([actual]);
    expect(tree.root.mainlineChildIndex).toBe(0);
    expect(actual.$?.parent).toBe(tree.root);
    expect(analysis.$).toBeUndefined();
  });
  it('does not change an actual continuation when there are no released analysis children', () => {
    const tree = MoveHistoryService.createMoveTree();
    const actual = MoveHistoryService.addMainlineMove(tree.root, sampleMove);
    expect(MoveHistoryService.pruneAnalysisMoves(tree.root)).toBe(false);
    expect(tree.root.children).toEqual([actual]);
    expect(tree.root.mainlineChildIndex).toBe(0);
  });
  it('creates a root-only tree with the supplied clock snapshot', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveHistoryService.createMoveTree(clockSnapshot)

    expect(tree.root.move).toBeUndefined()
    expect(tree.root.clockSnapshot).toEqual(clockSnapshot)
  })

  it('adds a mainline move and keeps existing continuations as live nodes', () => {
    const tree = MoveHistoryService.createMoveTree()
    MoveHistoryService.addMainlineMove(tree.root, sampleMove)
    const secondMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    MoveHistoryService.addMainlineMove(tree.root, secondMove)

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
    const tree = MoveHistoryService.createMoveTree(clockSnapshot)
    MoveHistoryService.addAnalysisMove(tree.root, sampleMove)
    const analysisNode = getNode(tree, [0])

    expect(tree.root.mainlineChildIndex).toBeUndefined()
    expect(analysisNode.kind).toBe(MoveNodeKind.Analysis)
    expect(analysisNode.clockSnapshot).toEqual(clockSnapshot)
  })

  it('rewrites the selected child to the mainline', () => {
    const tree = MoveHistoryService.createMoveTree()
    MoveHistoryService.addAnalysisMove(tree.root, sampleMove)
    const secondMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    MoveHistoryService.addAnalysisMove(tree.root, secondMove)
    MoveHistoryService.rewriteMainline(tree.root, tree.root.children[1]!)

    expect(tree.root.mainlineChildIndex).toBe(1)
    expect(tree.root.children[1]!.kind).toBe(MoveNodeKind.Live)
  })

  it('takes back from the current mainline leaf and prunes future moves', () => {
    const clockSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const tree = MoveHistoryService.createMoveTree(clockSnapshot)
    MoveHistoryService.addMainlineMove(tree.root, sampleMove, clockSnapshot)
    const secondMove: IMove = { ...sampleMove, from: boardId(4, 6), to: boardId(4, 4), movingColour: PlayerColour.Black }
    MoveHistoryService.addMainlineMove(tree.root.children[0]!, secondMove, clockSnapshot)
    const retainedNode = MoveHistoryService.takeBack(tree.root.children[0]!.children[0]!, 1)

    expect(retainedNode).toBe(tree.root.children[0])
    expect(tree.root.children[0]!.mainlineChildIndex).toBeUndefined()
    expect(tree.root.children[0]!.children).toHaveLength(0)
  })

  it('takes back multiple moves without replacing the tree or retained children array', () => {
    const tree = MoveHistoryService.createMoveTree()
    const firstNode = MoveHistoryService.addMainlineMove(tree.root, sampleMove)
    const retainedChildren = firstNode.children
    const secondMove: IMove = { ...sampleMove, from: boardId(4, 6), to: boardId(4, 4), movingColour: PlayerColour.Black }
    const secondNode = MoveHistoryService.addMainlineMove(firstNode, secondMove)
    const thirdMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }
    const thirdNode = MoveHistoryService.addMainlineMove(secondNode, thirdMove)

    const retainedNode = MoveHistoryService.takeBack(thirdNode, 2)

    expect(retainedNode).toBe(firstNode)
    expect(tree.root.children[0]).toBe(firstNode)
    expect(firstNode.children).toBe(retainedChildren)
    expect(firstNode.children).toHaveLength(0)
    expect(secondNode.$).toBeUndefined()
  })

  describe('getMoveSequence', () => {
    const secondMove: IMove = { ...sampleMove, from: boardId(4, 6), to: boardId(4, 4), movingColour: PlayerColour.Black }
    const thirdMove: IMove = { ...sampleMove, from: boardId(3, 1), to: boardId(3, 3) }

    function createThreePlyTree(): IMoveTree {
      const tree = MoveHistoryService.createMoveTree()
      const firstNode = MoveHistoryService.addMainlineMove(tree.root, sampleMove)
      const secondNode = MoveHistoryService.addMainlineMove(firstNode, secondMove)
      MoveHistoryService.addMainlineMove(secondNode, thirdMove)
      return tree
    }

    it('returns no moves for the root path', () => {
      expect(MoveHistoryService.getMoveSequence(createThreePlyTree(), [])).toEqual([])
    })

    it('returns a single move for a one-ply path', () => {
      expect(MoveHistoryService.getMoveSequence(createThreePlyTree(), [0])).toEqual([sampleMove])
    })

    it('returns every move along a multi-ply path in order', () => {
      expect(MoveHistoryService.getMoveSequence(createThreePlyTree(), [0, 0, 0])).toEqual([sampleMove, secondMove, thirdMove])
    })

    it('returns only the moves after the reference node when fromPath is supplied', () => {
      expect(MoveHistoryService.getMoveSequence(createThreePlyTree(), [0, 0, 0], [0])).toEqual([secondMove, thirdMove])
    })

    it('throws when fromPath is not a prefix of the target path', () => {
      expect(() => MoveHistoryService.getMoveSequence(createThreePlyTree(), [0], [0, 0])).toThrow(/prefix/)
    })

    it('throws when the target path does not exist', () => {
      expect(() => MoveHistoryService.getMoveSequence(createThreePlyTree(), [0, 1])).toThrow(/does not exist/)
    })
  })
})
