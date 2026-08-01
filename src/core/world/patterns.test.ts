import { describe, it, expect } from 'vitest'
import { computeDailyPattern, toSituationPatterns, toDateKey, type HourBucketRow } from './patterns'

const now = new Date(2026, 7, 1, 23, 30)
const today = toDateKey(now)

function rowsFor(date: string, active: Record<number, number>): HourBucketRow[] {
  return Object.entries(active).map(([h, m]) => ({
    date,
    hour_bucket: Number(h),
    active_minutes: m
  }))
}

describe('computeDailyPattern', () => {
  it('empty history yields zero baseline and normal deviation', () => {
    const p = computeDailyPattern([], now)
    expect(p.baselineMinutes.every(v => v === 0)).toBe(true)
    expect(p.activeTodayMin).toBe(0)
    expect(p.typicalActiveMin).toBe(0)
    expect(p.deviation).toBe('normal')
    expect(p.sleepLateHours).toBe(0)
  })

  it('computes per-hour baseline mean across history days', () => {
    const rows = [
      ...rowsFor('2026-07-30', { 9: 30, 22: 10 }),
      ...rowsFor('2026-07-31', { 9: 50, 22: 10 })
    ]
    const p = computeDailyPattern(rows, now)
    expect(p.baselineMinutes[9]).toBe(40)
    expect(p.baselineMinutes[22]).toBe(10)
  })

  it('today is excluded from baseline', () => {
    const rows = [
      ...rowsFor(today, { 9: 120 }),
      ...rowsFor('2026-07-31', { 9: 30 })
    ]
    const p = computeDailyPattern(rows, now)
    expect(p.baselineMinutes[9]).toBe(30)
    expect(p.todayMinutes[9]).toBe(120)
    expect(p.activeTodayMin).toBe(120)
  })

  it('detects late-night anomaly vs baseline (22-2 window)', () => {
    const rows = [
      ...rowsFor('2026-07-30', { 22: 10, 23: 10, 0: 10, 1: 10 }),
      ...rowsFor('2026-07-31', { 22: 10, 23: 10, 0: 10, 1: 10 }),
      ...rowsFor(today, { 22: 40, 23: 40 })
    ]
    const p = computeDailyPattern(rows, now)
    // excess = (40+40) - (10+10) = 60min >= 30 → late
    expect(p.sleepLateHours).toBe(1)
    expect(p.deviation).toBe('late_night')
  })

  it('does not flag late night when now is daytime', () => {
    const dayNow = new Date(2026, 7, 1, 14, 0)
    const rows = [
      ...rowsFor('2026-07-31', { 22: 10, 23: 10 }),
      ...rowsFor(today, { 22: 60, 23: 60 })
    ]
    const p = computeDailyPattern(rows, dayNow)
    expect(p.sleepLateHours).toBe(0)
  })

  it('flags busy when today exceeds typical by 1.5x', () => {
    const rows = [
      ...rowsFor('2026-07-30', { 9: 30, 14: 30 }), // 60 min/day
      ...rowsFor('2026-07-31', { 9: 30, 14: 30 }), // 60 min/day
      ...rowsFor(today, { 9: 120, 14: 60 })         // 180 min
    ]
    const p = computeDailyPattern(rows, now)
    expect(p.typicalActiveMin).toBe(60)
    expect(p.deviation).toBe('busy')
  })

  it('flags quiet when today is far below typical', () => {
    const rows = [
      ...rowsFor('2026-07-30', { 9: 100, 14: 100 }),
      ...rowsFor('2026-07-31', { 9: 100, 14: 100 }),
      ...rowsFor(today, { 9: 20 })
    ]
    const p = computeDailyPattern(rows, now)
    expect(p.deviation).toBe('quiet')
  })

  it('ignores invalid hour buckets', () => {
    const rows = [{ date: '2026-07-31', hour_bucket: 99, active_minutes: 50 }]
    const p = computeDailyPattern(rows, now)
    expect(p.baselineMinutes[99]).toBeUndefined()
    expect(p.typicalActiveMin).toBe(0)
  })
})

describe('toSituationPatterns', () => {
  it('maps sleepLate from hours, unusualSchedule from busy/quiet', () => {
    const late = computeDailyPattern([
      ...rowsFor('2026-07-30', { 22: 10, 23: 10 }),
      ...rowsFor('2026-07-31', { 22: 10, 23: 10 }),
      ...rowsFor(today, { 22: 60, 23: 60 })
    ], now)
    const p = toSituationPatterns(late)
    expect(p.sleepLate).toBe(true)
    expect(p.unusualSchedule).toBe(false)
  })

  it('computes busyDeviation ratio when busy', () => {
    const busy = computeDailyPattern([
      ...rowsFor('2026-07-30', { 9: 30, 14: 30 }),
      ...rowsFor('2026-07-31', { 9: 30, 14: 30 }),
      ...rowsFor(today, { 9: 120, 14: 60 })
    ], now)
    const p = toSituationPatterns(busy)
    expect(p.busyDeviation).toBe(3)
    expect(p.unusualSchedule).toBe(true)
    expect(p.quietDeviation).toBe(0)
  })

  it('computes quietDeviation ratio when quiet', () => {
    const quiet = computeDailyPattern([
      ...rowsFor('2026-07-30', { 9: 100, 14: 100 }),
      ...rowsFor('2026-07-31', { 9: 100, 14: 100 }),
      ...rowsFor(today, { 9: 20 })
    ], now)
    const p = toSituationPatterns(quiet)
    expect(p.quietDeviation).toBe(10)
    expect(p.unusualSchedule).toBe(true)
  })
})
