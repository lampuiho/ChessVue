import { z } from 'zod'

export const enum RecentGameSourceKind {
  Autosave = 'autosave',
  ManualFile = 'manualFile',
}
export const recentGameSourceKinds = [RecentGameSourceKind.Autosave, RecentGameSourceKind.ManualFile] as const

export interface IRecentGameEntry {
  gameId: string
  displayName: string
  sourceKind: RecentGameSourceKind
  filePath: string | null
  lastSavedAtUtc: string
}

export interface IRecentGamesSnapshot {
  schemaVersion: number
  entries: IRecentGameEntry[]
}

export const recentGameSourceKindSchema = z.enum(recentGameSourceKinds)
export const recentGameEntrySchema = z.object({
  gameId: z.string().min(1),
  displayName: z.string().min(1),
  sourceKind: recentGameSourceKindSchema,
  filePath: z.string().nullable(),
  lastSavedAtUtc: z.string().datetime({ offset: true }),
}).superRefine((entry, context) => {
  if (entry.sourceKind === RecentGameSourceKind.Autosave && entry.filePath !== null) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Autosave recent game entries must not include a file path.' })
  if (entry.sourceKind === RecentGameSourceKind.ManualFile && entry.filePath === null) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Manual file recent game entries must include a file path.' })
})

export const recentGamesSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(recentGameEntrySchema),
})
