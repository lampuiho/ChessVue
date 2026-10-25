import { z } from 'zod'
import { themeModeSchema, type ThemeMode } from './Appearance'
import { engineRecordSchema, type IEngineRecord } from './Engine'
import { createGameRequestSchema, type ICreateGameRequest } from './Game';
import { getGameCreationError } from '@/utility/GameCreationUtility';

export const enum AnalysisBranchExitBehaviour {
  ReturnToLiveNode = 'returnToLiveNode',
  StayOnBranch = 'stayOnBranch',
}
export const enum PromotionPolicy {
  RequireExplicitSelection = 'requireExplicitSelection',
}
export const enum BoardOrientation {
  White = 'white',
  Black = 'black',
}
export const analysisBranchExitBehaviours = [AnalysisBranchExitBehaviour.ReturnToLiveNode, AnalysisBranchExitBehaviour.StayOnBranch] as const
export const promotionPolicies = [PromotionPolicy.RequireExplicitSelection] as const
export const boardOrientations = [BoardOrientation.White, BoardOrientation.Black] as const

export interface ISettingsGameSession {
  restorePreviousSession: boolean
  saveRootPath: string
  autosaveAfterMoveCount: number
  autosaveOnClose: boolean
  autoPauseOnMenu: boolean
}
export interface ISettingsGameplay {
  analysisBranchExitBehaviour: AnalysisBranchExitBehaviour
  promotionPolicy: PromotionPolicy
}
export interface ISettingsAnalysis {
  resumeLiveAnalysisAfterRestore: boolean
  engineInventory: IEngineRecord[]
}
export interface ISettingsAppearance {
  themeMode: ThemeMode
  boardTheme: string
  pieceTheme: string
  uiScalePercent: number
  boardOrientation: BoardOrientation
  showCoordinates: boolean
  highlightLastMove: boolean
}
export interface ISettingsSnapshot {
  schemaVersion: number
  gameSession: ISettingsGameSession
  gameDefaults: Omit<ICreateGameRequest, 'rootPosition'>;
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
}
export const analysisBranchExitBehaviourSchema = z.enum(analysisBranchExitBehaviours)
export const promotionPolicySchema = z.enum(promotionPolicies)
export const boardOrientationSchema = z.enum(boardOrientations)
export const settingsGameSessionSchema = z.object({
  restorePreviousSession: z.boolean(),
  saveRootPath: z.string().min(1),
  autosaveAfterMoveCount: z.number().int().min(0),
  autosaveOnClose: z.boolean(),
  autoPauseOnMenu: z.boolean(),
})

export const settingsGameDefaultsSchema = createGameRequestSchema.omit({ rootPosition: true }).superRefine((request, context) => {
  const error = getGameCreationError(request);
  if (error) context.addIssue({ code: z.ZodIssueCode.custom, message: error });
});

export const settingsGameplaySchema = z.object({
  analysisBranchExitBehaviour: analysisBranchExitBehaviourSchema,
  promotionPolicy: promotionPolicySchema,
})

export const settingsAnalysisSchema = z.object({
  resumeLiveAnalysisAfterRestore: z.boolean(),
  engineInventory: z.array(engineRecordSchema).superRefine((engines, context) => {
    const names = new Set<string>()
    for (const engine of engines) {
      if (names.has(engine.displayName)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate engine display name: ${engine.displayName}` })
      names.add(engine.displayName)
    }
  }),
})

export const settingsAppearanceSchema = z.object({
  themeMode: themeModeSchema,
  boardTheme: z.string().min(1),
  pieceTheme: z.string().min(1),
  uiScalePercent: z.number().int().min(75).max(200),
  boardOrientation: boardOrientationSchema,
  showCoordinates: z.boolean(),
  highlightLastMove: z.boolean(),
})

export const settingsSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  gameSession: settingsGameSessionSchema,
  gameDefaults: settingsGameDefaultsSchema,
  gameplay: settingsGameplaySchema,
  analysis: settingsAnalysisSchema,
  appearance: settingsAppearanceSchema,
})
