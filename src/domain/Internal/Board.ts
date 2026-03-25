import type { BoardId, IBoardPosition, ICastlingAvailability, IChessPiece } from '@/contracts'
import { PieceKind, PlayerColour } from '@/contracts'

import { coordsToBoardId, isBoardId } from './Square'

export function clonePiecesByBoardId(piecesByBoardId: IBoardPosition['piecesByBoardId']): IBoardPosition['piecesByBoardId'] {
  const clone: IBoardPosition['piecesByBoardId'] = {}

  const boardIds = Object.keys(piecesByBoardId)
    .map((key) => Number(key))
    .filter(isBoardId)
    .sort((left, right) => left - right)

  for (const boardId of boardIds) {
    const piece = piecesByBoardId[boardId]
    if (piece !== undefined) clone[boardId] = { ...piece }
  }

  return clone
}
export function cloneBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    piecesByBoardId: clonePiecesByBoardId(position.piecesByBoardId),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTargetId: position.enPassantTargetId,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
  }
}
export function createDefaultCastlingAvailability(): ICastlingAvailability {
  return {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  }
}
export function createInitialBoardPosition(): IBoardPosition {
  const piecesByBoardId: IBoardPosition['piecesByBoardId'] = {
    0: { kind: PieceKind.Rook, colour: PlayerColour.White },
    1: { kind: PieceKind.Knight, colour: PlayerColour.White },
    2: { kind: PieceKind.Bishop, colour: PlayerColour.White },
    3: { kind: PieceKind.Queen, colour: PlayerColour.White },
    4: { kind: PieceKind.King, colour: PlayerColour.White },
    5: { kind: PieceKind.Bishop, colour: PlayerColour.White },
    6: { kind: PieceKind.Knight, colour: PlayerColour.White },
    7: { kind: PieceKind.Rook, colour: PlayerColour.White },
    56: { kind: PieceKind.Rook, colour: PlayerColour.Black },
    57: { kind: PieceKind.Knight, colour: PlayerColour.Black },
    58: { kind: PieceKind.Bishop, colour: PlayerColour.Black },
    59: { kind: PieceKind.Queen, colour: PlayerColour.Black },
    60: { kind: PieceKind.King, colour: PlayerColour.Black },
    61: { kind: PieceKind.Bishop, colour: PlayerColour.Black },
    62: { kind: PieceKind.Knight, colour: PlayerColour.Black },
    63: { kind: PieceKind.Rook, colour: PlayerColour.Black },
  }

  for (let file = 0; file < 8; file += 1) {
    const whitePawnBoardId = coordsToBoardId(file, 1)
    const blackPawnBoardId = coordsToBoardId(file, 6)
    if (whitePawnBoardId !== null) piecesByBoardId[whitePawnBoardId] = { kind: PieceKind.Pawn, colour: PlayerColour.White }
    if (blackPawnBoardId !== null) piecesByBoardId[blackPawnBoardId] = { kind: PieceKind.Pawn, colour: PlayerColour.Black }
  }

  return normaliseBoardPosition({
    piecesByBoardId,
    sideToMove: PlayerColour.White,
    castlingAvailability: createDefaultCastlingAvailability(),
    enPassantTargetId: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  })
}
export function getOpponentColour(colour: PlayerColour): PlayerColour {
  return colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White
}
export function findKingBoardId(position: IBoardPosition, colour: PlayerColour): BoardId | null {
  for (const [boardIdKey, piece] of Object.entries(position.piecesByBoardId)) {
    if (piece?.kind === PieceKind.King && piece.colour === colour) {
      return Number(boardIdKey)
    }
  }

  return null
}
export function normaliseBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    piecesByBoardId: clonePiecesByBoardId(position.piecesByBoardId),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTargetId: position.enPassantTargetId,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
  }
}
export function createSparseBoard(pieces: Array<{ boardId: BoardId; piece: IChessPiece }>, sideToMove: PlayerColour = PlayerColour.White): IBoardPosition {
  const piecesByBoardId: IBoardPosition['piecesByBoardId'] = {}

  for (const entry of pieces) {
    piecesByBoardId[entry.boardId] = { ...entry.piece }
  }

  return normaliseBoardPosition({
    piecesByBoardId,
    sideToMove,
    castlingAvailability: {
      whiteKingSide: false,
      whiteQueenSide: false,
      blackKingSide: false,
      blackQueenSide: false,
    },
    enPassantTargetId: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  })
}
