import { z } from 'zod';

import { moveSchema } from './Move';
import { createAnalysisLineSchema, createAnalysisSeatSchema, type IAnalysisSeat, type ReadonlyAnalysisSeat } from './AnalysisSeat';
export * from './AnalysisSeat';
export interface IGameAnalysis {
  seats: IAnalysisSeat[];
}
export interface IVisibleAnalysis {
  readonly engineSeats: readonly ReadonlyAnalysisSeat[];
}
export const analysisLineSchema = createAnalysisLineSchema(moveSchema);
export const analysisSeatSchema = createAnalysisSeatSchema(moveSchema);

export const gameAnalysisSchema = z.object({
  seats: z.array(analysisSeatSchema),
});

export const visibleAnalysisSchema = z.object({
  engineSeats: z.array(analysisSeatSchema),
});
