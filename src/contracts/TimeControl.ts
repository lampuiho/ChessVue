import { z } from 'zod'
import { playerColourSchema, type PlayerColour } from './Chess'
import { ClockTimestamp } from '@/utility/date'
import { utcTimestampSchema } from './UtcTimestampSchema'

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
  startedAtUtc?: ClockTimestamp
  pausedAtUtc?: ClockTimestamp
  lastMoveAtUtc?: ClockTimestamp
}
export const timeControlPresetSchema = z.enum(timeControlPresets)
export const timeControlSchema = z.object({
  preset: timeControlPresetSchema.optional(),
  initialMs: z.number().int().min(0).optional(),
  incrementMs: z.number().int().min(0),
})

export const playerClockSchema = z.object({
  remainingMs: z.number().int().min(0).optional(),
  isRunning: z.boolean(),
})

export const clockSnapshotSchema = z.object({
  white: playerClockSchema,
  black: playerClockSchema,
  activeColour: playerColourSchema.optional(),
  startedAtUtc: utcTimestampSchema((value) => new ClockTimestamp(value)).optional(),
  pausedAtUtc: utcTimestampSchema((value) => new ClockTimestamp(value)).optional(),
  lastMoveAtUtc: utcTimestampSchema((value) => new ClockTimestamp(value)).optional(),
})
