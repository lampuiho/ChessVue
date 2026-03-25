import { z } from 'zod'

import { chessPieceSchema, playerColourSchema, type BoardId, type IChessPiece, type PlayerColour } from './Chess'

export interface ICastlingAvailability {
  whiteKingSide: boolean
  whiteQueenSide: boolean
  blackKingSide: boolean
  blackQueenSide: boolean
}
export interface IBoardPosition {
  piecesByBoardId: Partial<Record<BoardId, IChessPiece>>
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  enPassantTargetId: BoardId | null
  halfMoveClock: number
  fullMoveNumber: number
}
export const castlingAvailabilitySchema = z.object({
  whiteKingSide: z.boolean(),
  whiteQueenSide: z.boolean(),
  blackKingSide: z.boolean(),
  blackQueenSide: z.boolean(),
})

export const boardPositionSchema: z.ZodType<IBoardPosition> = z.object({
  piecesByBoardId: z.record(z.string().regex(/^(?:[0-9]|[1-5][0-9]|6[0-3])$/), chessPieceSchema) as z.ZodType<Partial<Record<BoardId, IChessPiece>>>,
  sideToMove: playerColourSchema,
  castlingAvailability: castlingAvailabilitySchema,
  enPassantTargetId: z.number().int().min(0).max(63).nullable(),
  halfMoveClock: z.number().int().min(0),
  fullMoveNumber: z.number().int().min(1),
})
