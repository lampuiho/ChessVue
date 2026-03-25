import type { IBoardPosition } from '../../contracts'

function buildCastlingField(position: IBoardPosition): string {
  return [
    position.castlingAvailability.whiteKingSide ? 'K' : '',
    position.castlingAvailability.whiteQueenSide ? 'Q' : '',
    position.castlingAvailability.blackKingSide ? 'k' : '',
    position.castlingAvailability.blackQueenSide ? 'q' : '',
  ].join('')
}
export const PositionIdentityService = {
  buildPositionKey(position: IBoardPosition): string {
    const pieceTokens = Object.keys(position.piecesByBoardId)
      .map((key) => Number(key))
      .sort((left, right) => left - right)
      .map((boardId) => {
        const piece = position.piecesByBoardId[boardId]!
        return `${boardId}:${piece.kind}:${piece.colour}`
      })

    return [
      pieceTokens.join('|'),
      position.sideToMove,
      buildCastlingField(position),
      position.enPassantTargetId === null ? '-' : position.enPassantTargetId.toString(),
      position.halfMoveClock.toString(),
      position.fullMoveNumber.toString(),
    ].join(' ')
  },
}
