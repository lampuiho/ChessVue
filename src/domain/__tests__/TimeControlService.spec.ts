import { describe, expect, it } from 'vitest'

import { PlayerColour, TimeControlPreset, TimeControlService } from '../index'

describe('TimeControlService', () => {
  it('initialises untimed snapshots with null clocks', () => {
    const snapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Untimed,
      initialMs: null,
      incrementMs: 0,
    })

    expect(snapshot.white.remainingMs).toBeNull()
    expect(snapshot.black.remainingMs).toBeNull()
    expect(snapshot.activeColour).toBeNull()
  })

  it('tracks running time from UTC timestamps', () => {
    const initialSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Blitz,
      initialMs: 300000,
      incrementMs: 0,
    })
    const runningSnapshot = TimeControlService.startClock(initialSnapshot, PlayerColour.White, '2026-01-01T12:00:00.000Z')

    const remaining = TimeControlService.getRemainingTime(runningSnapshot, '2026-01-01T12:00:05.000Z')

    expect(remaining.white).toBe(295000)
    expect(remaining.black).toBe(300000)
  })

  it('pauses and resumes without drift', () => {
    const initialSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 0,
    })
    const started = TimeControlService.startClock(initialSnapshot, PlayerColour.White, '2026-01-01T12:00:00.000Z')
    const paused = TimeControlService.pauseClock(started, '2026-01-01T12:00:10.000Z')
    const resumed = TimeControlService.resumeClock(paused, '2026-01-01T12:05:00.000Z')
    const remaining = TimeControlService.getRemainingTime(resumed, '2026-01-01T12:05:10.000Z')

    expect(paused.white.remainingMs).toBe(590000)
    expect(remaining.white).toBe(580000)
  })

  it('applies increment after a move and hands the clock over', () => {
    const initialSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 2000,
    })
    const started = TimeControlService.startClock(initialSnapshot, PlayerColour.White, '2026-01-01T12:00:00.000Z')
    const moved = TimeControlService.applyMove(started, PlayerColour.White, '2026-01-01T12:00:05.000Z', {
      preset: TimeControlPreset.Rapid,
      initialMs: 600000,
      incrementMs: 2000,
    })

    expect(moved.white.remainingMs).toBe(597000)
    expect(moved.activeColour).toBe(PlayerColour.Black)
    expect(moved.black.isRunning).toBe(true)
  })

  it('detects timeout after clamping negative time to zero', () => {
    const initialSnapshot = TimeControlService.initialiseClockSnapshot({
      preset: TimeControlPreset.Bullet,
      initialMs: 1000,
      incrementMs: 0,
    })
    const started = TimeControlService.startClock(initialSnapshot, PlayerColour.White, '2026-01-01T12:00:00.000Z')

    expect(TimeControlService.hasExpired(started, '2026-01-01T12:00:02.000Z')).toBe(true)
    expect(TimeControlService.getRemainingTime(started, '2026-01-01T12:00:02.000Z').white).toBe(0)
  })
})

