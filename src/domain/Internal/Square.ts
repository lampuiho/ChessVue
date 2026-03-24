import { PlayerColour, squareIds, type SquareId } from '../Contracts'

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export function isSquareId(value: string): value is SquareId {
  return squareIds.includes(value as SquareId)
}

export function squareToCoords(square: SquareId): { file: number; rank: number } {
  return {
    file: files.indexOf(square[0] as (typeof files)[number]),
    rank: ranks.indexOf(square[1] as (typeof ranks)[number]),
  }
}

export function coordsToSquare(file: number, rank: number): SquareId | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null
  }

  return `${files[file]}${ranks[rank]}` as SquareId
}

export function squareToIndex(square: SquareId): number {
  const { file, rank } = squareToCoords(square)

  return (rank * 8) + file
}

export function indexToSquare(index: number): SquareId {
  const file = index % 8
  const rank = Math.floor(index / 8)
  const square = coordsToSquare(file, rank)

  if (square === null) {
    throw new Error(`Invalid square index: ${index}`)
  }

  return square
}

export function getForwardDirection(colour: PlayerColour): number {
  return colour === PlayerColour.White ? 1 : -1
}

export function getPawnHomeRank(colour: PlayerColour): number {
  return colour === PlayerColour.White ? 1 : 6
}

export function getPromotionRank(colour: PlayerColour): number {
  return colour === PlayerColour.White ? 7 : 0
}
