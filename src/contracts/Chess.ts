import { z } from 'zod'

export const enum PlayerColour {
  White = 'white',
  Black = 'black',
}
export type BoardId = number

export const enum PieceKind {
  King = 'king',
  Queen = 'queen',
  Rook = 'rook',
  Bishop = 'bishop',
  Knight = 'knight',
  Pawn = 'pawn',
}
export const playerColours = [PlayerColour.White, PlayerColour.Black] as const
export const pieceKinds = [
  PieceKind.King,
  PieceKind.Queen,
  PieceKind.Rook,
  PieceKind.Bishop,
  PieceKind.Knight,
  PieceKind.Pawn,
] as const

export interface IChessPiece {
  kind: PieceKind
  colour: PlayerColour
}
export const playerColourSchema = z.enum(playerColours)
export const pieceKindSchema = z.enum(pieceKinds)
export const boardIdSchema = z.number().int().min(0).max(63)
export const chessPieceSchema = z.object({
  kind: pieceKindSchema,
  colour: playerColourSchema,
})
