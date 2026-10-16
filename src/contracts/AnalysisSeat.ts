import { z } from 'zod';
import { assignedEngineSchema, type IAssignedEngine } from './Engine';
import type { IMove } from './Move';
import { AnalysisTimestamp } from '@/utility/date';
import { utcTimestampSchema } from './UtcTimestampSchema';
import type { DeepReadonly } from './Readonly';
export interface IAnalysisLineRuntime {
  reference: number;
}
export interface IAnalysisLine {
  depth: number;
  scoreCp?: number;
  scoreMate?: number;
  pv: readonly IMove[];
  $?: IAnalysisLineRuntime;
}
export interface IAnalysisSeat {
  assignedEngine: IAssignedEngine;
  updatedAt: AnalysisTimestamp;
  bestMove?: IMove;
  /** Up to three rendered lines for the game's current rendered position. */
  lines: readonly IAnalysisLine[];
  isComplete: boolean;
}
export interface IRecordedAnalysis {
  recordedAt: AnalysisTimestamp;
  /** Engine output for the position before this actual move was played. */
  seats: IAnalysisSeat[];
}
export type ReadonlyAnalysisSeat = DeepReadonly<IAnalysisSeat>;
export function createAnalysisLineSchema<TInput>(moveSchema: z.ZodType<IMove, z.ZodTypeDef, TInput>) {
  return z.object({
    depth: z.number().int().min(0), scoreCp: z.number().int().optional(), scoreMate: z.number().int().optional(), pv: z.array(moveSchema),
  });
}
export function createAnalysisSeatSchema<TInput>(moveSchema: z.ZodType<IMove, z.ZodTypeDef, TInput>) {
  return z.object({
    assignedEngine: assignedEngineSchema,
    updatedAt: utcTimestampSchema((value) => new AnalysisTimestamp(value)),
    bestMove: moveSchema.optional(), lines: z.array(createAnalysisLineSchema(moveSchema)).max(3), isComplete: z.boolean(),
  });
}
export function createRecordedAnalysisSchema<TInput>(moveSchema: z.ZodType<IMove, z.ZodTypeDef, TInput>) {
  return z.object({
    recordedAt: utcTimestampSchema((value) => new AnalysisTimestamp(value)), seats: z.array(createAnalysisSeatSchema(moveSchema)).min(1).max(4),
  });
}
