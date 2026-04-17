import type { IBoardPosition } from '@/contracts';

function buildCastlingField(position: IBoardPosition): string {
  return [
    position.castlingAvailability.whiteKingSide ? 'K' : '',
    position.castlingAvailability.whiteQueenSide ? 'Q' : '',
    position.castlingAvailability.blackKingSide ? 'k' : '',
    position.castlingAvailability.blackQueenSide ? 'q' : '',
  ].join('');
}
export function buildPositionKey(position: IBoardPosition): string {
  const pieceTokens = position.board
    .map((piece, boardId) => piece === undefined ? undefined : `${boardId}:${piece.kind}:${piece.colour}`)
    .filter((token): token is string => token !== undefined);
  return [
    pieceTokens.join('|'),
    position.sideToMove,
    buildCastlingField(position),
    position.enPassantTarget === undefined ? '-' : position.enPassantTarget.toString(),
  ].join(' ');
}
