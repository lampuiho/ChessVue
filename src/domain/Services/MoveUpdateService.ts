import { MoveBranchKind, type IBoardPosition, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree } from '../../contracts';

function getRootNode(node: IMoveNode): IMoveNode {
  let currentNode = node;
  while (currentNode.$?.parent !== undefined) currentNode = currentNode.$.parent;
  return currentNode;
}
function getTree(node: IMoveNode): IMoveTree {
  return { root: getRootNode(node) };
}
function markPathBranchKind(node: IMoveNode, branchKind: MoveBranchKind): void {
  let currentNode: IMoveNode | null = node;
  while (currentNode !== null) {
    currentNode.branchKind = branchKind;
    currentNode = currentNode.mainlineChildIndex === null ? null : currentNode.children[currentNode.mainlineChildIndex] ?? null;
  }
}
function pruneDescendants(node: IMoveNode): IMoveTree {
  node.children = [];
  node.mainlineChildIndex = null;
  return getTree(node);
}
function getAncestorNode(node: IMoveNode, distance: number): IMoveNode {
  let currentNode = node;
  let remainingDistance = distance;
  while (remainingDistance > 0 && currentNode.$?.parent !== undefined) {
    currentNode = currentNode.$.parent;
    remainingDistance -= 1;
  }
  return currentNode;
}
function createChildNode(parentNode: IMoveNode, branchKind: MoveBranchKind, move: IMove, position: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveNode {
  return {
    branchKind,
    move: structuredClone(move),
    position: structuredClone(position),
    clockSnapshot: clockSnapshot === null ? null : structuredClone(clockSnapshot),
    plyIndex: parentNode.plyIndex + 1,
    mainlineChildIndex: null,
    children: [],
    $: { parent: parentNode },
  };
}

export const MoveUpdateService = {
  createMoveTree(boardRoot: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    return {
      root: {
        branchKind: MoveBranchKind.Mainline,
        move: null,
        position: structuredClone(boardRoot),
        clockSnapshot: clockSnapshot === null ? null : structuredClone(clockSnapshot),
        plyIndex: 0,
        mainlineChildIndex: null,
        children: [],
      },
    };
  },
  addMainlineMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    const previousMainlineChildIndex = parentNode.mainlineChildIndex;
    if (previousMainlineChildIndex !== null) markPathBranchKind(parentNode.children[previousMainlineChildIndex]!, MoveBranchKind.Variation);
    parentNode.children.push(createChildNode(parentNode, MoveBranchKind.Mainline, move, position, clockSnapshot));
    parentNode.mainlineChildIndex = parentNode.children.length - 1;
    return getTree(parentNode);
  },
  addAnalysisMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition): IMoveTree {
    parentNode.children.push(createChildNode(parentNode, MoveBranchKind.Analysis, move, position, parentNode.clockSnapshot));
    return getTree(parentNode);
  },
  getPosition(node: IMoveNode): IBoardPosition {
    return structuredClone(node.position);
  },
  takeBack(fromNode: IMoveNode, moveCount: number): IMoveTree {
    if (moveCount <= 0) return getTree(fromNode);
    return pruneDescendants(getAncestorNode(fromNode, moveCount));
  },
  rewriteMainline(parentNode: IMoveNode, childNode: IMoveNode): IMoveTree {
    const childIndex = parentNode.children.indexOf(childNode);
    if (childIndex < 0) throw new Error('Child node does not belong to the supplied parent node.');
    const previousMainlineChildIndex = parentNode.mainlineChildIndex;
    if (previousMainlineChildIndex !== null && previousMainlineChildIndex !== childIndex) markPathBranchKind(parentNode.children[previousMainlineChildIndex]!, MoveBranchKind.Variation);
    parentNode.mainlineChildIndex = childIndex;
    markPathBranchKind(childNode, MoveBranchKind.Mainline);
    return getTree(parentNode);
  },
  pruneFutureMoves(node: IMoveNode): IMoveTree {
    return pruneDescendants(node);
  },
  replaceBoardRoot(boardRoot: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    return this.createMoveTree(boardRoot, clockSnapshot);
  },
};
