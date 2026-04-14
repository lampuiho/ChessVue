import { z } from 'zod'
import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { clockSnapshotSchema, type IClockSnapshot } from './TimeControl'
import { boardIdSchema, pieceKindSchema, playerColourSchema, type BoardId, type PieceKind, type PlayerColour } from './Chess'

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
export const moveKinds = [MoveKind.Normal, MoveKind.Castle, MoveKind.EnPassant, MoveKind.Promotion] as const
export const moveBranchKinds = [MoveBranchKind.Mainline, MoveBranchKind.Variation, MoveBranchKind.Analysis] as const

export type MovePath = number[]

export interface IMoveMeta {
  san?: string
  uci?: string
}
export interface IMove {
  from: BoardId
  to: BoardId
  kind: MoveKind
  movingColour: PlayerColour
  promotionPiece?: PieceKind
  $?: IMoveMeta
}
export interface IPromoMove extends IMove {
  kind: MoveKind.Promotion
  promotionPiece: PieceKind
}
export interface IMoveNodeRuntime {
  parent?: IMoveNode
}
export interface IMoveNode {
  branchKind: MoveBranchKind
  move?: IMove
  position: IBoardPosition
  clockSnapshot?: IClockSnapshot
  plyIndex: number
  mainlineChildIndex?: number
  children: IMoveNode[]
  $?: IMoveNodeRuntime
}
export interface IMoveTree {
  root: IMoveNode
}
export const moveKindSchema = z.enum(moveKinds)
export const moveBranchKindSchema = z.enum(moveBranchKinds)
export const movePathSchema = z.array(z.number().int().min(0))

type IMoveSchemaInput = Omit<IMove, 'promotionPiece'> & { promotionPiece?: PieceKind | null }
export const moveSchema: z.ZodType<IMove, z.ZodTypeDef, IMoveSchemaInput> = z.object({
  from: boardIdSchema,
  to: boardIdSchema,
  kind: moveKindSchema,
  movingColour: playerColourSchema,
  promotionPiece: pieceKindSchema.nullable().optional().transform((value) => value ?? undefined),
})
type IMoveInput = IMoveSchemaInput
interface IMoveNodeInput {
  branchKind: MoveBranchKind
  move?: IMoveInput | null
  position: z.input<typeof boardPositionSchema>
  clockSnapshot?: z.input<typeof clockSnapshotSchema> | null
  plyIndex: number
  mainlineChildIndex?: number | null
  children: IMoveNodeInput[]
}
interface IMoveTreeInput {
  root: IMoveNodeInput
}
export const moveNodeSchema: z.ZodType<IMoveNode, z.ZodTypeDef, IMoveNodeInput> = z.lazy(() =>
  z.object({
    branchKind: moveBranchKindSchema,
    move: moveSchema.nullable().optional().transform((value) => value ?? undefined),
    position: boardPositionSchema,
    clockSnapshot: clockSnapshotSchema.nullable().optional().transform((value) => value ?? undefined),
    plyIndex: z.number().int().min(0),
    mainlineChildIndex: z.number().int().min(0).nullable().optional().transform((value) => value ?? undefined),
    children: z.array(moveNodeSchema),
  }),
)
export const moveTreeSchema: z.ZodType<IMoveTree, z.ZodTypeDef, IMoveTreeInput> = z.object({
  root: moveNodeSchema,
})
