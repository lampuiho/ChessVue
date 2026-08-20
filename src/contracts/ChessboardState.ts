import { z } from 'zod';

import { chessPieceSchema, playerColourSchema, type BoardId, type IChessPiece, type PlayerColour } from './Chess';

export const enum CheckState {
  Check = 'check',
  Checkmate = 'checkmate',
}
export const checkStateSchema = z.enum([CheckState.Check, CheckState.Checkmate]);
export interface ICastlingAvailability {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}
export interface ICastlingRook {
  whiteKingSide: BoardId;
  whiteQueenSide: BoardId;
  blackKingSide: BoardId;
  blackQueenSide: BoardId;
}
export interface IBoardPositionRuntime {
  checkState?: CheckState;
  isStandardInitialPosition?: boolean;
}
export interface IBoardPosition {
  board: (IChessPiece | undefined)[];
  sideToMove: PlayerColour;
  castlingAvailability: ICastlingAvailability;
  castlingRook?: ICastlingRook;
  enPassantTarget?: BoardId; // the position the pawn can move to for en passant capture, if any
  halfMoveClock: number;
  fullMoveNumber: number;
  $?: IBoardPositionRuntime;
}
export const castlingAvailabilitySchema = z.object({
  whiteKingSide: z.boolean(),
  whiteQueenSide: z.boolean(),
  blackKingSide: z.boolean(),
  blackQueenSide: z.boolean(),
});
export const castlingRookSchema = z.object({
  whiteKingSide: z.number().int().min(0).max(63),
  whiteQueenSide: z.number().int().min(0).max(63),
  blackKingSide: z.number().int().min(0).max(63),
  blackQueenSide: z.number().int().min(0).max(63),
});
const boardEntrySchema: z.ZodType<IChessPiece | undefined, z.ZodTypeDef, IChessPiece | null | undefined> = z.union([chessPieceSchema, z.null(), z.undefined()])
  .transform((entry) => entry ?? undefined);
const boardSchema: z.ZodType<IBoardPosition['board'], z.ZodTypeDef, Array<IChessPiece | null | undefined>> = z.array(boardEntrySchema).length(64);
type IBoardPositionInput = Omit<IBoardPosition, 'board' | 'castlingRook' | 'enPassantTarget' | '$'> & { board: Array<IChessPiece | null | undefined>; castlingRook?: ICastlingRook | null; enPassantTarget?: BoardId | null };

export const boardPositionSchema: z.ZodType<IBoardPosition, z.ZodTypeDef, IBoardPositionInput> = z.object({
  board: boardSchema,
  sideToMove: playerColourSchema,
  castlingAvailability: castlingAvailabilitySchema,
  castlingRook: castlingRookSchema.optional(),
  enPassantTarget: z.number().int().min(0).max(63).optional(),
  halfMoveClock: z.number().int().min(0),
  fullMoveNumber: z.number().int().min(1),
});
