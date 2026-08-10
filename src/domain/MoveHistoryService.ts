import { MoveNodeKind, type IBoardPosition, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree } from '@/contracts';

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
function createChildNode(parentNode: IMoveNode, kind: MoveNodeKind, move: IMove, position: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveNode {
  return {
    kind,
    move,
    position,
    clockSnapshot,
    plyIndex: parentNode.plyIndex + 1,
    mainlineChildIndex: undefined,
    children: [],
    $: { parent: parentNode },
  };
}

export const MoveHistoryService = {
  createMoveTree(rootPosition: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree {
    return {
      root: {
        kind: MoveNodeKind.Live,
        move: undefined,
        position: rootPosition,
        clockSnapshot,
        plyIndex: 0,
        mainlineChildIndex: undefined,
        children: [],
      },
    };
  },
  addMainlineMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition, clockSnapshot?: IClockSnapshot) {
    const node = createChildNode(parentNode, MoveNodeKind.Live, move, position, clockSnapshot);
    parentNode.mainlineChildIndex = parentNode.children.length;
    parentNode.children.push(node);
    return node;
  },
  addAnalysisMove(parentNode: IMoveNode, move: IMove, position: IBoardPosition) {
    const node = createChildNode(parentNode, MoveNodeKind.Analysis, move, position, parentNode.clockSnapshot);
    parentNode.children.push(node);
    return node;
  },
  getPosition(node: IMoveNode): IBoardPosition {
    return node.position;
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
  replaceBoardRoot(rootPosition: IBoardPosition, clockSnapshot?: IClockSnapshot): IMoveTree {
    return this.createMoveTree(rootPosition, clockSnapshot);
  },
};
