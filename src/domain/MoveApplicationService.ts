import { MoveKind, PieceKind, PlayerColour, type BoardId, type IBoardPosition, type IMove } from '@/contracts';
import { getOpponentColour } from '@/utility/chess/BoardUtility';
import { boardIdToCoords, coordsToBoardId, getForwardDirection } from '@/utility/chess/SquareUtility';

function applyMove(position: IBoardPosition, move: IMove): IBoardPosition {
  const nextPosition = clonePosition(position);
  const isCapture = movePiece(position, move, nextPosition);
  updatePositionState(position, move, nextPosition, isCapture);
  return nextPosition;
}
export const MoveApplicationService = { applyMove };
