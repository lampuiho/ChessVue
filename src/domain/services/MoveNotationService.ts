import { MoveKind, PieceKind, ResultReason, ResultState, type IBoardPosition, type IMove } from '../../contracts'

import { findKingBoardId, getOpponentColour } from '../internal/Board'
import { boardIdToCoords, boardIdToNotation } from '../internal/Square'
import { GameRuleService } from './GameRuleService'

function pieceSymbol(kind: PieceKind): string {
  switch (kind) {
    case PieceKind.King:
      return 'K'
    case PieceKind.Queen:
      return 'Q'
    case PieceKind.Rook:
      return 'R'
    case PieceKind.Bishop:
      return 'B'
    case PieceKind.Knight:
      return 'N'
    case PieceKind.Pawn:
      return ''
  }
}
function promotionSuffix(piece: PieceKind | null | undefined): string {
  if (piece === null || piece === undefined) return '=?'
  return `=${pieceSymbol(piece)}`
}
function getPiece(position: IBoardPosition, boardId: number) {
  return position.piecesByBoardId[boardId]
}
function buildCheckSuffix(position: IBoardPosition, move: IMove): string {
  const resolvedMove = move.kind === MoveKind.Promotion && move.promotionPiece === null
    ? { ...move, promotionPiece: PieceKind.Queen }
    : move
  const nextPosition = GameRuleService.applyMove(position, resolvedMove)
  const result = GameRuleService.resolveResult(nextPosition)
  const opponent = getOpponentColour(move.movingColour)
  const opponentKingBoardId = findKingBoardId(nextPosition, opponent)
  if (opponentKingBoardId === null) return ''
  const attackerPosition: IBoardPosition = { ...nextPosition, sideToMove: move.movingColour }
  const attacksKing = GameRuleService.generateLegalMoves(attackerPosition).some((candidate) => candidate.to === opponentKingBoardId)
  if (!attacksKing) return ''
  return result.resultState !== ResultState.Ongoing && result.resultReason === ResultReason.RuleResolved ? '#' : '+'
}
function getDisambiguation(position: IBoardPosition, move: IMove, legalMoves: IMove[]): string {
  const movingPiece = getPiece(position, move.from)
  if (movingPiece === undefined || movingPiece.kind === PieceKind.Pawn || movingPiece.kind === PieceKind.King) return ''
  const contenders = legalMoves.filter((candidate) => {
    if (candidate.to !== move.to || candidate.from === move.from) return false
    const contenderPiece = getPiece(position, candidate.from)
    return contenderPiece?.kind === movingPiece.kind
  })
  if (contenders.length === 0) return ''
  const fromCoords = boardIdToCoords(move.from)
  const sameFile = contenders.some((candidate) => boardIdToCoords(candidate.from).file === fromCoords.file)
  const sameRank = contenders.some((candidate) => boardIdToCoords(candidate.from).rank === fromCoords.rank)
  if (!sameFile) return boardIdToNotation(move.from)[0]!
  if (!sameRank) return boardIdToNotation(move.from)[1]!
  return boardIdToNotation(move.from)
}
export const MoveNotationService = {
  buildSan(position: IBoardPosition, move: IMove): string {
    const legalMoves = GameRuleService.generateLegalMoves(position)
    if (!GameRuleService.isMoveLegal(position, { ...move, promotionPiece: move.promotionPiece ?? null })) {
      throw new Error('Cannot build SAN for an illegal move.')
    }

    if (move.kind === MoveKind.Castle) {
      const castleText = boardIdToCoords(move.to).file === 6 ? 'O-O' : 'O-O-O'
      return `${castleText}${buildCheckSuffix(position, move)}`
    }

    const movingPiece = getPiece(position, move.from)
    if (movingPiece === undefined) throw new Error(`No piece found on ${move.from}`)

    const capture = move.kind === MoveKind.EnPassant || getPiece(position, move.to) !== undefined
    const piecePrefix = movingPiece.kind === PieceKind.Pawn ? '' : pieceSymbol(movingPiece.kind)
    const pawnCapturePrefix = movingPiece.kind === PieceKind.Pawn && capture ? boardIdToNotation(move.from)[0]! : ''
    const disambiguation = getDisambiguation(position, move, legalMoves)
    const promotionText = move.kind === MoveKind.Promotion ? promotionSuffix(move.promotionPiece) : ''
    return `${piecePrefix}${pawnCapturePrefix}${disambiguation}${capture ? 'x' : ''}${boardIdToNotation(move.to)}${promotionText}${buildCheckSuffix(position, move)}`
  },
  buildUci(move: IMove): string {
    const promotionToken = move.promotionPiece === null || move.promotionPiece === undefined ? '' : pieceSymbol(move.promotionPiece).toLowerCase()
    return `${boardIdToNotation(move.from)}${boardIdToNotation(move.to)}${promotionToken}`
  },
  decorateMove(position: IBoardPosition, move: IMove): IMove {
    return {
      ...move,
      $: {
        ...move.$,
        san: this.buildSan(position, move),
        uci: this.buildUci(move),
      },
    }
  },
}
