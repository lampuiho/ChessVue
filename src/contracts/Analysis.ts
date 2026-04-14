import { z } from 'zod'

import { assignedEngineSchema, type IAssignedEngine } from './Engine'
import { moveSchema, type IMove } from './Move'

export interface IAnalysisLine {
  depth: number
  scoreCp?: number
  scoreMate?: number
  pv: IMove[]
}
export interface IAnalysisSnapshot {
  assignedEngine: IAssignedEngine
  positionKey: string
  updatedAt: string
  bestMove?: IMove
  lines: IAnalysisLine[]
  isComplete: boolean
}
export interface IGameAnalysis {
  snapshots: IAnalysisSnapshot[]
}
export interface IVisibleAnalysisSnapshot {
  engineSnapshots: IAnalysisSnapshot[]
}
export const analysisLineSchema = z.object({
  depth: z.number().int().min(0),
  scoreCp: z.number().int().nullable().optional().transform((value) => value ?? undefined),
  scoreMate: z.number().int().nullable().optional().transform((value) => value ?? undefined),
  pv: z.array(moveSchema),
})

export const analysisSnapshotSchema = z.object({
  assignedEngine: assignedEngineSchema,
  positionKey: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
  bestMove: moveSchema.nullable().optional().transform((value) => value ?? undefined),
  lines: z.array(analysisLineSchema),
  isComplete: z.boolean(),
})

export const gameAnalysisSchema = z.object({
  snapshots: z.array(analysisSnapshotSchema),
})

export const visibleAnalysisSnapshotSchema = z.object({
  engineSnapshots: z.array(analysisSnapshotSchema),
})
