import { describe, expect, it } from 'vitest'
import { MoveKind, MoveNodeKind, PieceKind, PlayerColour, TimeControlPreset, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '@/contracts';
import { MoveHistoryService, TimeControlService } from '..'

const _boardId = (file: number, rank: number) => file + (rank * 8);

const sampleMove: IMove = {
  from: _boardId(4, 1),
  to: _boardId(4, 3),
  kind: MoveKind.Normal,
  movingColour: PlayerColour.White,
  movingPiece: PieceKind.Pawn,
}

function _getNode(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}

describe('MoveHistoryService', () => {
  it('retains analysis history when an actual sibling becomes the mainline', () => {
    const tree = MoveHistoryService.createMoveTree();
    const analysis = MoveHistoryService.addAnalysisMove(tree.root, sampleMove);
    const actual = MoveHistoryService.addMainlineMove(tree.root, sampleMove);
    const children = tree.root.children;
    expect(tree.root.children).toBe(children);
    expect(children).toEqual([analysis, actual]);
    expect(tree.root.mainlineChildIndex).toBe(1);
    expect(actual.$?.parent).toBe(tree.root);
    expect(analysis.$?.parent).toBe(tree.root);
  });
  it('keeps an unrelated actual continuation when another parent is explicitly pruned', () => {
    const tree = MoveHistoryService.createMoveTree();
    const analysis = MoveHistoryService.addAnalysisMove(tree.root, sampleMove);
    MoveHistoryService.addAnalysisMove(analysis, sampleMove);
    const actual = MoveHistoryService.addMainlineMove(tree.root, sampleMove);
    MoveHistoryService.pruneFutureMoves(analysis);
    expect(tree.root.children).toEqual([analysis, actual]);
    expect(analysis.children).toEqual([]);
    expect(tree.root.mainlineChildIndex).toBe(1);
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
    const secondMove: IMove = { ...sampleMove, from: _boardId(3, 1), to: _boardId(3, 3) }
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
    const analysisNode = _getNode(tree, [0])

    expect(tree.root.mainlineChildIndex).toBeUndefined()
    expect(analysisNode.kind).toBe(MoveNodeKind.Analysis)
    expect(analysisNode.clockSnapshot).toEqual(clockSnapshot)
  })

  it('rewrites the selected child to the mainline', () => {
    const tree = MoveHistoryService.createMoveTree()
    MoveHistoryService.addAnalysisMove(tree.root, sampleMove)
    const secondMove: IMove = { ...sampleMove, from: _boardId(3, 1), to: _boardId(3, 3) }
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
    const secondMove: IMove = { ...sampleMove, from: _boardId(4, 6), to: _boardId(4, 4), movingColour: PlayerColour.Black }
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
    const secondMove: IMove = { ...sampleMove, from: _boardId(4, 6), to: _boardId(4, 4), movingColour: PlayerColour.Black }
    const secondNode = MoveHistoryService.addMainlineMove(firstNode, secondMove)
    const thirdMove: IMove = { ...sampleMove, from: _boardId(3, 1), to: _boardId(3, 3) }
    const thirdNode = MoveHistoryService.addMainlineMove(secondNode, thirdMove)

    const retainedNode = MoveHistoryService.takeBack(thirdNode, 2)

    expect(retainedNode).toBe(firstNode)
    expect(tree.root.children[0]).toBe(firstNode)
    expect(firstNode.children).toBe(retainedChildren)
    expect(firstNode.children).toHaveLength(0)
    expect(secondNode.$).toBeUndefined()
  })

  describe('getMoveSequence', () => {
    const secondMove: IMove = { ...sampleMove, from: _boardId(4, 6), to: _boardId(4, 4), movingColour: PlayerColour.Black }
    const thirdMove: IMove = { ...sampleMove, from: _boardId(3, 1), to: _boardId(3, 3) }

    function _createThreePlyTree(): IMoveTree {
      const tree = MoveHistoryService.createMoveTree()
      const firstNode = MoveHistoryService.addMainlineMove(tree.root, sampleMove)
      const secondNode = MoveHistoryService.addMainlineMove(firstNode, secondMove)
      MoveHistoryService.addMainlineMove(secondNode, thirdMove)
      return tree
    }

    it('returns no moves for the root path', () => {
      expect(MoveHistoryService.getMoveSequence(_createThreePlyTree(), [])).toEqual([])
    })

    it('returns a single move for a one-ply path', () => {
      expect(MoveHistoryService.getMoveSequence(_createThreePlyTree(), [0])).toEqual([sampleMove])
    })

    it('returns every move along a multi-ply path in order', () => {
      expect(MoveHistoryService.getMoveSequence(_createThreePlyTree(), [0, 0, 0])).toEqual([sampleMove, secondMove, thirdMove])
    })

    it('returns only the moves after the reference node when fromPath is supplied', () => {
      expect(MoveHistoryService.getMoveSequence(_createThreePlyTree(), [0, 0, 0], [0])).toEqual([secondMove, thirdMove])
    })

    it('throws when fromPath is not a prefix of the target path', () => {
      expect(() => MoveHistoryService.getMoveSequence(_createThreePlyTree(), [0], [0, 0])).toThrow(/prefix/)
    })

    it('throws when the target path does not exist', () => {
      expect(() => MoveHistoryService.getMoveSequence(_createThreePlyTree(), [0, 1])).toThrow(/does not exist/)
    })
  })
})
