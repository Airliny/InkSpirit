import { describe, it, expect } from 'vitest'
import {
  synthesizeSituation,
  computeFatigue,
  getHourContext,
  situationPromptLine,
  AWAY_THRESHOLD_MS,
  FATIGUE_THRESHOLD
} from './situation'
import type { PatternContext } from './patterns'

const base = {
  scene: 'work' as const,
  idleMs: 0,
  streakMin: 0,
  hour: 14
}

const latePattern: PatternContext = {
  baselineMinutes: new Array(24).fill(10),
  todayMinutes: new Array(24).fill(0),
  activeTodayMin: 0,
  typicalActiveMin: 240,
  sleepLateHours: 3,
  deviation: 'late_night'
}

describe('getHourContext', () => {
  it('classifies hour boundaries', () => {
    expect(getHourContext(1)).toBe('late_night')
    expect(getHourContext(23)).toBe('late_night')
    expect(getHourContext(6)).toBe('dawn')
    expect(getHourContext(9)).toBe('early')
    expect(getHourContext(14)).toBe('day')
    expect(getHourContext(20)).toBe('evening')
  })
})

describe('computeFatigue', () => {
  it('is 0 when nothing signals fatigue', () => {
    expect(computeFatigue(base)).toBe(0)
  })

  it('late night activity alone gives 0.6', () => {
    expect(computeFatigue({ ...base, hour: 1, streakMin: 30 })).toBe(0.6)
  })

  it('daytime 2h+ streak gives 0.4, 4h+ gives 0.8', () => {
    expect(computeFatigue({ ...base, streakMin: 130 })).toBe(0.4)
    expect(computeFatigue({ ...base, streakMin: 250 })).toBe(0.8)
  })

  it('sleep-late pattern (>=2h) adds 0.3 floor', () => {
    // Daytime short streak: only the pattern signal applies
    expect(computeFatigue({ ...base, streakMin: 30, patternContext: latePattern })).toBe(0.3)
  })

  it('never exceeds 1', () => {
    expect(computeFatigue({ ...base, hour: 23, streakMin: 600 })).toBeLessThanOrEqual(1)
  })
})

describe('synthesizeSituation — snapshot shape', () => {
  it('carries version, timestamp and compact patterns', () => {
    const s = synthesizeSituation({ ...base, patternContext: latePattern })
    expect(s.version).toBe(1)
    expect(s.timestamp).toBeGreaterThan(0)
    expect(s.patterns).toEqual({
      sleepLate: true,
      unusualSchedule: false,
      busyDeviation: 0,
      quietDeviation: 0
    })
  })

  it('patterns is null without history', () => {
    const s = synthesizeSituation(base)
    expect(s.patterns).toBeNull()
  })
})

describe('synthesizeSituation — userState priority', () => {
  it('meeting beats everything, even idle', () => {
    const s = synthesizeSituation({ ...base, scene: 'meeting', idleMs: AWAY_THRESHOLD_MS + 1, streakMin: 500 })
    expect(s.userState).toBe('meeting')
    expect(s.inferredNeed).toContain('会议')
  })

  it('game is playing', () => {
    expect(synthesizeSituation({ ...base, scene: 'game' }).userState).toBe('playing')
  })

  it('idle beyond threshold is away', () => {
    const s = synthesizeSituation({ ...base, idleMs: AWAY_THRESHOLD_MS + 1000 })
    expect(s.userState).toBe('away')
    expect(s.inferredNeed).toContain('离开')
  })

  it('fatigued wins over deep work at night', () => {
    const s = synthesizeSituation({ ...base, hour: 1, streakMin: 30 })
    expect(s.fatigue).toBeGreaterThanOrEqual(FATIGUE_THRESHOLD)
    expect(s.userState).toBe('fatigued')
    expect(s.inferredNeed).toContain('疲劳')
  })

  it('video after long work is recovering', () => {
    const s = synthesizeSituation({ ...base, scene: 'video', streakMin: 150 })
    expect(s.userState).toBe('recovering')
    expect(s.inferredNeed).toContain('放松')
  })

  it('video after short activity is playing', () => {
    expect(synthesizeSituation({ ...base, scene: 'video', streakMin: 20 }).userState).toBe('playing')
  })

  it('code with 60min streak is deep_work', () => {
    const s = synthesizeSituation({ ...base, scene: 'code', streakMin: 60 })
    expect(s.userState).toBe('deep_work')
    expect(s.inferredNeed).toContain('专注')
  })

  it('short work streak is active_light with no inferred need', () => {
    const s = synthesizeSituation({ ...base, streakMin: 10 })
    expect(s.userState).toBe('active_light')
    expect(s.inferredNeed).toBeNull()
  })
})

describe('synthesizeSituation — focusDepth', () => {
  it('scales with streak and clamps at 1', () => {
    const s = synthesizeSituation({ ...base, scene: 'code', streakMin: 600 })
    expect(s.focusDepth).toBeGreaterThanOrEqual(0)
    expect(s.focusDepth).toBeLessThanOrEqual(1)
  })

  it('code/work scenes focus deeper than others', () => {
    const code = synthesizeSituation({ ...base, scene: 'code', streakMin: 60 })
    const other = synthesizeSituation({ ...base, scene: 'other', streakMin: 60 })
    expect(code.focusDepth).toBeGreaterThan(other.focusDepth)
  })
})

describe('situationPromptLine', () => {
  function snapshot(overrides: Partial<ReturnType<typeof synthesizeSituation>> = {}): ReturnType<typeof synthesizeSituation> {
    return {
      ...synthesizeSituation(base),
      ...overrides
    }
  }

  it('null when no inferred need', () => {
    expect(situationPromptLine(snapshot({ inferredNeed: null }))).toBeNull()
  })

  it('mentions late hour, streak hours and fatigue at night', () => {
    const s = snapshot({
      timestamp: new Date(2026, 6, 31, 1, 30).getTime(),
      streakMin: 180,
      fatigue: 0.6,
      inferredNeed: '主人可能比较疲劳，适合温柔的休息提醒'
    })
    const line = situationPromptLine(s)
    expect(line).toContain('凌晨1点')
    expect(line).toContain('约3小时')
    expect(line).toContain('看起来比较累')
  })

  it('mentions minutes for shorter streaks', () => {
    const s = snapshot({
      timestamp: new Date(2026, 6, 31, 14, 0).getTime(),
      streakMin: 50,
      fatigue: 0.3,
      inferredNeed: '主人深度专注中，避免打扰'
    })
    expect(situationPromptLine(s)).toContain('下午2点')
    expect(situationPromptLine(s)).toContain('50分钟')
  })
})
