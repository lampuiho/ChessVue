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
const boardEntrySchema: z.ZodType<IChessPiece | undefined, z.ZodTypeDef, IChessPiece | null | undefined> = z.union([chessPieceSchema, z.null(), z.undefined()])
  .transform((entry) => entry ?? undefined)
const boardSchema: z.ZodType<IBoardPosition['board'], z.ZodTypeDef, Array<IChessPiece | null | undefined>> = z.array(boardEntrySchema).length(64)

export const boardPositionSchema: z.ZodType<IBoardPosition, z.ZodTypeDef, Omit<IBoardPosition, 'board'> & { board: Array<IChessPiece | null | undefined> }> = z.object({
  board: boardSchema,
  sideToMove: playerColourSchema,
  castlingAvailability: castlingAvailabilitySchema,
  enPassantTarget: z.number().int().min(0).max(63).nullable(),
  halfMoveClock: z.number().int().min(0),
  fullMoveNumber: z.number().int().min(1),
})
