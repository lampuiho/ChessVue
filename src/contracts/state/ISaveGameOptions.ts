import { z } from 'zod';

export const enum SaveGameTargetKind {
  Autosave = 'autosave',
  ManagedSave = 'managedSave',
  ExternalFile = 'externalFile',
}
export const saveGameTargetKinds = [
  SaveGameTargetKind.Autosave,
  SaveGameTargetKind.ManagedSave,
  SaveGameTargetKind.ExternalFile,
] as const;

export interface ISaveGameOptions {
  targetKind: SaveGameTargetKind;
  saveName?: string;
  filePath?: string;
  overwrite?: boolean;
}
export const saveGameTargetKindSchema = z.enum(saveGameTargetKinds);
export const saveGameOptionsSchema = z.object({
  targetKind: saveGameTargetKindSchema,
  saveName: z.string().min(1).optional(),
  filePath: z.string().min(1).optional(),
  overwrite: z.boolean().optional(),
}).superRefine((options, context) => {
  if (options.targetKind === SaveGameTargetKind.Autosave && !!options.saveName) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Autosave options must not include a save name.' });
  if (options.targetKind === SaveGameTargetKind.Autosave && !!options.filePath) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Autosave options must not include a file path.' });
  if (options.targetKind === SaveGameTargetKind.ManagedSave && !options.saveName) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Managed-save options must include a save name.' });
  if (options.targetKind === SaveGameTargetKind.ManagedSave && !!options.filePath) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Managed-save options must not include a file path.' });
  if (options.targetKind === SaveGameTargetKind.ExternalFile && !options.filePath) context.addIssue({ code: z.ZodIssueCode.custom, message: 'External-file options must include a file path.' });
});
