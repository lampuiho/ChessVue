import { z } from 'zod';

export const enum PauseReason {
  Manual = 'manual',
  Menu = 'menu',
  Analysis = 'analysis',
}
export const pauseReasons = [PauseReason.Manual, PauseReason.Menu, PauseReason.Analysis] as const;
export const pauseReasonSchema = z.enum(pauseReasons);
