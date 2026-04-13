import { MoveBranchKind, type IBoardPosition, type IClockSnapshot, type IMove, type IMoveNode, type IMoveTree, type MovePath } from '../../contracts';

function cloneNode(node: IMoveNode): IMoveNode {
  return {
    branchKind: node.branchKind,
    move: node.move === null ? null : structuredClone(node.move),
    position: structuredClone(node.position),
    clockSnapshot: node.clockSnapshot === null ? null : structuredClone(node.clockSnapshot),
    plyIndex: node.plyIndex,
    mainlineChildIndex: node.mainlineChildIndex,
    children: node.children.map((child) => cloneNode(child)),
  };
}
function cloneTree(tree: IMoveTree): IMoveTree {
  return { root: cloneNode(tree.root) };
}
function getNode(node: IMoveNode, path: MovePath): IMoveNode {
  let currentNode = node;
  for (const childIndex of path) {
    const childNode = currentNode.children[childIndex];
    if (childNode === undefined) throw new Error(`Move tree path is invalid: ${path.join('.')}`);
    currentNode = childNode;
  }
  return currentNode;
}
function markPathBranchKind(node: IMoveNode, branchKind: MoveBranchKind): void {
  let currentNode: IMoveNode | null = node;
  while (currentNode !== null) {
    currentNode.branchKind = branchKind;
    currentNode = currentNode.mainlineChildIndex === null ? null : currentNode.children[currentNode.mainlineChildIndex] ?? null;
  }
}
function pruneDescendants(tree: IMoveTree, path: MovePath): IMoveTree {
  const nextTree = cloneTree(tree);
  const node = getNode(nextTree.root, path);
  node.children = [];
  node.mainlineChildIndex = null;
  return nextTree;
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
  addMainlineMove(tree: IMoveTree, parentPath: MovePath, move: IMove, position: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    const nextTree = cloneTree(tree);
    const parentNode = getNode(nextTree.root, parentPath);
    const previousMainlineChildIndex = parentNode.mainlineChildIndex;
    if (previousMainlineChildIndex !== null) markPathBranchKind(parentNode.children[previousMainlineChildIndex]!, MoveBranchKind.Variation);
    parentNode.children.push({
      branchKind: MoveBranchKind.Mainline,
      move: structuredClone(move),
      position: structuredClone(position),
      clockSnapshot: clockSnapshot === null ? null : structuredClone(clockSnapshot),
      plyIndex: parentNode.plyIndex + 1,
      mainlineChildIndex: null,
      children: [],
    });
    parentNode.mainlineChildIndex = parentNode.children.length - 1;
    return nextTree;
  },
  addAnalysisMove(tree: IMoveTree, parentPath: MovePath, move: IMove, position: IBoardPosition): IMoveTree {
    const nextTree = cloneTree(tree);
    const parentNode = getNode(nextTree.root, parentPath);
    parentNode.children.push({
      branchKind: MoveBranchKind.Analysis,
      move: structuredClone(move),
      position: structuredClone(position),
      clockSnapshot: parentNode.clockSnapshot === null ? null : structuredClone(parentNode.clockSnapshot),
      plyIndex: parentNode.plyIndex + 1,
      mainlineChildIndex: null,
      children: [],
    });
    return nextTree;
  },
  getPosition(tree: IMoveTree, path: MovePath): IBoardPosition {
    return structuredClone(getNode(tree.root, path).position);
  },
  takeBack(tree: IMoveTree, fromPath: MovePath, moveCount: number): IMoveTree {
    if (moveCount <= 0) return cloneTree(tree);
    getNode(tree.root, fromPath);
    const targetDepth = Math.max(fromPath.length - moveCount, 0);
    return pruneDescendants(tree, fromPath.slice(0, targetDepth));
  },
  rewriteMainline(tree: IMoveTree, parentPath: MovePath, childIndex: number): IMoveTree {
    const nextTree = cloneTree(tree);
    const parentNode = getNode(nextTree.root, parentPath);
    const childNode = parentNode.children[childIndex];
    if (childNode === undefined) throw new Error(`Child index ${childIndex} is not valid for ${parentPath.join('.')}`);
    const previousMainlineChildIndex = parentNode.mainlineChildIndex;
    if (previousMainlineChildIndex !== null && previousMainlineChildIndex !== childIndex) markPathBranchKind(parentNode.children[previousMainlineChildIndex]!, MoveBranchKind.Variation);
    parentNode.mainlineChildIndex = childIndex;
    markPathBranchKind(childNode, MoveBranchKind.Mainline);
    return nextTree;
  },
  pruneFutureMoves(tree: IMoveTree, path: MovePath): IMoveTree {
    return pruneDescendants(tree, path);
  },
  replaceBoardRoot(boardRoot: IBoardPosition, clockSnapshot: IClockSnapshot | null): IMoveTree {
    return this.createMoveTree(boardRoot, clockSnapshot);
  },
};
