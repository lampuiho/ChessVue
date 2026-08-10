import { z } from 'zod'

import { assignedEngineSchema, type IAssignedEngine } from './Engine'
import { moveSchema, type IMove } from './Move'

export interface IAnalysisLineRuntime {
  reference: number;
}
export interface IAnalysisLine {
  depth: number
  scoreCp?: number
  scoreMate?: number
  pv: IMove[]
  $?: IAnalysisLineRuntime;
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
  scoreCp: z.number().int().optional(),
  scoreMate: z.number().int().optional(),
  pv: z.array(moveSchema),
})

export const analysisSnapshotSchema = z.object({
  assignedEngine: assignedEngineSchema,
  positionKey: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
  bestMove: moveSchema.optional(),
  lines: z.array(analysisLineSchema),
  isComplete: z.boolean(),
})

export const gameAnalysisSchema = z.object({
  snapshots: z.array(analysisSnapshotSchema),
})

export const visibleAnalysisSnapshotSchema = z.object({
  engineSnapshots: z.array(analysisSnapshotSchema),
})
