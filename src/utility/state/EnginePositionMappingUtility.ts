import { type IEnginePositionState, type IGame, type IMove, type IMoveNode, type MovePath } from '@/contracts';

function getNodeAtPath(game: IGame, path: MovePath): IMoveNode {
  let currentNode = game.moveTree.root;
  for (const childIndex of path) {
    const nextNode = currentNode.children[childIndex];
    if (!nextNode) throw new Error(`Move path is invalid for game ${game.metadata.id}.`);
    currentNode = nextNode;
  }
  return currentNode;
}
function getMovesFromPath(game: IGame, path: MovePath): IMove[] {
  const moves: IMove[] = [];
  let currentNode = game.moveTree.root;
  for (const childIndex of path) {
    const nextNode = currentNode.children[childIndex];
    if (!nextNode?.move) throw new Error(`Move path is invalid for game ${game.metadata.id}.`);
    moves.push(structuredClone(nextNode.move));
    currentNode = nextNode;
  }
  return moves;
}

export function buildEnginePositionState(game: IGame, path: MovePath = game.highlightPath, previous?: IEnginePositionState): IEnginePositionState {
  const currentNode = getNodeAtPath(game, path);
  const movesFromRoot = getMovesFromPath(game, path);
  const requiresNewGameBoundary = !previous
    || JSON.stringify(previous.rootPosition) !== JSON.stringify(game.boardRoot)
    || JSON.stringify(previous.movesFromRoot) !== JSON.stringify(movesFromRoot);
  return {
    rootPosition: structuredClone(game.boardRoot),
    movesFromRoot,
    currentPosition: structuredClone(currentNode.position),
    requiresNewGameBoundary,
  };
}
