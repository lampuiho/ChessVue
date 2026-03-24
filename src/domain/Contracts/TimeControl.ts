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
  preset: TimeControlPreset | null
  initialMs: number | null
  incrementMs: number
}

export interface IPlayerClock {
  remainingMs: number | null
  isRunning: boolean
}

export interface IClockSnapshot {
  white: IPlayerClock
  black: IPlayerClock
  activeColour: PlayerColour | null
  startedAtUtc: string | null
  pausedAtUtc: string | null
  lastMoveAtUtc: string | null
}

export const timeControlPresetSchema = z.enum(timeControlPresets)
export const timeControlSchema = z.object({
  preset: timeControlPresetSchema.nullable(),
  initialMs: z.number().int().min(0).nullable(),
  incrementMs: z.number().int().min(0),
})

export const playerClockSchema = z.object({
  remainingMs: z.number().int().min(0).nullable(),
  isRunning: z.boolean(),
})

export const clockSnapshotSchema = z.object({
  white: playerClockSchema,
  black: playerClockSchema,
  activeColour: playerColourSchema.nullable(),
  startedAtUtc: z.string().datetime({ offset: true }).nullable(),
  pausedAtUtc: z.string().datetime({ offset: true }).nullable(),
  lastMoveAtUtc: z.string().datetime({ offset: true }).nullable(),
})
