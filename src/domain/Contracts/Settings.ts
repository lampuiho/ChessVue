import { z } from 'zod'

import { engineRecordSchema, type IEngineRecord } from './Engine'
import { playerTypeSchema, type PlayerType } from './Game'
import { timeControlSchema, type ITimeControl } from './TimeControl'

export const themeModes = ['system', 'light', 'dark'] as const
export const takebackPolicies = ['rewriteMainline', 'analysisOnly'] as const
export const analysisBranchExitBehaviours = ['returnToLiveNode', 'stayOnBranch'] as const
export const promotionPolicies = ['requireExplicitSelection'] as const
export const boardOrientations = ['white', 'black'] as const

export const enum ThemeMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export const enum TakebackPolicy {
  RewriteMainline = 'rewriteMainline',
  AnalysisOnly = 'analysisOnly',
}

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

export interface ISettingsSession {
  restorePreviousSession: boolean
  autosaveEnabled: boolean
  autosaveDebounceMs: number
  autoPauseOnMenu: boolean
}

export interface ISettingsGameDefaults {
  quickNewGameName: string
  defaultTimeControl: ITimeControl
  defaultWhitePlayerType: PlayerType
  defaultBlackPlayerType: PlayerType
}

export interface ISettingsGameplay {
  takebackPolicy: TakebackPolicy
  confirmMainlineRewrite: boolean
  analysisBranchExitBehaviour: AnalysisBranchExitBehaviour
  promotionPolicy: PromotionPolicy
  confirmPruneFutureMoves: boolean
  allowRootPrune: boolean
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
  session: ISettingsSession
  gameDefaults: ISettingsGameDefaults
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
}

export const themeModeSchema = z.enum(themeModes)
export const takebackPolicySchema = z.enum(takebackPolicies)
export const analysisBranchExitBehaviourSchema = z.enum(analysisBranchExitBehaviours)
export const promotionPolicySchema = z.enum(promotionPolicies)
export const boardOrientationSchema = z.enum(boardOrientations)
export const settingsSessionSchema = z.object({
  restorePreviousSession: z.boolean(),
  autosaveEnabled: z.boolean(),
  autosaveDebounceMs: z.number().int().min(250).max(5000),
  autoPauseOnMenu: z.boolean(),
})

export const settingsGameDefaultsSchema = z.object({
  quickNewGameName: z.string().min(1),
  defaultTimeControl: timeControlSchema,
  defaultWhitePlayerType: playerTypeSchema,
  defaultBlackPlayerType: playerTypeSchema,
})

export const settingsGameplaySchema = z.object({
  takebackPolicy: takebackPolicySchema,
  confirmMainlineRewrite: z.boolean(),
  analysisBranchExitBehaviour: analysisBranchExitBehaviourSchema,
  promotionPolicy: promotionPolicySchema,
  confirmPruneFutureMoves: z.boolean(),
  allowRootPrune: z.boolean(),
})

export const settingsAnalysisSchema = z.object({
  resumeLiveAnalysisAfterRestore: z.boolean(),
  engineInventory: z.array(engineRecordSchema).superRefine((engines, context) => {
    const names = new Set<string>()

    for (const engine of engines) {
      if (names.has(engine.displayName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate engine display name: ${engine.displayName}`,
        })
      }

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
  session: settingsSessionSchema,
  gameDefaults: settingsGameDefaultsSchema,
  gameplay: settingsGameplaySchema,
  analysis: settingsAnalysisSchema,
  appearance: settingsAppearanceSchema,
})
