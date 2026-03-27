import { z } from 'zod'
export const enum SettingsCategory {
  Session = 'session',
  Gameplay = 'gameplay',
  Appearance = 'appearance',
  Engines = 'engines',
}
export const settingsCategories = [
  SettingsCategory.Session,
  SettingsCategory.Gameplay,
  SettingsCategory.Appearance,
  SettingsCategory.Engines
] as const
export interface IUiLayoutState {
  schemaVersion: number
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  historyCollapsed: boolean
  analysisCollapsed: boolean
  analysisEngineExpandedByIndex: boolean[]
}
export interface IGameSessionSnapshot {
  schemaVersion: number
  openGameIds: string[]
  activeGameId: string | null
  activeRoute:
    | '/home'
    | `/game/${string}`
    | '/saved-games/load'
    | `/saved-games/load/${string}`
    | `/saved-games/save/${string}`
    | `/settings/${SettingsCategory}`
}
export const settingsCategorySchema = z.enum(settingsCategories)
export const activeRouteSchema = z.string().regex(/^\/home$|^\/game\/.+$|^\/saved-games\/load$|^\/saved-games\/load\/.+$|^\/saved-games\/save\/.+$|^\/settings\/(session|gameplay|appearance|engines)$/)

export const uiLayoutStateSchema = z.object({
  schemaVersion: z.literal(1),
  showHistoryPanel: z.boolean(),
  showAnalysisPanel: z.boolean(),
  historyCollapsed: z.boolean(),
  analysisCollapsed: z.boolean(),
  analysisEngineExpandedByIndex: z.array(z.boolean()),
})
export const gameSessionSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  openGameIds: z.array(z.string().min(1)),
  activeGameId: z.string().min(1).nullable(),
  activeRoute: activeRouteSchema,
})