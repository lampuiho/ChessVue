import type { IBoardPosition, IGame, IGameRuntime, IMoveNode, MovePath } from '@/contracts';
import { MoveApplicationService, MoveHistoryService } from '@/domain';

export function useGamePosition() {
  function getRuntimeNodeOfPath(tree: IGame['moveTree'], path: MovePath): IMoveNode {
    let currentNode = tree.root;
    for (const childIndex of path) {
      const nextNode = currentNode.children[childIndex];
      if (!nextNode) throw new Error('Move path does not exist in the hydrated tree.');
      currentNode = nextNode;
    }
    return currentNode;
  }
  function getCurrentPath(game: IGame): MovePath {
    return [...game.highlightPath];
  }
  function buildGameRuntime(game: IGame): IGameRuntime {
    return {
      renderedNode: getRuntimeNodeOfPath(game.moveTree, getCurrentPath(game)),
      liveNode: game.livePath ? getRuntimeNodeOfPath(game.moveTree, game.livePath) : undefined,
    };
  }
  function createGameRuntime(game: IGame): IGameRuntime {
    return buildGameRuntime(game);
  }
  function requireGameRuntime(game: IGame): IGameRuntime {
    if (!game.$) throw new Error(`Game runtime is not initialised for ${game.metadata.id}.`);
    return game.$;
  }
  function getCurrentNode(game: IGame): IMoveNode {
    return requireGameRuntime(game).renderedNode;
  }
  function getLiveNode(game: IGame): IMoveNode {
    const liveNode = requireGameRuntime(game).liveNode;
    if (!liveNode) throw new Error(`Live node is not available for ${game.metadata.id}.`);
    return liveNode;
  }
  function genPositionAtPath(game: IGame, path: MovePath): IBoardPosition {
    return MoveApplicationService.genPosition(game.rootPosition, MoveHistoryService.getMoveSequence(game.moveTree, path));
  }
  function getAliasedLivePosition(game: IGame, livePath: MovePath): IBoardPosition {
    const runtime = requireGameRuntime(game);
    const livePosition = runtime.livePosition ?? runtime.renderedPosition ?? genPositionAtPath(game, livePath);
    runtime.livePosition = livePosition;
    runtime.renderedPosition = livePosition;
    return livePosition;
  }
  function getRenderedPosition(game: IGame): IBoardPosition {
    const runtime = requireGameRuntime(game);
    if (game.livePath && pathsEqual(game.highlightPath, game.livePath)) return getAliasedLivePosition(game, game.livePath);
    return runtime.renderedPosition ??= genPositionAtPath(game, game.highlightPath);
  }
  function getLivePosition(game: IGame): IBoardPosition {
    const runtime = requireGameRuntime(game);
    if (!game.livePath) throw new Error(`Live position is not available for ${game.metadata.id}.`);
    if (pathsEqual(game.highlightPath, game.livePath)) return getAliasedLivePosition(game, game.livePath);
    return runtime.livePosition ??= genPositionAtPath(game, game.livePath);
  }
  function invalidateRuntimePositions(game: IGame): void {
    const runtime = requireGameRuntime(game);
    runtime.renderedPosition = undefined;
    runtime.livePosition = undefined;
  }
  function pathsEqual(left?: MovePath, right?: MovePath): boolean {
    if ((left?.length ?? 0) !== (right?.length ?? 0)) return false;
    return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  }
  function isPathPrefix(prefix: MovePath, candidate?: MovePath): boolean {
    if (!candidate || prefix.length >= candidate.length) return false;
    return prefix.every((segment, index) => candidate[index] === segment);
  }
  function hydrateMoveNode(node: IMoveNode, parent?: IMoveNode): IMoveNode {
    const hydratedNode: IMoveNode = {
      kind: node.kind,
      move: node.move ? structuredClone(node.move) : undefined,
      clockSnapshot: node.clockSnapshot ? structuredClone(node.clockSnapshot) : undefined,
      plyIndex: node.plyIndex,
      mainlineChildIndex: node.mainlineChildIndex,
      children: [],
      $: parent ? { parent } : undefined,
    };
    hydratedNode.children = node.children.map((child) => hydrateMoveNode(child, hydratedNode));
    return hydratedNode;
  }
  function getCurrentNodeOfPath(tree: IGame['moveTree'], path: MovePath): IMoveNode {
    return getRuntimeNodeOfPath(tree, path);
  }
  function getPathToNode(node: IMoveNode): MovePath {
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
  function isNodeInTree(tree: IGame['moveTree'], node: IMoveNode): boolean {
    let currentNode: IMoveNode | undefined = node;
    while (currentNode?.$?.parent) currentNode = currentNode.$.parent;
    return currentNode === tree.root;
  }
  function hydrateGame(game: IGame): IGame {
    game.moveTree = { root: hydrateMoveNode(game.moveTree.root) };
    game.$ = createGameRuntime(game);
    syncMoveNodeHighlights(game);
    return game;
  }
  function syncRuntimeNodeCache(game: IGame): void {
    syncMoveNodeHighlights(game);
    game.$ = { ...requireGameRuntime(game), ...buildGameRuntime(game) };
  }
  function syncMoveNodeHighlights(game: IGame): void {
    const highlightedPaths = [game.highlightPath, game.livePath ?? []];
    function syncNode(node: IMoveNode, path: MovePath): void {
      node.$ = {
        ...node.$,
        isHighlighted: highlightedPaths.some((candidate) => candidate.length >= path.length && path.every((segment, index) => candidate[index] === segment)),
      };
      node.children.forEach((child, index) => syncNode(child, [...path, index]));
    }
    syncNode(game.moveTree.root, []);
  }
  return {
    createGameRuntime,
    requireGameRuntime,
    getCurrentNode,
    getLiveNode,
    getRenderedPosition,
    getLivePosition,
    invalidateRuntimePositions,
    pathsEqual,
    isPathPrefix,
    getCurrentNodeOfPath,
    getPathToNode,
    isNodeInTree,
    hydrateGame,
    syncRuntimeNodeCache,
  };
}
export type GamePositionComposable = ReturnType<typeof useGamePosition>;
