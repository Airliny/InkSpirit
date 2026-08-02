import { describe, it, expect } from 'vitest'
import {
  DEFAULT_BODY_PREFERENCES,
  parseBodyPreferences,
  serializeBodyPreferences,
  applyBodyPreferences
} from './preferences'
import { computeBodyState } from './bodyState'
import type { BodyStateInput } from './bodyState'

function input(overrides: Partial<BodyStateInput> = {}): BodyStateInput {
  return { expression: 'neutral', activity: 'idle', mood: 'neutral', state: 'idle', look: { x: 0.5, y: 0.2 }, ...overrides }
}

describe('身体偏好持久化', () => {
  it('空配置 → 默认全开', () => {
    expect(parseBodyPreferences(null)).toEqual(DEFAULT_BODY_PREFERENCES)
  })

  it('损坏 JSON → 回默认（绝不崩溃）', () => {
    expect(parseBodyPreferences('{{{')).toEqual(DEFAULT_BODY_PREFERENCES)
  })

  it('序列化往返一致', () => {
    const prefs = { lookFollow: false, sway: true, touchFeel: false }
    expect(parseBodyPreferences(serializeBodyPreferences(prefs))).toEqual(prefs)
  })

  it('部分配置 → 缺失项用默认', () => {
    const p = parseBodyPreferences(JSON.stringify({ lookFollow: false }))
    expect(p.lookFollow).toBe(false)
    expect(p.sway).toBe(true)
  })
})

describe('applyBodyPreferences — 偏好关掉的能力归零', () => {
  it('关视线跟随 → lookX/lookY/lookFrequency 归零', () => {
    const state = applyBodyPreferences(computeBodyState(input()), { ...DEFAULT_BODY_PREFERENCES, lookFollow: false })
    expect(state.lookX).toBe(0)
    expect(state.lookY).toBe(0)
    expect(state.lookFrequency).toBe(0)
    expect(state.sway).toBe(1) // 摆动不受影响
  })

  it('关摆动 → sway 归零，视线保留', () => {
    const state = applyBodyPreferences(computeBodyState(input()), { ...DEFAULT_BODY_PREFERENCES, sway: false })
    expect(state.sway).toBe(0)
    expect(state.lookX).toBe(0.5)
  })

  it('瞬时状态（呼吸/视线）不经过持久化层', () => {
    // 文档性断言：preferences 只含偏好开关，不含任何瞬时参数
    const keys = Object.keys(DEFAULT_BODY_PREFERENCES).sort()
    expect(keys).toEqual(['lookFollow', 'sway', 'touchFeel'].sort())
  })
})

describe('Body Memory — 触摸计数影响身体期待', () => {
  it('没被摸过：视线频率是基线', () => {
    const s = computeBodyState(input({ look: { x: 0, y: 0 } }))
    expect(s.lookFrequency).toBe(0.35)
  })

  it('被摸很多（comfort=1）：视线频率明显提升（更期待你靠近）', () => {
    const s = computeBodyState(input({ look: { x: 0, y: 0 }, touchComfort: 1 }))
    expect(s.lookFrequency).toBeGreaterThan(0.5)
    expect(s.energy).toBeGreaterThan(0.5)
  })

  it('comfort 溢出值被钳制', () => {
    const s = computeBodyState(input({ look: { x: 0, y: 0 }, touchComfort: 5 }))
    expect(s.lookFrequency).toBeLessThanOrEqual(1)
  })
})
