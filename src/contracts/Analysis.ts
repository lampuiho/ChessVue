import { z } from 'zod';

import { assignedEngineSchema, type IAssignedEngine } from './Engine';
import { moveSchema, type IMove } from './Move';
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
export interface IGameAnalysis {
  seats: IAnalysisSeat[];
}
export type ReadonlyAnalysisSeat = DeepReadonly<IAnalysisSeat>;
export interface IVisibleAnalysis {
  readonly engineSeats: readonly ReadonlyAnalysisSeat[];
}
export const analysisLineSchema = z.object({
  depth: z.number().int().min(0),
  scoreCp: z.number().int().optional(),
  scoreMate: z.number().int().optional(),
  pv: z.array(moveSchema),
});

export const analysisSeatSchema = z.object({
  assignedEngine: assignedEngineSchema,
  updatedAt: utcTimestampSchema((value) => new AnalysisTimestamp(value)),
  bestMove: moveSchema.optional(),
  lines: z.array(analysisLineSchema).max(3),
  isComplete: z.boolean(),
});

export const gameAnalysisSchema = z.object({
  seats: z.array(analysisSeatSchema),
});

export const visibleAnalysisSchema = z.object({
  engineSeats: z.array(analysisSeatSchema),
});
