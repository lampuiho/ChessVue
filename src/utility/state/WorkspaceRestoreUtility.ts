import { MoveNotationService } from '@/domain';
import type { IGame, IMoveNode, IMoveTree, MovePath } from '@/contracts';

function hydrateMoveNode(node: IMoveNode, parent?: IMoveNode): IMoveNode {
  const hydratedMove = node.move ? MoveNotationService.decorateMove(parent?.position ?? node.position, node.move) : undefined;
  const hydratedNode: IMoveNode = {
    branchKind: node.branchKind,
    move: hydratedMove,
    position: structuredClone(node.position),
    clockSnapshot: node.clockSnapshot ? structuredClone(node.clockSnapshot) : undefined,
    plyIndex: node.plyIndex,
    mainlineChildIndex: node.mainlineChildIndex,
    children: [],
    $: parent ? { parent } : undefined,
  };
  hydratedNode.children = node.children.map((child) => hydrateMoveNode(child, hydratedNode));
  return hydratedNode;
}

export function hydrateMoveTree(tree: IMoveTree): IMoveTree {
  return { root: hydrateMoveNode(tree.root) };
}
export function getNodeAtPath(tree: IMoveTree, path: MovePath): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) {
    const nextNode = currentNode.children[childIndex];
    if (!nextNode) throw new Error('Move path does not exist in the hydrated tree.');
    currentNode = nextNode;
  }
  return currentNode;
}
export function getPathToNode(node: IMoveNode): MovePath {
  const path: MovePath = [];
  let currentNode: IMoveNode | undefined = node;
  while (currentNode?.$?.parent) {
    const parentNode: IMoveNode = currentNode.$.parent;
    const childIndex = parentNode.children.indexOf(currentNode);
    if (childIndex < 0) throw new Error('Node is no longer attached to the hydrated tree.');
    path.unshift(childIndex);
    currentNode = parentNode;
  }
  return path;
}
export function isNodeInTree(tree: IMoveTree, node: IMoveNode): boolean {
  let currentNode: IMoveNode | undefined = node;
  while (currentNode?.$?.parent) currentNode = currentNode.$.parent;
  return currentNode === tree.root;
}
export function hydrateGame(game: IGame): IGame {
  const hydratedTree = hydrateMoveTree(game.moveTree);
  return {
    ...structuredClone(game),
    moveTree: hydratedTree,
    boardRoot: structuredClone(game.boardRoot),
    livePath: game.livePath ? [...game.livePath] : undefined,
    highlightPath: [...game.highlightPath],
    timeControl: structuredClone(game.timeControl),
    clockSnapshot: structuredClone(game.clockSnapshot),
    analysis: structuredClone(game.analysis),
  };
}
export function hydrateGames(games: readonly IGame[]): IGame[] {
  return games.map((game) => hydrateGame(game));
}
