import { z } from 'zod'

import { chessPieceSchema, playerColourSchema, type BoardId, type IChessPiece, type PlayerColour } from './Chess'

export interface ICastlingAvailability {
  whiteKingSide: boolean
  whiteQueenSide: boolean
  blackKingSide: boolean
  blackQueenSide: boolean
}
export interface IBoardPosition {
  board: (IChessPiece | undefined)[]
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  enPassantTarget: BoardId | null
  halfMoveClock: number
  fullMoveNumber: number
}
export const castlingAvailabilitySchema = z.object({
  whiteKingSide: z.boolean(),
  whiteQueenSide: z.boolean(),
  blackKingSide: z.boolean(),
  blackQueenSide: z.boolean(),
})
const boardSchema = z.preprocess(
  (input) => Array.isArray(input) ? input.map((entry) => entry ?? undefined) : input,
  z.array(chessPieceSchema.optional()).length(64),
)

export const boardPositionSchema: z.ZodType<IBoardPosition> = z.object({
  board: boardSchema,
  sideToMove: playerColourSchema,
  castlingAvailability: castlingAvailabilitySchema,
  enPassantTarget: z.number().int().min(0).max(63).nullable(),
  halfMoveClock: z.number().int().min(0),
  fullMoveNumber: z.number().int().min(1),
})
