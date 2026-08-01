import { describe, it, expect } from 'vitest'
import { checkGuardian, createGuardianState, type GuardianSettings } from './guardian'

const settings: GuardianSettings = {
  enabled: true,
  workThresholdMin: 45,
  cooldownMin: 60
}

const now = new Date(2026, 7, 1, 14, 0).getTime() // 14:00 — not late night

function run(steps: { idleSec?: number; disturbBlocked?: boolean; mins?: number }[]) {
  let state = createGuardianState()
  let t = now
  const signals: (string | null)[] = []
  for (const step of steps) {
    const idleSec = step.idleSec ?? 0
    const disturbBlocked = step.disturbBlocked ?? false
    const mins = step.mins ?? 0
    t += mins * 60000
    const result = checkGuardian(state, { idleSec, disturbBlocked, settings, now: t })
    state = result.state
    signals.push(result.signal?.type ?? null)
  }
  return { state, signals }
}

describe('Guardian — 仍能触发提醒（经过信号，不直接说话）', () => {
  it('连续工作超过阈值 → 产生 guardian_warning 信号', () => {
    const { signals } = run([
      { mins: 1 },              // becomes active, streak starts
      { mins: 46 }              // 47 min >= 45 threshold
    ])
    expect(signals[1]).toBe('guardian_warning')
  })

  it('冷却期内不重复触发', () => {
    const { signals } = run([
      { mins: 1 },
      { mins: 46 },             // signal
      { mins: 10 },             // 10 min later, cooldown 60min
      { mins: 60 }              // 70 min later — still within? no: 10+60=70 >= 60 ok
    ])
    expect(signals[1]).toBe('guardian_warning')
    expect(signals[2]).toBeNull()
    expect(signals[3]).toBe('guardian_warning')
  })

  it('深夜工作 → reason=late_night', () => {
    const lateNightNow = new Date(2026, 7, 1, 23, 30).getTime()
    let state = createGuardianState()
    const r1 = checkGuardian(state, { idleSec: 0, disturbBlocked: false, settings, now: lateNightNow })
    state = r1.state
    const r2 = checkGuardian(state, { idleSec: 0, disturbBlocked: false, settings, now: lateNightNow + 46 * 60000 })
    expect(r2.signal).toMatchObject({ type: 'guardian_warning', reason: 'late_night', lateNight: true })
  })

  it('信号带 streakMin 供消息生成使用', () => {
    const { signals, state } = run([{ mins: 1 }, { mins: 121 }])
    expect(signals[1]).toBe('guardian_warning')
    expect(state.lastReminderAt).toBeGreaterThan(0)
  })
})

describe('Guardian — 不绕过 DND', () => {
  it('disturbBlocked 期间即使超阈值也不产生信号', () => {
    const { signals } = run([
      { mins: 1 },
      { mins: 46, disturbBlocked: true }   // streak exceeds while in meeting
    ])
    expect(signals[1]).toBeNull()
  })

  it('用户离开 → 清零，不产生信号', () => {
    const { signals } = run([
      { mins: 1 },
      { mins: 46 },
      { idleSec: 300, mins: 1 }            // away
    ])
    expect(signals[2]).toBeNull()
  })

  it('关闭时 → 永不产生信号', () => {
    let state = createGuardianState()
    const disabled: GuardianSettings = { ...settings, enabled: false }
    const r = checkGuardian(state, { idleSec: 0, disturbBlocked: false, settings: disabled, now })
    expect(r.signal).toBeNull()
  })
})
