import { MoveBranchKind, type IBoardPosition, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree } from '../Contracts'

import { createMoveTreeNodeId } from '../Internal/MoveTreeId'

function cloneNode(node: IMoveNode): IMoveNode {
  return {
    ...node,
    childIds: [...node.childIds],
    position: structuredClone(node.position),
    clockSnapshot: node.clockSnapshot === null ? null : structuredClone(node.clockSnapshot),
  }
}

function cloneTree(tree: IMoveTree): IMoveTree {
  return {
    rootId: tree.rootId,
    nodeById: Object.fromEntries(
      Object.entries(tree.nodeById).map(([id, node]) => [id, cloneNode(node)]),
    ),
  }
}

function getNode(tree: IMoveTree, nodeId: string): IMoveNode {
  const node = tree.nodeById[nodeId]

  if (node === undefined) {
    throw new Error(`Move tree node not found: ${nodeId}`)
  }

  return node
}

function getLineage(tree: IMoveTree, nodeId: string): string[] {
  const lineage: string[] = []
  let currentId: string | null = nodeId

  while (currentId !== null) {
    lineage.unshift(currentId)
    currentId = getNode(tree, currentId).parentId
  }

  return lineage
}

function followMainline(tree: IMoveTree, startNodeId: string): string[] {
  const path: string[] = []
  let currentId: string | null = startNodeId

  while (currentId !== null) {
    path.push(currentId)
    currentId = getNode(tree, currentId).mainlineChildId
  }

  return path
}

function markPathBranchKind(tree: IMoveTree, startNodeId: string, branchKind: MoveBranchKind): void {
  const path = followMainline(tree, startNodeId)

  for (const nodeId of path) {
    if (nodeId !== tree.rootId) {
      tree.nodeById[nodeId].branchKind = branchKind
    }
  }
}

function collectDescendants(tree: IMoveTree, nodeId: string): string[] {
  const descendants: string[] = []
  const queue = [...getNode(tree, nodeId).childIds]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    descendants.push(currentId)
    queue.push(...getNode(tree, currentId).childIds)
  }

  return descendants
}

function pruneDescendants(tree: IMoveTree, nodeId: string): IMoveTree {
  const nextTree = cloneTree(tree)
  const descendants = collectDescendants(nextTree, nodeId)

  nextTree.nodeById[nodeId].childIds = []
  nextTree.nodeById[nodeId].mainlineChildId = null

  for (const descendantId of descendants) {
    delete nextTree.nodeById[descendantId]
  }

  return nextTree
}

function getCurrentMainlineLeaf(tree: IMoveTree): IMoveNode {
  let currentNode = getNode(tree, tree.rootId)

  while (currentNode.mainlineChildId !== null) {
    currentNode = getNode(tree, currentNode.mainlineChildId)
  }

  return currentNode
}

export const MoveUpdateService = {
  createMoveTree(boardRoot: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    const rootId = createMoveTreeNodeId()

    return {
      rootId,
      nodeById: {
        [rootId]: {
          id: rootId,
          parentId: null,
          childIds: [],
          branchKind: MoveBranchKind.Mainline,
          move: null,
          position: structuredClone(boardRoot),
          clockSnapshot: clockSnapshot === null ? null : structuredClone(clockSnapshot),
          plyIndex: 0,
          mainlineChildId: null,
        },
      },
    }
  },

  addMainlineMove(tree: IMoveTree, parentNodeId: string, move: IMove, position: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    const nextTree = cloneTree(tree)
    const parentNode = getNode(nextTree, parentNodeId)
    const previousMainlineChildId = parentNode.mainlineChildId
    const newNodeId = createMoveTreeNodeId()

    if (previousMainlineChildId !== null) {
      markPathBranchKind(nextTree, previousMainlineChildId, MoveBranchKind.Variation)
    }

    parentNode.childIds.push(newNodeId)
    parentNode.mainlineChildId = newNodeId

    nextTree.nodeById[newNodeId] = {
      id: newNodeId,
      parentId: parentNodeId,
      childIds: [],
      branchKind: MoveBranchKind.Mainline,
      move: structuredClone(move),
      position: structuredClone(position),
      clockSnapshot: clockSnapshot === null ? null : structuredClone(clockSnapshot),
      plyIndex: parentNode.plyIndex + 1,
      mainlineChildId: null,
    }

    return nextTree
  },

  addAnalysisMove(tree: IMoveTree, parentNodeId: string, move: IMove, position: IBoardPosition): IMoveTree {
    const nextTree = cloneTree(tree)
    const parentNode = getNode(nextTree, parentNodeId)
    const newNodeId = createMoveTreeNodeId()

    parentNode.childIds.push(newNodeId)

    nextTree.nodeById[newNodeId] = {
      id: newNodeId,
      parentId: parentNodeId,
      childIds: [],
      branchKind: MoveBranchKind.Analysis,
      move: structuredClone(move),
      position: structuredClone(position),
      clockSnapshot: parentNode.clockSnapshot === null ? null : structuredClone(parentNode.clockSnapshot),
      plyIndex: parentNode.plyIndex + 1,
      mainlineChildId: null,
    }

    return nextTree
  },

  navigateToNode(tree: IMoveTree, nodeId: string): IMoveTree {
    getNode(tree, nodeId)
    return tree
  },

  getPosition(tree: IMoveTree, nodeId: string): IBoardPosition {
    return structuredClone(getNode(tree, nodeId).position)
  },

  takeBack(tree: IMoveTree, moveCount: number): IMoveTree {
    if (moveCount <= 0) {
      return cloneTree(tree)
    }

    const leaf = getCurrentMainlineLeaf(tree)
    let targetNode = leaf
    let remainingSteps = moveCount

    while (remainingSteps > 0 && targetNode.parentId !== null) {
      targetNode = getNode(tree, targetNode.parentId)
      remainingSteps -= 1
    }

    return pruneDescendants(tree, targetNode.id)
  },

  rewriteMainline(tree: IMoveTree, parentNodeId: string, childNodeId: string): IMoveTree {
    const nextTree = cloneTree(tree)
    const parentNode = getNode(nextTree, parentNodeId)

    if (!parentNode.childIds.includes(childNodeId)) {
      throw new Error(`Node ${childNodeId} is not a child of ${parentNodeId}`)
    }

    const previousMainlineChildId = parentNode.mainlineChildId
    if (previousMainlineChildId !== null && previousMainlineChildId !== childNodeId) {
      markPathBranchKind(nextTree, previousMainlineChildId, MoveBranchKind.Variation)
    }

    parentNode.mainlineChildId = childNodeId
    markPathBranchKind(nextTree, childNodeId, MoveBranchKind.Mainline)

    return nextTree
  },

  pruneFutureMoves(tree: IMoveTree, nodeId: string, allowRootPrune: boolean): IMoveTree {
    if (nodeId === tree.rootId && !allowRootPrune) {
      throw new Error('Root pruning is disabled by policy.')
    }

    return pruneDescendants(tree, nodeId)
  },

  replaceBoardRoot(boardRoot: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    return this.createMoveTree(boardRoot, clockSnapshot)
  },
}


