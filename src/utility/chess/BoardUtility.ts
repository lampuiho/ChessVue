import { PieceKind, PlayerColour, type BoardId, type IBoardPosition, type ICastlingAvailability, type IChessPiece } from '@/contracts';

import { coordsToBoardId } from './SquareUtility';

export function cloneBoard(board: IBoardPosition['board']): IBoardPosition['board'] {
  return board.map((piece) => piece === undefined ? undefined : { ...piece });
}
export function cloneBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    board: cloneBoard(position.board),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTarget: position.enPassantTarget,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
  };
}
export function createDefaultCastlingAvailability(): ICastlingAvailability {
  return {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  };
}
export function normaliseBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    board: cloneBoard(position.board),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTarget: position.enPassantTarget,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
  };
}
export function createInitialBoardPosition(): IBoardPosition {
  const board: IBoardPosition['board'] = Array(64).fill(undefined);
  for (let file = 0; file < 8; file += 1) {
    const whitePawnBoardId = coordsToBoardId(file, 1);
    const blackPawnBoardId = coordsToBoardId(file, 6);
    if (whitePawnBoardId !== undefined) board[whitePawnBoardId] = { kind: PieceKind.Pawn, colour: PlayerColour.White };
    if (blackPawnBoardId !== undefined) board[blackPawnBoardId] = { kind: PieceKind.Pawn, colour: PlayerColour.Black };
  }
  board[0] = { kind: PieceKind.Rook, colour: PlayerColour.White };
  board[1] = { kind: PieceKind.Knight, colour: PlayerColour.White };
  board[2] = { kind: PieceKind.Bishop, colour: PlayerColour.White };
  board[3] = { kind: PieceKind.Queen, colour: PlayerColour.White };
  board[4] = { kind: PieceKind.King, colour: PlayerColour.White };
  board[5] = { kind: PieceKind.Bishop, colour: PlayerColour.White };
  board[6] = { kind: PieceKind.Knight, colour: PlayerColour.White };
  board[7] = { kind: PieceKind.Rook, colour: PlayerColour.White };
  board[56] = { kind: PieceKind.Rook, colour: PlayerColour.Black };
  board[57] = { kind: PieceKind.Knight, colour: PlayerColour.Black };
  board[58] = { kind: PieceKind.Bishop, colour: PlayerColour.Black };
  board[59] = { kind: PieceKind.Queen, colour: PlayerColour.Black };
  board[60] = { kind: PieceKind.King, colour: PlayerColour.Black };
  board[61] = { kind: PieceKind.Bishop, colour: PlayerColour.Black };
  board[62] = { kind: PieceKind.Knight, colour: PlayerColour.Black };
  board[63] = { kind: PieceKind.Rook, colour: PlayerColour.Black };
  return normaliseBoardPosition({
    board,
    sideToMove: PlayerColour.White,
    castlingAvailability: createDefaultCastlingAvailability(),
    halfMoveClock: 0,
    fullMoveNumber: 1,
  });
}
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
  for (const entry of pieces) board[entry.boardId] = { ...entry.piece };
  return normaliseBoardPosition({
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
  });
}
