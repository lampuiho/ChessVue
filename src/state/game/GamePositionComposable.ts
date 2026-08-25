import type { IBoardPosition, IGame, IGamePositionState, IGameRuntime, IMoveNode, IMoveTree, MovePath } from '@/contracts';
import { MoveApplicationService, MoveHistoryService } from '@/domain';

interface ISelectionCache {
  node?: IMoveNode;
  position?: IBoardPosition;
}

export function useGamePosition() {
  function createGameRuntime(): IGameRuntime {
    return {};
  }
  function requireGameRuntime(state: Pick<IGamePositionState, '$'>): IGameRuntime {
    if (!state.$) throw new Error('Game runtime is not initialised.');
    return state.$;
  }
  function getNodeAtPath(tree: IMoveTree, path: MovePath): IMoveNode {
    let currentNode = tree.root;
    for (const childIndex of path) {
      const nextNode = currentNode.children[childIndex];
      if (!nextNode) throw new Error('Move path does not exist in the hydrated tree.');
      currentNode = nextNode;
    }
    return currentNode;
  }
  function getRenderedNode(state: IGamePositionState): IMoveNode {
    const runtime = requireGameRuntime(state);
    return runtime.renderedNode ??= getNodeAtPath(state.moveTree, state.renderedPath);
  }
  function getLiveNode(state: IGamePositionState): IMoveNode {
    if (state.livePath === undefined) throw new Error('Live node is not available.');
    const runtime = requireGameRuntime(state);
    return runtime.liveNode ??= getNodeAtPath(state.moveTree, state.livePath);
  }
  function genPositionAtPath(state: IGamePositionState, path: MovePath): IBoardPosition {
    return MoveApplicationService.genPosition(state.rootPosition, MoveHistoryService.getMoveSequence(state.moveTree, path));
  }
  function getAliasedLivePosition(state: IGamePositionState, livePath: MovePath): IBoardPosition {
    const runtime = requireGameRuntime(state);
    const livePosition = runtime.livePosition ?? runtime.renderedPosition ?? genPositionAtPath(state, livePath);
    runtime.livePosition = livePosition;
    runtime.renderedPosition = livePosition;
    return livePosition;
  }
  function getRenderedPosition(state: IGamePositionState): IBoardPosition {
    if (state.livePath !== undefined && pathsEqual(state.renderedPath, state.livePath)) return getAliasedLivePosition(state, state.livePath);
    const runtime = requireGameRuntime(state);
    return runtime.renderedPosition ??= genPositionAtPath(state, state.renderedPath);
  }
  function getLivePosition(state: IGamePositionState): IBoardPosition {
    if (state.livePath === undefined) throw new Error('Live position is not available.');
    if (pathsEqual(state.renderedPath, state.livePath)) return getAliasedLivePosition(state, state.livePath);
    const runtime = requireGameRuntime(state);
    return runtime.livePosition ??= genPositionAtPath(state, state.livePath);
  }
  function setRenderedPath(state: IGamePositionState, path: MovePath, cache?: ISelectionCache): void {
    state.renderedPath = path;
    const runtime = requireGameRuntime(state);
    runtime.renderedNode = cache?.node;
    runtime.renderedPosition = cache?.position;
  }
  function setLivePath(state: IGamePositionState, path: MovePath | undefined, cache?: ISelectionCache): void {
    state.livePath = path;
    const runtime = requireGameRuntime(state);
    runtime.liveNode = cache?.node;
    runtime.livePosition = cache?.position;
  }
  function invalidateRenderedPosition(state: IGamePositionState): void {
    requireGameRuntime(state).renderedPosition = undefined;
  }
  function replaceMoveTree(state: IGamePositionState, moveTree: IMoveTree): void {
    state.moveTree = moveTree;
    const runtime = requireGameRuntime(state);
    runtime.renderedNode = undefined;
    runtime.renderedPosition = undefined;
    runtime.liveNode = undefined;
    runtime.livePosition = undefined;
  }
  function pathsEqual(left?: MovePath, right?: MovePath): boolean {
    if ((left?.length ?? 0) !== (right?.length ?? 0)) return false;
    return (left ?? []).every((segment, index) => segment === (right ?? [])[index]);
  }
  function isPathPrefix(prefix: MovePath, candidate?: MovePath): boolean {
    if (!candidate || prefix.length >= candidate.length) return false;
    return prefix.every((segment, index) => candidate[index] === segment);
  }
  function hydrateMoveNode(node: IMoveNode, parent?: IMoveNode): void {
    node.$ = parent ? { parent } : undefined;
    node.children.forEach((child) => hydrateMoveNode(child, node));
  }
  function getPathToNode(node: IMoveNode): MovePath {
    const path: number[] = [];
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
  function isNodeInTree(tree: IMoveTree, node: IMoveNode): boolean {
    let currentNode: IMoveNode | undefined = node;
    while (currentNode?.$?.parent) currentNode = currentNode.$.parent;
    return currentNode === tree.root;
  }
  function hydrateGame(game: IGame): IGame {
    hydrateMoveNode(game.moveTree.root);
    game.$ = createGameRuntime();
    return game;
  }
  return {
    createGameRuntime,
    requireGameRuntime,
    getNodeAtPath,
    getRenderedNode,
    getLiveNode,
    getRenderedPosition,
    getLivePosition,
    setRenderedPath,
    setLivePath,
    invalidateRenderedPosition,
    replaceMoveTree,
    pathsEqual,
    isPathPrefix,
    getPathToNode,
    isNodeInTree,
    hydrateGame,
  };
}
export type GamePositionComposable = ReturnType<typeof useGamePosition>;
