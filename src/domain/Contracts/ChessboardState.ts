import { z } from 'zod'

import { chessPieceSchema, playerColourSchema, squareIdSchema, type IChessPiece, type PlayerColour, type SquareId } from './Chess'

export interface ICastlingAvailability {
  whiteKingSide: boolean
  whiteQueenSide: boolean
  blackKingSide: boolean
  blackQueenSide: boolean
}

export interface IBoardPosition {
  piecesBySquare: Partial<Record<SquareId, IChessPiece>>
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  enPassantTarget: SquareId | null
  halfMoveClock: number
  fullMoveNumber: number
  fen: string
}

export const castlingAvailabilitySchema = z.object({
  whiteKingSide: z.boolean(),
  whiteQueenSide: z.boolean(),
  blackKingSide: z.boolean(),
  blackQueenSide: z.boolean(),
})

export const boardPositionSchema = z.object({
  piecesBySquare: z.record(squareIdSchema, chessPieceSchema),
  sideToMove: playerColourSchema,
  castlingAvailability: castlingAvailabilitySchema,
  enPassantTarget: squareIdSchema.nullable(),
  halfMoveClock: z.number().int().min(0),
  fullMoveNumber: z.number().int().min(1),
  fen: z.string().min(1),
})
