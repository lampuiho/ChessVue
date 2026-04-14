import { z } from 'zod'

export const enum RecentGameSourceKind {
  Autosave = 'autosave',
  SaveFile = 'saveFile',
}
export const recentGameSourceKinds = [RecentGameSourceKind.Autosave, RecentGameSourceKind.SaveFile] as const

export interface IRecentGameEntry {
  gameId: string
  displayName: string
  sourceKind: RecentGameSourceKind
  filePath?: string
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
  filePath: z.string().nullable().optional().transform((value) => value ?? undefined),
  lastSavedAtUtc: z.string().datetime({ offset: true }),
}).superRefine((entry, context) => {
  if (entry.sourceKind === RecentGameSourceKind.Autosave && !!entry.filePath) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Autosave recent game entries must not include a file path.' })
  if (entry.sourceKind === RecentGameSourceKind.SaveFile && !entry.filePath) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Save-file recent game entries must include a file path.' })
})

export const recentGamesSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(recentGameEntrySchema),
})
