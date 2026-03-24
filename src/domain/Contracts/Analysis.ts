import { z } from 'zod'

import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { moveSchema, type IMove } from './Move'

export interface IAnalysisLine {
  depth: number
  scoreCp: number | null
  scoreMate: number | null
  pv: IMove[]
}

export interface IAnalysisSnapshot {
  gameId: string
  engineId: string
  positionFen: string
  updatedAt: string
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isComplete: boolean
}

export interface IVisibleAnalysisSnapshot {
  positionFen: string
  engineSnapshots: IAnalysisSnapshot[]
}

export interface IEngineAnalysisUpdate {
  position: IBoardPosition
  bestMove: IMove | null
  lines: IAnalysisLine[]
  isFinal: boolean
}

export const analysisLineSchema = z.object({
  depth: z.number().int().min(0),
  scoreCp: z.number().int().nullable(),
  scoreMate: z.number().int().nullable(),
  pv: z.array(moveSchema),
})

export const analysisSnapshotSchema = z.object({
  gameId: z.string().min(1),
  engineId: z.string().min(1),
  positionFen: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
  bestMove: moveSchema.nullable(),
  lines: z.array(analysisLineSchema),
  isComplete: z.boolean(),
})

export const visibleAnalysisSnapshotSchema = z.object({
  positionFen: z.string().min(1),
  engineSnapshots: z.array(analysisSnapshotSchema),
})

export const engineAnalysisUpdateSchema = z.object({
  position: boardPositionSchema,
  bestMove: moveSchema.nullable(),
  lines: z.array(analysisLineSchema),
  isFinal: z.boolean(),
})
