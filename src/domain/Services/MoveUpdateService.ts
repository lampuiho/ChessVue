import { MoveBranchKind, type IBoardPosition, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree } from '@/contracts';

function getRootNode(node: IMoveNode): IMoveNode {
  let currentNode = node;
  while (currentNode.$?.parent !== undefined) currentNode = currentNode.$.parent;
  return currentNode;
}
function getTree(node: IMoveNode): IMoveTree {
  return { root: getRootNode(node) };
}
function markPathBranchKind(node: IMoveNode, branchKind: MoveBranchKind): void {
  let currentNode: IMoveNode | undefined = node;
  while (currentNode) {
    currentNode.branchKind = branchKind;
    currentNode = currentNode.mainlineChildIndex === undefined ? undefined : currentNode.children[currentNode.mainlineChildIndex];
  }
}
function pruneDescendants(node: IMoveNode): IMoveTree {
  node.children = [];
  node.mainlineChildIndex = undefined;
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
function createChildNode(parentNode: IMoveNode, branchKind: MoveBranchKind, move: IMove, position: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveNode {
  return {
    branchKind,
    move: structuredClone(move),
    position: structuredClone(position),
    clockSnapshot: clockSnapshot === undefined ? undefined : structuredClone(clockSnapshot),
    plyIndex: parentNode.plyIndex + 1,
    mainlineChildIndex: undefined,
    children: [],
    $: { parent: parentNode },
  };
}

export const MoveUpdateService = {
  /** Does not mutate boardRoot or clockSnapshot; returns a new move tree with cloned root state. */
  createMoveTree(boardRoot: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree {
    return {
      root: {
        branchKind: MoveBranchKind.Mainline,
        move: undefined,
        position: structuredClone(boardRoot),
        clockSnapshot: clockSnapshot === undefined ? undefined : structuredClone(clockSnapshot),
        plyIndex: 0,
        mainlineChildIndex: undefined,
        children: [],
      },
    };
  },
  /** Mutates parentNode and its descendants by appending a child, updating mainlineChildIndex, and rewriting branchKind along the old mainline path. */
  addMainlineMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree {
    const previousMainlineChildIndex = parentNode.mainlineChildIndex;
    if (previousMainlineChildIndex !== undefined) markPathBranchKind(parentNode.children[previousMainlineChildIndex]!, MoveBranchKind.Variation);
    parentNode.children.push(createChildNode(parentNode, MoveBranchKind.Mainline, move, position, clockSnapshot));
    parentNode.mainlineChildIndex = parentNode.children.length - 1;
    return getTree(parentNode);
  },
  /** Mutates parentNode by appending a new analysis child; move and position are cloned into the created node. */
  addAnalysisMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition): IMoveTree {
    parentNode.children.push(createChildNode(parentNode, MoveBranchKind.Analysis, move, position, parentNode.clockSnapshot));
    return getTree(parentNode);
  },
  /** Does not mutate node; returns a cloned board position. */
  getPosition(node: IMoveNode): IBoardPosition {
    return structuredClone(node.position);
  },
  /** Mutates fromNode or one of its ancestors by pruning descendant nodes and clearing mainlineChildIndex. */
  takeBack(fromNode: IMoveNode, moveCount: number): IMoveTree {
    if (moveCount <= 0) return getTree(fromNode);
    return pruneDescendants(getAncestorNode(fromNode, moveCount));
  },
  /** Mutates parentNode and the affected child paths by changing mainlineChildIndex and rewriting branchKind values in place. */
  rewriteMainline(parentNode: IMoveNode, childNode: IMoveNode): IMoveTree {
    const childIndex = parentNode.children.indexOf(childNode);
    if (childIndex < 0) throw new Error('Child node does not belong to the supplied parent node.');
    const previousMainlineChildIndex = parentNode.mainlineChildIndex;
    if (previousMainlineChildIndex !== undefined && previousMainlineChildIndex !== childIndex) markPathBranchKind(parentNode.children[previousMainlineChildIndex]!, MoveBranchKind.Variation);
    parentNode.mainlineChildIndex = childIndex;
    markPathBranchKind(childNode, MoveBranchKind.Mainline);
    return getTree(parentNode);
  },
  /** Mutates node by deleting all descendant children and clearing mainlineChildIndex. */
  pruneFutureMoves(node: IMoveNode): IMoveTree {
    return pruneDescendants(node);
  },
  /** Does not mutate boardRoot or clockSnapshot; returns a replacement tree with cloned root state. */
  replaceBoardRoot(boardRoot: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree {
    return this.createMoveTree(boardRoot, clockSnapshot);
  },
};
