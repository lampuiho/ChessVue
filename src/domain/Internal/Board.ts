import type { IBoardPosition, ICastlingAvailability, IChessPiece, PlayerColour, SquareId } from '../Contracts'

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
    a1: { kind: 'rook', colour: 'white' },
    b1: { kind: 'knight', colour: 'white' },
    c1: { kind: 'bishop', colour: 'white' },
    d1: { kind: 'queen', colour: 'white' },
    e1: { kind: 'king', colour: 'white' },
    f1: { kind: 'bishop', colour: 'white' },
    g1: { kind: 'knight', colour: 'white' },
    h1: { kind: 'rook', colour: 'white' },
    a8: { kind: 'rook', colour: 'black' },
    b8: { kind: 'knight', colour: 'black' },
    c8: { kind: 'bishop', colour: 'black' },
    d8: { kind: 'queen', colour: 'black' },
    e8: { kind: 'king', colour: 'black' },
    f8: { kind: 'bishop', colour: 'black' },
    g8: { kind: 'knight', colour: 'black' },
    h8: { kind: 'rook', colour: 'black' },
  }

  for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const) {
    piecesBySquare[`${file}2`] = { kind: 'pawn', colour: 'white' }
    piecesBySquare[`${file}7`] = { kind: 'pawn', colour: 'black' }
  }

  return withFen({
    piecesBySquare,
    sideToMove: 'white',
    castlingAvailability: createDefaultCastlingAvailability(),
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  })
}

export function getOpponentColour(colour: PlayerColour): PlayerColour {
  return colour === 'white' ? 'black' : 'white'
}

export function findKingSquare(position: IBoardPosition, colour: PlayerColour): SquareId | null {
  for (const [square, piece] of Object.entries(position.piecesBySquare)) {
    if (piece?.kind === 'king' && piece.colour === colour) {
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

export function createSparseBoard(pieces: Array<{ square: SquareId; piece: IChessPiece }>, sideToMove: PlayerColour = 'white'): IBoardPosition {
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
