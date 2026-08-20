import { PieceKind, PlayerColour, type BoardId, type IBoardPosition, type IChessPiece } from '@/contracts';

export function getOpponentColour(colour: PlayerColour): PlayerColour {
  return colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
}
export function findKingBoardId(position: IBoardPosition, colour: PlayerColour): BoardId | undefined {
  for (let boardId = 0; boardId < position.board.length; boardId += 1) {
    const piece = position.board[boardId];
    if (piece?.kind === PieceKind.King && piece.colour === colour) return boardId;
  }
  return;
}
export function createSparseBoard(pieces: Array<{ boardId: BoardId; piece: IChessPiece }>, sideToMove: PlayerColour = PlayerColour.White): IBoardPosition {
  const board: IBoardPosition['board'] = Array(64).fill(undefined);
  for (const entry of pieces) board[entry.boardId] = entry.piece;
  return {
    board,
    sideToMove,
    castlingAvailability: {
      whiteKingSide: false,
      whiteQueenSide: false,
      blackKingSide: false,
      blackQueenSide: false,
    },
    halfMoveClock: 0,
    fullMoveNumber: 1,
  };
}
