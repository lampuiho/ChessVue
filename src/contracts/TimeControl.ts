import { z } from 'zod'
import { playerColourSchema, type PlayerColour } from './Chess'

export const enum TimeControlPreset {
  Bullet = 'bullet',
  Blitz = 'blitz',
  Rapid = 'rapid',
  Classical = 'classical',
  Untimed = 'untimed',
}
export const timeControlPresets = [TimeControlPreset.Bullet, TimeControlPreset.Blitz, TimeControlPreset.Rapid, TimeControlPreset.Classical, TimeControlPreset.Untimed] as const

export interface ITimeControl {
  preset?: TimeControlPreset
  initialMs?: number
  incrementMs: number
}
export interface IPlayerClock {
  remainingMs?: number
  isRunning: boolean
}
export interface IClockSnapshot {
  white: IPlayerClock
  black: IPlayerClock
  activeColour?: PlayerColour
  startedAtUtc?: string
  pausedAtUtc?: string
  lastMoveAtUtc?: string
}
export const timeControlPresetSchema = z.enum(timeControlPresets)
export const timeControlSchema = z.object({
  preset: timeControlPresetSchema.nullable().optional().transform((value) => value ?? undefined),
  initialMs: z.number().int().min(0).nullable().optional().transform((value) => value ?? undefined),
  incrementMs: z.number().int().min(0),
})

export const playerClockSchema = z.object({
  remainingMs: z.number().int().min(0).nullable().optional().transform((value) => value ?? undefined),
  isRunning: z.boolean(),
})

export const clockSnapshotSchema = z.object({
  white: playerClockSchema,
  black: playerClockSchema,
  activeColour: playerColourSchema.nullable().optional().transform((value) => value ?? undefined),
  startedAtUtc: z.string().datetime({ offset: true }).nullable().optional().transform((value) => value ?? undefined),
  pausedAtUtc: z.string().datetime({ offset: true }).nullable().optional().transform((value) => value ?? undefined),
  lastMoveAtUtc: z.string().datetime({ offset: true }).nullable().optional().transform((value) => value ?? undefined),
})
