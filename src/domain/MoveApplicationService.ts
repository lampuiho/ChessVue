import type { BoardId, IBoardPosition, IChessPiece, IMoveCandidate } from '@/contracts';
import { applyMove as applyMoveToPosition, cloneBoardPosition } from '@/utility/chess/GameRuleUtility';

/** drops the runtime metadata a direct board edit invalidates: check state, standard-start flag, cached fen */
function _invalidateRuntimeMetadata(position: IBoardPosition) {
  position.$ = undefined;
}

function applyMove(position: IBoardPosition, move: IMoveCandidate): IBoardPosition {
  return applyMoveToPosition(position, move);
}
/** generates the position reached by replaying `moves` from `rootPosition`, leaving `rootPosition` untouched */
function genPosition(rootPosition: IBoardPosition, moves: readonly IMoveCandidate[]): IBoardPosition {
  return moves.reduce((position, move) => applyMoveToPosition(position, move), cloneBoardPosition(rootPosition));
}
/** empties every occupied square; false when the board was already empty */
function clearBoard(position: IBoardPosition): boolean {
  if (position.board.every((piece) => piece === undefined)) return false;
  position.board.fill(undefined);
  _invalidateRuntimeMetadata(position);
  return true;
}
/** removes the piece on `boardId`; false when the square was already empty */
function deletePiece(position: IBoardPosition, boardId: BoardId): boolean {
  if (position.board[boardId] === undefined) return false;
  position.board[boardId] = undefined;
  _invalidateRuntimeMetadata(position);
  return true;
}
/** relocates a piece during board edit; false when `from` is empty or the move goes nowhere */
function movePiece(position: IBoardPosition, from: BoardId, to: BoardId): boolean {
  const piece = position.board[from];
  if (piece === undefined || from === to) return false;
  position.board[from] = undefined;
  position.board[to] = piece;
  _invalidateRuntimeMetadata(position);
  return true;
}
/** removes an equal kind-and-colour piece, otherwise replaces or adds the supplied piece */
function togglePiece(position: IBoardPosition, boardId: BoardId, piece: IChessPiece): boolean {
  const currentPiece = position.board[boardId];
  position.board[boardId] = currentPiece?.kind === piece.kind && currentPiece.colour === piece.colour ? undefined : piece;
  _invalidateRuntimeMetadata(position);
  return true;
}

export const MoveApplicationService = {
  applyMove,
  genPosition,
  clearBoard,
  deletePiece,
  movePiece,
  togglePiece,
};
