import { z } from 'zod'

import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { clockSnapshotSchema, type IClockSnapshot } from './TimeControl'
import { pieceKindSchema, playerColourSchema, squareIdSchema, type PieceKind, type PlayerColour, type SquareId } from './Chess'

export const moveKinds = ['normal', 'castle', 'enPassant', 'promotion'] as const
export const moveBranchKinds = ['mainline', 'variation', 'analysis'] as const

export const enum MoveKind {
  Normal = 'normal',
  Castle = 'castle',
  EnPassant = 'enPassant',
  Promotion = 'promotion',
}

export const enum MoveBranchKind {
  Mainline = 'mainline',
  Variation = 'variation',
  Analysis = 'analysis',
}

export interface IMove {
  from: SquareId
  to: SquareId
  kind: MoveKind
  movingColour: PlayerColour
  promotionPiece: PieceKind | null
  san: string
  uci: string
}

export interface IMoveNode {
  id: string
  parentId: string | null
  childIds: string[]
  branchKind: MoveBranchKind
  move: IMove | null
  position: IBoardPosition
  clockSnapshot: IClockSnapshot | null
  plyIndex: number
  mainlineChildId: string | null
}

export interface IMoveTree {
  rootId: string
  nodeById: Record<string, IMoveNode>
}

export const moveKindSchema = z.enum(moveKinds)
export const moveBranchKindSchema = z.enum(moveBranchKinds)

export const moveSchema = z.object({
  from: squareIdSchema,
  to: squareIdSchema,
  kind: moveKindSchema,
  movingColour: playerColourSchema,
  promotionPiece: pieceKindSchema.nullable(),
  san: z.string().min(1),
  uci: z.string().min(4),
})

export const moveNodeSchema: z.ZodType<IMoveNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().nullable(),
    childIds: z.array(z.string().uuid()),
    branchKind: moveBranchKindSchema,
    move: moveSchema.nullable(),
    position: boardPositionSchema,
    clockSnapshot: clockSnapshotSchema.nullable(),
    plyIndex: z.number().int().min(0),
    mainlineChildId: z.string().uuid().nullable(),
  }),
)

export const moveTreeSchema = z.object({
  rootId: z.string().uuid(),
  nodeById: z.record(z.string().uuid(), moveNodeSchema),
})
