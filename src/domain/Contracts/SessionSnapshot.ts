import { z } from 'zod'

export type SettingsCategory = 'session' | 'gameplay' | 'appearance' | 'engines'

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
  activeRoute: '/home' | `/game/${string}` | `/settings/${SettingsCategory}`
}

export const settingsCategorySchema = z.enum(['session', 'gameplay', 'appearance', 'engines'])
export const activeRouteSchema = z.string().regex(/^\/home$|^\/game\/.+$|^\/settings\/(session|gameplay|appearance|engines)$/)

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
