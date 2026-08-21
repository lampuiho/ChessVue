import { MoveNodeKind, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '@/contracts';

function getRootNode(node: IMoveNode): IMoveNode {
  let currentNode = node;
  while (currentNode.$?.parent !== undefined) currentNode = currentNode.$.parent;
  return currentNode;
}
function getTree(node: IMoveNode): IMoveTree {
  return { root: getRootNode(node) };
}
function markPathKind(node: IMoveNode, kind: MoveNodeKind): void {
  let currentNode: IMoveNode | undefined = node;
  while (currentNode) {
    currentNode.kind = kind;
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
function createChildNode(parentNode: IMoveNode, kind: MoveNodeKind, move: IMove, clockSnapshot?: IClockSnapshot): IMoveNode {
  return {
    kind,
    move,
    clockSnapshot,
    plyIndex: parentNode.plyIndex + 1,
    mainlineChildIndex: undefined,
    children: [],
    $: { parent: parentNode },
  };
}

export const MoveHistoryService = {
  createMoveTree(clockSnapshot?: IClockSnapshot): IMoveTree {
    return {
      root: {
        kind: MoveNodeKind.Live,
        move: undefined,
        clockSnapshot,
        plyIndex: 0,
        mainlineChildIndex: undefined,
        children: [],
      },
    };
  },
  addMainlineMove(parentNode: IMoveNode, move: IMove, clockSnapshot?: IClockSnapshot) {
    const node = createChildNode(parentNode, MoveNodeKind.Live, move, clockSnapshot);
    parentNode.mainlineChildIndex = parentNode.children.length;
    parentNode.children.push(node);
    return node;
  },
  addAnalysisMove(parentNode: IMoveNode, move: IMove) {
    const node = createChildNode(parentNode, MoveNodeKind.Analysis, move, parentNode.clockSnapshot);
    parentNode.children.push(node);
    return node;
  },
  /**
   * the moves leading from `fromPath` to `toPath`, so a caller can generate the board position of a node
   * by replaying them from that reference node. `fromPath` defaults to the root and must be a prefix of
   * `toPath`.
   */
  getMoveSequence(tree: IMoveTree, toPath: MovePath, fromPath: MovePath = []): readonly IMove[] {
    if (fromPath.length > toPath.length || fromPath.some((childIndex, index) => toPath[index] !== childIndex)) {
      throw new Error('Move sequence start path must be a prefix of the target path.');
    }
    const moves: IMove[] = [];
    let currentNode = tree.root;
    toPath.forEach((childIndex, index) => {
      const childNode = currentNode.children[childIndex];
      if (!childNode) throw new Error('Move path does not exist in the move tree.');
      currentNode = childNode;
      if (index < fromPath.length) return;
      if (!childNode.move) throw new Error('Move tree node beyond the root is missing its move.');
      moves.push(childNode.move);
    });
    return moves;
  },
  takeBack(fromNode: IMoveNode, moveCount: number): IMoveTree {
    if (moveCount <= 0) return getTree(fromNode);
    return pruneDescendants(getAncestorNode(fromNode, moveCount));
  },
  rewriteMainline(parentNode: IMoveNode, childNode: IMoveNode): IMoveTree {
    const childIndex = parentNode.children.indexOf(childNode);
    if (childIndex < 0) throw new Error('Child node does not belong to the supplied parent node.');
    parentNode.mainlineChildIndex = childIndex;
    markPathKind(childNode, MoveNodeKind.Live);
    return getTree(parentNode);
  },
  pruneFutureMoves(node: IMoveNode): IMoveTree {
    return pruneDescendants(node);
  },
};
