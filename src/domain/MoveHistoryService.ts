import { MoveNodeKind, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '@/contracts';

function _markPathKind(node: IMoveNode, kind: MoveNodeKind) {
  let currentNode: IMoveNode | undefined = node;
  while (currentNode) {
    currentNode.kind = kind;
    currentNode = currentNode.mainlineChildIndex === undefined ? undefined : currentNode.children[currentNode.mainlineChildIndex];
  }
}
function _pruneDescendants(node: IMoveNode) {
  node.children.forEach((child) => child.$ = undefined);
  node.children.length = 0;
  node.mainlineChildIndex = undefined;
}
function _getAncestorNode(node: IMoveNode, distance: number): IMoveNode {
  let currentNode = node;
  let remainingDistance = distance;
  while (remainingDistance > 0 && currentNode.$?.parent) {
    currentNode = currentNode.$.parent;
    remainingDistance -= 1;
  }
  return currentNode;
}
function _createChildNode(parentNode: IMoveNode, kind: MoveNodeKind, move: IMove, clockSnapshot?: IClockSnapshot): IMoveNode {
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
  /** Attaches and returns a new live child without replacing any existing tree object. */
  addMainlineMove(parentNode: IMoveNode, move: IMove, clockSnapshot?: IClockSnapshot): IMoveNode {
    const node = _createChildNode(parentNode, MoveNodeKind.Live, move, clockSnapshot);
    parentNode.mainlineChildIndex = parentNode.children.length;
    parentNode.children.push(node);
    return node;
  },
  /** Attaches and returns a new analysis child without replacing any existing tree object. */
  addAnalysisMove(parentNode: IMoveNode, move: IMove): IMoveNode {
    const node = _createChildNode(parentNode, MoveNodeKind.Analysis, move, parentNode.clockSnapshot);
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
  /** Mutates the existing tree and returns the retained node already owned by that tree. */
  takeBack(fromNode: IMoveNode, moveCount: number): IMoveNode {
    if (moveCount <= 0) return fromNode;
    const retainedNode = _getAncestorNode(fromNode, moveCount);
    _pruneDescendants(retainedNode);
    return retainedNode;
  },
  /** Mutates mainline selection and kinds along the supplied child continuation. */
  rewriteMainline(parentNode: IMoveNode, childNode: IMoveNode) {
    const childIndex = parentNode.children.indexOf(childNode);
    if (childIndex < 0) throw new Error('Child node does not belong to the supplied parent node.');
    parentNode.mainlineChildIndex = childIndex;
    _markPathKind(childNode, MoveNodeKind.Live);
  },
  /** Removes descendants from the supplied node while preserving the tree and children-array identities. */
  pruneFutureMoves(node: IMoveNode) {
    _pruneDescendants(node);
  },
};
