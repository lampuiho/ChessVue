import type { IBoardPosition, ICastlingAvailability, IChessPiece, SquareId } from '../Contracts'
import { PieceKind, PlayerColour } from '../Contracts'

import { withFen } from './Fen'

export function clonePiecesBySquare(piecesBySquare: IBoardPosition['piecesBySquare']): IBoardPosition['piecesBySquare'] {
  const clone: IBoardPosition['piecesBySquare'] = {}

  for (const [square, piece] of Object.entries(piecesBySquare)) {
    if (piece !== undefined) {
      clone[square as SquareId] = { ...piece }
    }
  }

  return clone
}

export function cloneBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    piecesBySquare: clonePiecesBySquare(position.piecesBySquare),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTarget: position.enPassantTarget,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
    fen: position.fen,
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
  const piecesBySquare: IBoardPosition['piecesBySquare'] = {
    a1: { kind: PieceKind.Rook, colour: PlayerColour.White },
    b1: { kind: PieceKind.Knight, colour: PlayerColour.White },
    c1: { kind: PieceKind.Bishop, colour: PlayerColour.White },
    d1: { kind: PieceKind.Queen, colour: PlayerColour.White },
    e1: { kind: PieceKind.King, colour: PlayerColour.White },
    f1: { kind: PieceKind.Bishop, colour: PlayerColour.White },
    g1: { kind: PieceKind.Knight, colour: PlayerColour.White },
    h1: { kind: PieceKind.Rook, colour: PlayerColour.White },
    a8: { kind: PieceKind.Rook, colour: PlayerColour.Black },
    b8: { kind: PieceKind.Knight, colour: PlayerColour.Black },
    c8: { kind: PieceKind.Bishop, colour: PlayerColour.Black },
    d8: { kind: PieceKind.Queen, colour: PlayerColour.Black },
    e8: { kind: PieceKind.King, colour: PlayerColour.Black },
    f8: { kind: PieceKind.Bishop, colour: PlayerColour.Black },
    g8: { kind: PieceKind.Knight, colour: PlayerColour.Black },
    h8: { kind: PieceKind.Rook, colour: PlayerColour.Black },
  }

  for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const) {
    piecesBySquare[`${file}2`] = { kind: PieceKind.Pawn, colour: PlayerColour.White }
    piecesBySquare[`${file}7`] = { kind: PieceKind.Pawn, colour: PlayerColour.Black }
  }

  return withFen({
    piecesBySquare,
    sideToMove: PlayerColour.White,
    castlingAvailability: createDefaultCastlingAvailability(),
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  })
}

export function getOpponentColour(colour: PlayerColour): PlayerColour {
  return colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White
}

export function findKingSquare(position: IBoardPosition, colour: PlayerColour): SquareId | null {
  for (const [square, piece] of Object.entries(position.piecesBySquare)) {
    if (piece?.kind === PieceKind.King && piece.colour === colour) {
      return square as SquareId
    }
  }

  return null
}

export function normaliseBoardPosition(position: Omit<IBoardPosition, 'fen'> | IBoardPosition): IBoardPosition {
  return withFen({
    piecesBySquare: clonePiecesBySquare(position.piecesBySquare),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTarget: position.enPassantTarget,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
  })
}

export function createSparseBoard(pieces: Array<{ square: SquareId; piece: IChessPiece }>, sideToMove: PlayerColour = PlayerColour.White): IBoardPosition {
  const piecesBySquare: IBoardPosition['piecesBySquare'] = {}

  for (const entry of pieces) {
    piecesBySquare[entry.square] = { ...entry.piece }
  }

  return withFen({
    piecesBySquare,
    sideToMove,
    castlingAvailability: {
      whiteKingSide: false,
      whiteQueenSide: false,
      blackKingSide: false,
      blackQueenSide: false,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  })
}
