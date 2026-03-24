import type { IBoardPosition, ICastlingAvailability } from '../Contracts'

import { coordsToSquare } from './Square'

const pieceToFen: Record<string, string> = {
  king_white: 'K',
  queen_white: 'Q',
  rook_white: 'R',
  bishop_white: 'B',
  knight_white: 'N',
  pawn_white: 'P',
  king_black: 'k',
  queen_black: 'q',
  rook_black: 'r',
  bishop_black: 'b',
  knight_black: 'n',
  pawn_black: 'p',
}

export function buildCastlingField(castlingAvailability: ICastlingAvailability): string {
  const tokens = [
    castlingAvailability.whiteKingSide ? 'K' : '',
    castlingAvailability.whiteQueenSide ? 'Q' : '',
    castlingAvailability.blackKingSide ? 'k' : '',
    castlingAvailability.blackQueenSide ? 'q' : '',
  ].join('')

  return tokens === '' ? '-' : tokens
}

export function buildFen(position: Omit<IBoardPosition, 'fen'>): string {
  const rows: string[] = []

  for (let rank = 7; rank >= 0; rank -= 1) {
    let emptyCount = 0
    let row = ''

    for (let file = 0; file < 8; file += 1) {
      const square = coordsToSquare(file, rank)

      if (square === null) {
        continue
      }

      const piece = position.piecesBySquare[square]

      if (piece === undefined) {
        emptyCount += 1
        continue
      }

      if (emptyCount > 0) {
        row += `${emptyCount}`
        emptyCount = 0
      }

      row += pieceToFen[`${piece.kind}_${piece.colour}`]
    }

    if (emptyCount > 0) {
      row += `${emptyCount}`
    }

    rows.push(row)
  }

  return [
    rows.join('/'),
    position.sideToMove === 'white' ? 'w' : 'b',
    buildCastlingField(position.castlingAvailability),
    position.enPassantTarget ?? '-',
    position.halfMoveClock.toString(),
    position.fullMoveNumber.toString(),
  ].join(' ')
}

export function withFen(position: Omit<IBoardPosition, 'fen'>): IBoardPosition {
  return {
    ...position,
    fen: buildFen(position),
  }
}
