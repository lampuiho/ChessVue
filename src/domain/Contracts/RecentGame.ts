import { z } from 'zod'

export type RecentGameSourceKind = 'autosave' | 'manualFile'

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

export const recentGameSourceKindSchema = z.enum(['autosave', 'manualFile'])
export const recentGameEntrySchema = z.object({
  gameId: z.string().min(1),
  displayName: z.string().min(1),
  sourceKind: recentGameSourceKindSchema,
  filePath: z.string().nullable(),
  lastSavedAtUtc: z.string().datetime({ offset: true }),
}).superRefine((entry, context) => {
  if (entry.sourceKind === 'autosave' && entry.filePath !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Autosave recent game entries must not include a file path.',
    })
  }

  if (entry.sourceKind === 'manualFile' && entry.filePath === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Manual file recent game entries must include a file path.',
    })
  }
})

export const recentGamesSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(recentGameEntrySchema),
})
