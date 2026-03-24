import type { IBoardPosition, IMove, PieceKind, PlayerColour, SquareId } from '../Contracts'

import { cloneBoardPosition, findKingSquare, getOpponentColour, normaliseBoardPosition } from '../Internal/Board'
import { coordsToSquare, getForwardDirection, getPawnHomeRank, getPromotionRank, squareToCoords } from '../Internal/Square'

interface ICandidateMove {
  from: SquareId
  to: SquareId
  kind: IMove['kind']
  movingColour: PlayerColour
  promotionPiece: PieceKind | null
}

const promotionPieces: PieceKind[] = ['queen', 'rook', 'bishop', 'knight']
const knightOffsets = [
  { file: -2, rank: -1 },
  { file: -2, rank: 1 },
  { file: -1, rank: -2 },
  { file: -1, rank: 2 },
  { file: 1, rank: -2 },
  { file: 1, rank: 2 },
  { file: 2, rank: -1 },
  { file: 2, rank: 1 },
]
const bishopDirections = [
  { file: -1, rank: -1 },
  { file: -1, rank: 1 },
  { file: 1, rank: -1 },
  { file: 1, rank: 1 },
]
const rookDirections = [
  { file: -1, rank: 0 },
  { file: 1, rank: 0 },
  { file: 0, rank: -1 },
  { file: 0, rank: 1 },
]
const queenDirections = [...bishopDirections, ...rookDirections]
const kingOffsets = [
  { file: -1, rank: -1 },
  { file: -1, rank: 0 },
  { file: -1, rank: 1 },
  { file: 0, rank: -1 },
  { file: 0, rank: 1 },
  { file: 1, rank: -1 },
  { file: 1, rank: 0 },
  { file: 1, rank: 1 },
]

function pieceSymbol(kind: PieceKind): string {
  switch (kind) {
    case 'king':
      return 'K'
    case 'queen':
      return 'Q'
    case 'rook':
      return 'R'
    case 'bishop':
      return 'B'
    case 'knight':
      return 'N'
    case 'pawn':
      return ''
  }
}

function promotionSuffix(piece: PieceKind | null): string {
  if (piece === null) {
    return '=?'
  }

  return `=${pieceSymbol(piece)}`
}

function createMove(candidate: ICandidateMove, san: string): IMove {
  const promotionToken = candidate.promotionPiece === null ? '' : pieceSymbol(candidate.promotionPiece).toLowerCase()

  return {
    ...candidate,
    san,
    uci: `${candidate.from}${candidate.to}${promotionToken}`,
  }
}

function getPiece(position: IBoardPosition, square: SquareId) {
  return position.piecesBySquare[square]
}

function isOccupied(position: IBoardPosition, square: SquareId): boolean {
  return getPiece(position, square) !== undefined
}

function isOccupiedByColour(position: IBoardPosition, square: SquareId, colour: PlayerColour): boolean {
  return getPiece(position, square)?.colour === colour
}

function addSlidingMoves(position: IBoardPosition, from: SquareId, colour: PlayerColour, directions: Array<{ file: number; rank: number }>, accumulator: ICandidateMove[]): void {
  const origin = squareToCoords(from)

  for (const direction of directions) {
    let file = origin.file + direction.file
    let rank = origin.rank + direction.rank

    while (true) {
      const target = coordsToSquare(file, rank)

      if (target === null) {
        break
      }

      if (isOccupiedByColour(position, target, colour)) {
        break
      }

      accumulator.push({
        from,
        to: target,
        kind: 'normal',
        movingColour: colour,
        promotionPiece: null,
      })

      if (isOccupied(position, target)) {
        break
      }

      file += direction.file
      rank += direction.rank
    }
  }
}

function addPawnMoves(position: IBoardPosition, from: SquareId, colour: PlayerColour, accumulator: ICandidateMove[]): void {
  const origin = squareToCoords(from)
  const direction = getForwardDirection(colour)
  const oneForward = coordsToSquare(origin.file, origin.rank + direction)

  if (oneForward !== null && !isOccupied(position, oneForward)) {
    const isPromotion = squareToCoords(oneForward).rank === getPromotionRank(colour)
    accumulator.push({
      from,
      to: oneForward,
      kind: isPromotion ? 'promotion' : 'normal',
      movingColour: colour,
      promotionPiece: null,
    })

    if (origin.rank === getPawnHomeRank(colour)) {
      const twoForward = coordsToSquare(origin.file, origin.rank + (direction * 2))

      if (twoForward !== null && !isOccupied(position, twoForward)) {
        accumulator.push({
          from,
          to: twoForward,
          kind: 'normal',
          movingColour: colour,
          promotionPiece: null,
        })
      }
    }
  }

  for (const fileOffset of [-1, 1]) {
    const target = coordsToSquare(origin.file + fileOffset, origin.rank + direction)

    if (target === null) {
      continue
    }

    const targetPiece = getPiece(position, target)
    const isPromotion = squareToCoords(target).rank === getPromotionRank(colour)

    if (targetPiece !== undefined && targetPiece.colour !== colour) {
      accumulator.push({
        from,
        to: target,
        kind: isPromotion ? 'promotion' : 'normal',
        movingColour: colour,
        promotionPiece: null,
      })
    }

    if (position.enPassantTarget === target) {
      const capturedSquare = coordsToSquare(origin.file + fileOffset, origin.rank)
      const capturedPiece = capturedSquare === null ? undefined : getPiece(position, capturedSquare)

      if (capturedPiece?.kind === 'pawn' && capturedPiece.colour !== colour) {
        accumulator.push({
          from,
          to: target,
          kind: 'enPassant',
          movingColour: colour,
          promotionPiece: null,
        })
      }
    }
  }
}

function addKnightMoves(position: IBoardPosition, from: SquareId, colour: PlayerColour, accumulator: ICandidateMove[]): void {
  const origin = squareToCoords(from)

  for (const offset of knightOffsets) {
    const target = coordsToSquare(origin.file + offset.file, origin.rank + offset.rank)

    if (target === null || isOccupiedByColour(position, target, colour)) {
      continue
    }

    accumulator.push({
      from,
      to: target,
      kind: 'normal',
      movingColour: colour,
      promotionPiece: null,
    })
  }
}

function addKingMoves(position: IBoardPosition, from: SquareId, colour: PlayerColour, accumulator: ICandidateMove[]): void {
  const origin = squareToCoords(from)

  for (const offset of kingOffsets) {
    const target = coordsToSquare(origin.file + offset.file, origin.rank + offset.rank)

    if (target === null || isOccupiedByColour(position, target, colour)) {
      continue
    }

    accumulator.push({
      from,
      to: target,
      kind: 'normal',
      movingColour: colour,
      promotionPiece: null,
    })
  }

  const enemyColour = getOpponentColour(colour)
  const homeRank = colour === 'white' ? 0 : 7
  const kingSquare = coordsToSquare(4, homeRank)

  if (kingSquare !== from || isSquareAttacked(position, from, enemyColour)) {
    return
  }

  const kingSideClear = [coordsToSquare(5, homeRank), coordsToSquare(6, homeRank)].every((square) => square !== null && !isOccupied(position, square))
  const queenSideClear = [coordsToSquare(1, homeRank), coordsToSquare(2, homeRank), coordsToSquare(3, homeRank)].every((square) => square !== null && !isOccupied(position, square))
  const kingSidePath = [coordsToSquare(5, homeRank), coordsToSquare(6, homeRank)]
  const queenSidePath = [coordsToSquare(3, homeRank), coordsToSquare(2, homeRank)]
  const rookKingSide = coordsToSquare(7, homeRank)
  const rookQueenSide = coordsToSquare(0, homeRank)

  if ((colour === 'white' ? position.castlingAvailability.whiteKingSide : position.castlingAvailability.blackKingSide)
    && rookKingSide !== null
    && getPiece(position, rookKingSide)?.kind === 'rook'
    && kingSideClear
    && kingSidePath.every((square) => square !== null && !isSquareAttacked(position, square, enemyColour))) {
    const target = coordsToSquare(6, homeRank)

    if (target !== null) {
      accumulator.push({
        from,
        to: target,
        kind: 'castle',
        movingColour: colour,
        promotionPiece: null,
      })
    }
  }

  if ((colour === 'white' ? position.castlingAvailability.whiteQueenSide : position.castlingAvailability.blackQueenSide)
    && rookQueenSide !== null
    && getPiece(position, rookQueenSide)?.kind === 'rook'
    && queenSideClear
    && queenSidePath.every((square) => square !== null && !isSquareAttacked(position, square, enemyColour))) {
    const target = coordsToSquare(2, homeRank)

    if (target !== null) {
      accumulator.push({
        from,
        to: target,
        kind: 'castle',
        movingColour: colour,
        promotionPiece: null,
      })
    }
  }
}

function generatePseudoLegalMoves(position: IBoardPosition, colour: PlayerColour): ICandidateMove[] {
  const accumulator: ICandidateMove[] = []

  for (const [square, piece] of Object.entries(position.piecesBySquare)) {
    if (piece?.colour !== colour) {
      continue
    }

    const from = square as SquareId

    switch (piece.kind) {
      case 'pawn':
        addPawnMoves(position, from, colour, accumulator)
        break
      case 'knight':
        addKnightMoves(position, from, colour, accumulator)
        break
      case 'bishop':
        addSlidingMoves(position, from, colour, bishopDirections, accumulator)
        break
      case 'rook':
        addSlidingMoves(position, from, colour, rookDirections, accumulator)
        break
      case 'queen':
        addSlidingMoves(position, from, colour, queenDirections, accumulator)
        break
      case 'king':
        addKingMoves(position, from, colour, accumulator)
        break
    }
  }

  return accumulator
}

function isSquareAttacked(position: IBoardPosition, target: SquareId, byColour: PlayerColour): boolean {
  const targetCoords = squareToCoords(target)
  const pawnRank = targetCoords.rank - getForwardDirection(byColour)

  for (const fileOffset of [-1, 1]) {
    const attackerSquare = coordsToSquare(targetCoords.file + fileOffset, pawnRank)
    if (attackerSquare !== null) {
      const attacker = getPiece(position, attackerSquare)
      if (attacker?.colour === byColour && attacker.kind === 'pawn') {
        return true
      }
    }
  }

  for (const offset of knightOffsets) {
    const attackerSquare = coordsToSquare(targetCoords.file + offset.file, targetCoords.rank + offset.rank)
    if (attackerSquare !== null) {
      const attacker = getPiece(position, attackerSquare)
      if (attacker?.colour === byColour && attacker.kind === 'knight') {
        return true
      }
    }
  }

  for (const direction of bishopDirections) {
    let file = targetCoords.file + direction.file
    let rank = targetCoords.rank + direction.rank

    while (true) {
      const attackerSquare = coordsToSquare(file, rank)
      if (attackerSquare === null) {
        break
      }

      const attacker = getPiece(position, attackerSquare)
      if (attacker !== undefined) {
        if (attacker.colour === byColour && (attacker.kind === 'bishop' || attacker.kind === 'queen')) {
          return true
        }
        break
      }

      file += direction.file
      rank += direction.rank
    }
  }

  for (const direction of rookDirections) {
    let file = targetCoords.file + direction.file
    let rank = targetCoords.rank + direction.rank

    while (true) {
      const attackerSquare = coordsToSquare(file, rank)
      if (attackerSquare === null) {
        break
      }

      const attacker = getPiece(position, attackerSquare)
      if (attacker !== undefined) {
        if (attacker.colour === byColour && (attacker.kind === 'rook' || attacker.kind === 'queen')) {
          return true
        }
        break
      }

      file += direction.file
      rank += direction.rank
    }
  }

  for (const offset of kingOffsets) {
    const attackerSquare = coordsToSquare(targetCoords.file + offset.file, targetCoords.rank + offset.rank)
    if (attackerSquare !== null) {
      const attacker = getPiece(position, attackerSquare)
      if (attacker?.colour === byColour && attacker.kind === 'king') {
        return true
      }
    }
  }

  return false
}

function updateCastlingAvailability(position: IBoardPosition, move: ICandidateMove): IBoardPosition['castlingAvailability'] {
  const nextCastlingAvailability = { ...position.castlingAvailability }
  const movingPiece = getPiece(position, move.from)
  const capturedPiece = move.kind === 'enPassant'
    ? undefined
    : getPiece(position, move.to)

  if (movingPiece?.kind === 'king') {
    if (movingPiece.colour === 'white') {
      nextCastlingAvailability.whiteKingSide = false
      nextCastlingAvailability.whiteQueenSide = false
    } else {
      nextCastlingAvailability.blackKingSide = false
      nextCastlingAvailability.blackQueenSide = false
    }
  }

  if (movingPiece?.kind === 'rook') {
    if (move.from === 'a1') {
      nextCastlingAvailability.whiteQueenSide = false
    }
    if (move.from === 'h1') {
      nextCastlingAvailability.whiteKingSide = false
    }
    if (move.from === 'a8') {
      nextCastlingAvailability.blackQueenSide = false
    }
    if (move.from === 'h8') {
      nextCastlingAvailability.blackKingSide = false
    }
  }

  if (capturedPiece?.kind === 'rook') {
    if (move.to === 'a1') {
      nextCastlingAvailability.whiteQueenSide = false
    }
    if (move.to === 'h1') {
      nextCastlingAvailability.whiteKingSide = false
    }
    if (move.to === 'a8') {
      nextCastlingAvailability.blackQueenSide = false
    }
    if (move.to === 'h8') {
      nextCastlingAvailability.blackKingSide = false
    }
  }

  return nextCastlingAvailability
}

function applyCandidateMove(position: IBoardPosition, move: ICandidateMove): IBoardPosition {
  const movingPiece = getPiece(position, move.from)

  if (movingPiece === undefined) {
    throw new Error(`No piece found on ${move.from}`)
  }

  if (move.kind === 'promotion' && move.promotionPiece === null) {
    throw new Error('Promotion piece selection is required before applying a promotion move.')
  }

  const nextPosition = cloneBoardPosition(position)
  delete nextPosition.piecesBySquare[move.from]

  let isCapture = getPiece(position, move.to) !== undefined

  if (move.kind === 'enPassant') {
    const fromCoords = squareToCoords(move.from)
    const toCoords = squareToCoords(move.to)
    const capturedSquare = coordsToSquare(toCoords.file, fromCoords.rank)

    if (capturedSquare !== null) {
      delete nextPosition.piecesBySquare[capturedSquare]
      isCapture = true
    }
  }

  if (move.kind === 'castle') {
    const homeRank = movingPiece.colour === 'white' ? 0 : 7
    const isKingSide = squareToCoords(move.to).file === 6
    const rookFrom = coordsToSquare(isKingSide ? 7 : 0, homeRank)
    const rookTo = coordsToSquare(isKingSide ? 5 : 3, homeRank)

    if (rookFrom !== null && rookTo !== null) {
      const rook = getPiece(position, rookFrom)
      if (rook !== undefined) {
        delete nextPosition.piecesBySquare[rookFrom]
        nextPosition.piecesBySquare[rookTo] = rook
      }
    }
  }

  nextPosition.piecesBySquare[move.to] = move.kind === 'promotion'
    ? { kind: move.promotionPiece!, colour: movingPiece.colour }
    : movingPiece

  nextPosition.castlingAvailability = updateCastlingAvailability(position, move)
  nextPosition.enPassantTarget = null

  const fromCoords = squareToCoords(move.from)
  const toCoords = squareToCoords(move.to)
  if (movingPiece.kind === 'pawn' && Math.abs(toCoords.rank - fromCoords.rank) === 2) {
    nextPosition.enPassantTarget = coordsToSquare(fromCoords.file, fromCoords.rank + getForwardDirection(movingPiece.colour))
  }

  nextPosition.halfMoveClock = movingPiece.kind === 'pawn' || isCapture ? 0 : position.halfMoveClock + 1
  nextPosition.fullMoveNumber = movingPiece.colour === 'black' ? position.fullMoveNumber + 1 : position.fullMoveNumber
  nextPosition.sideToMove = getOpponentColour(movingPiece.colour)

  return normaliseBoardPosition(nextPosition)
}

function isLegalCandidate(position: IBoardPosition, move: ICandidateMove): boolean {
  const movingPiece = getPiece(position, move.from)
  if (movingPiece === undefined || movingPiece.colour !== move.movingColour) {
    return false
  }

  const promotionResolvedMoves = move.kind === 'promotion' && move.promotionPiece === null
    ? promotionPieces.map((piece) => ({ ...move, promotionPiece: piece }))
    : [move]

  return promotionResolvedMoves.some((resolvedMove) => {
    const nextPosition = applyCandidateMove(position, resolvedMove)
    return !isSquareAttacked(nextPosition, findKingSquare(nextPosition, move.movingColour)!, getOpponentColour(move.movingColour))
  })
}

function moveMatches(candidate: Pick<IMove, 'from' | 'to' | 'kind' | 'movingColour' | 'promotionPiece'>, move: IMove): boolean {
  if (candidate.from !== move.from || candidate.to !== move.to || candidate.kind !== move.kind || candidate.movingColour !== move.movingColour) {
    return false
  }

  if (candidate.kind !== 'promotion') {
    return candidate.promotionPiece === move.promotionPiece
  }

  return move.promotionPiece === null || promotionPieces.includes(move.promotionPiece)
}

function getDisambiguation(position: IBoardPosition, move: ICandidateMove, legalMoves: ICandidateMove[]): string {
  const movingPiece = getPiece(position, move.from)
  if (movingPiece === undefined || movingPiece.kind === 'pawn' || movingPiece.kind === 'king') {
    return ''
  }

  const contenders = legalMoves.filter((candidate) => {
    if (candidate === move || candidate.to !== move.to || candidate.from === move.from) {
      return false
    }

    const contenderPiece = getPiece(position, candidate.from)
    return contenderPiece?.kind === movingPiece.kind
  })

  if (contenders.length === 0) {
    return ''
  }

  const fromCoords = squareToCoords(move.from)
  const sameFile = contenders.some((candidate) => squareToCoords(candidate.from).file === fromCoords.file)
  const sameRank = contenders.some((candidate) => squareToCoords(candidate.from).rank === fromCoords.rank)

  if (!sameFile) {
    return move.from[0]
  }

  if (!sameRank) {
    return move.from[1]
  }

  return move.from
}

function buildSan(position: IBoardPosition, move: ICandidateMove, legalMoves: ICandidateMove[]): string {
  if (move.kind === 'castle') {
    const san = squareToCoords(move.to).file === 6 ? 'O-O' : 'O-O-O'
    const resolvedMove = applyCandidateMove(position, move)
    const opponent = resolvedMove.sideToMove
    const opponentLegalMoves = generatePseudoLegalMoves(resolvedMove, opponent).filter((candidate) => isLegalCandidate(resolvedMove, candidate))
    const opponentKing = findKingSquare(resolvedMove, opponent)
    const suffix = opponentKing !== null && isSquareAttacked(resolvedMove, opponentKing, move.movingColour)
      ? opponentLegalMoves.length === 0 ? '#' : '+'
      : ''

    return `${san}${suffix}`
  }

  const movingPiece = getPiece(position, move.from)
  if (movingPiece === undefined) {
    throw new Error(`No piece found on ${move.from}`)
  }

  const capture = move.kind === 'enPassant' || getPiece(position, move.to) !== undefined
  const piecePrefix = movingPiece.kind === 'pawn' ? '' : pieceSymbol(movingPiece.kind)
  const pawnCapturePrefix = movingPiece.kind === 'pawn' && capture ? move.from[0] : ''
  const disambiguation = getDisambiguation(position, move, legalMoves)
  const promotionText = move.kind === 'promotion' ? promotionSuffix(move.promotionPiece) : ''
  const resolvedMoves = move.kind === 'promotion' && move.promotionPiece === null
    ? [{ ...move, promotionPiece: 'queen' as const }]
    : [move]
  const resolvedPosition = applyCandidateMove(position, resolvedMoves[0])
  const opponent = resolvedPosition.sideToMove
  const opponentLegalMoves = generatePseudoLegalMoves(resolvedPosition, opponent).filter((candidate) => isLegalCandidate(resolvedPosition, candidate))
  const opponentKing = findKingSquare(resolvedPosition, opponent)
  const suffix = opponentKing !== null && isSquareAttacked(resolvedPosition, opponentKing, move.movingColour)
    ? opponentLegalMoves.length === 0 ? '#' : '+'
    : ''

  return `${piecePrefix}${pawnCapturePrefix}${disambiguation}${capture ? 'x' : ''}${move.to}${promotionText}${suffix}`
}

function mapCandidateToMove(position: IBoardPosition, candidate: ICandidateMove, legalMoves: ICandidateMove[]): IMove {
  return createMove(candidate, buildSan(position, candidate, legalMoves))
}

function hasInsufficientMaterial(position: IBoardPosition): boolean {
  const pieces = Object.values(position.piecesBySquare)
  const nonKingPieces = pieces.filter((piece) => piece !== undefined && piece.kind !== 'king')

  if (nonKingPieces.length === 0) {
    return true
  }

  if (nonKingPieces.length === 1) {
    return nonKingPieces[0].kind === 'bishop' || nonKingPieces[0].kind === 'knight'
  }

  if (nonKingPieces.length === 2) {
    const disallowed = nonKingPieces.some((piece) => piece.kind === 'queen' || piece.kind === 'rook' || piece.kind === 'pawn')
    if (disallowed) {
      return false
    }

    const bishopKnightCount = nonKingPieces.filter((piece) => piece.kind === 'bishop' || piece.kind === 'knight').length
    return bishopKnightCount === 2
  }

  return false
}

export const GameRuleService = {
  generateLegalMoves(position: IBoardPosition): IMove[] {
    const normalisedPosition = normaliseBoardPosition(position)
    const candidates = generatePseudoLegalMoves(normalisedPosition, normalisedPosition.sideToMove)
      .filter((candidate) => isLegalCandidate(normalisedPosition, candidate))

    return candidates.map((candidate) => mapCandidateToMove(normalisedPosition, candidate, candidates))
  },

  isMoveLegal(position: IBoardPosition, move: IMove): boolean {
    return this.generateLegalMoves(position).some((candidate) => moveMatches(candidate, move))
  },

  requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean {
    const piece = getPiece(position, move.from)
    if (piece?.kind !== 'pawn') {
      return false
    }

    const destinationRank = squareToCoords(move.to).rank
    return destinationRank === getPromotionRank(piece.colour) && move.promotionPiece === null
  },

  applyMove(position: IBoardPosition, move: IMove): IBoardPosition {
    const legalMoves = this.generateLegalMoves(position)
    const matchingMove = legalMoves.find((candidate) => moveMatches(candidate, move))

    if (matchingMove === undefined) {
      throw new Error('Cannot apply an illegal move.')
    }

    if (this.requiresPromotionSelection(position, move)) {
      throw new Error('Promotion piece selection is required before applying a promotion move.')
    }

    return applyCandidateMove(position, {
      from: matchingMove.from,
      to: matchingMove.to,
      kind: matchingMove.kind,
      movingColour: matchingMove.movingColour,
      promotionPiece: move.promotionPiece,
    })
  },

  resolveResult(position: IBoardPosition) {
    if (hasInsufficientMaterial(position)) {
      return {
        resultState: 'drawn' as const,
        resultReason: 'ruleResolved' as const,
      }
    }

    const legalMoves = this.generateLegalMoves(position)
    if (legalMoves.length > 0) {
      return {
        resultState: 'ongoing' as const,
        resultReason: null,
      }
    }

    const kingSquare = findKingSquare(position, position.sideToMove)
    if (kingSquare !== null && isSquareAttacked(position, kingSquare, getOpponentColour(position.sideToMove))) {
      return {
        resultState: position.sideToMove === 'white' ? 'blackWon' as const : 'whiteWon' as const,
        resultReason: 'ruleResolved' as const,
      }
    }

    return {
      resultState: 'drawn' as const,
      resultReason: 'ruleResolved' as const,
    }
  },
}
