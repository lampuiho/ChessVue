import type { IBoardPosition, IGame, MovePath } from '@/contracts';
import { MoveHistoryService } from '@/domain/MoveHistoryService';
import { applyMove, genLegalMoves, getUci, toDetailedMove } from '@/utility/chess';

export function getPosition(game: IGame, path: MovePath): IBoardPosition {
  const position = structuredClone(game.rootPosition);
  for (const move of MoveHistoryService.getMoveSequence(game.moveTree, path)) applyMove(position, move);
  return position;
}
export function appendMoves(game: IGame, fromPath: MovePath, moves: string[], live = false): MovePath {
  const path = [...fromPath];
  const position = getPosition(game, path);
  let node = game.moveTree.root;
  for (const index of path) node = node.children[index]!;
  for (const uci of moves) {
    const raw = genLegalMoves(position).find((move) => getUci(move) === uci);
    if (!raw) throw new Error(`Illegal fixture move ${uci} in ${game.metadata.id}.`);
    const move = toDetailedMove(position, raw);
    const nextIndex = node.children.length;
    node = live ? MoveHistoryService.addMainlineMove(node, move, game.clockSnapshot) : MoveHistoryService.addAnalysisMove(node, move);
    path.push(nextIndex);
    applyMove(position, move);
  }
  if (live) game.livePath = path;
  if (live || game.livePath === undefined) game.renderedPath = [...path];
  return path;
}
