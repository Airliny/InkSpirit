import { describe, it, expect } from 'vitest'
import {
  computeTemperament,
  worldBodyModifiers,
  classifyTouchContext,
  mergeModifiers
} from './expressionLayer'
import type { WorldBodySignals } from './expressionLayer'

const neutralWorld: WorldBodySignals = {
  fatigue: 0.2,
  hourContext: 'day',
  sleepLate: false,
  busyDeviation: 0,
  quietDeviation: 0,
  streakMin: 10
}

const lonelyInput = () => ({ understanding: 0, attachment: 0, trust: 0, warmth: 0 })
const cherishedInput = () => ({ understanding: 0.8, attachment: 0.9, trust: 0.9, warmth: 0.8 })

describe('Temperament — 长期气质进入身体（连续表达层）', () => {
  it('长期孤单：身体安静（能量低、视线少）', () => {
    const t = computeTemperament(lonelyInput())
    expect(t.energyScale).toBeLessThan(1)
    expect(t.lookScale).toBeLessThan(0.7)
  })

  it('长期被温柔对待：身体轻快（能量高、视线主动）', () => {
    const t = computeTemperament(cherishedInput())
    expect(t.energyScale).toBeGreaterThan(1)
    expect(t.lookScale).toBeGreaterThan(1)
  })

  it('孤单 vs 温柔对待：所有维度可区分', () => {
    const a = computeTemperament(lonelyInput())
    const b = computeTemperament(cherishedInput())
    expect(b.energyScale).toBeGreaterThan(a.energyScale)
    expect(b.lookScale).toBeGreaterThan(a.lookScale)
    expect(b.swayScale).toBeGreaterThan(a.swayScale)
    expect(b.movementScale).toBeGreaterThan(a.movementScale)
  })

  it('全部上限 → 仍是有界系数', () => {
    const t = computeTemperament({ understanding: 1, attachment: 1, trust: 1, warmth: 1 })
    expect(t.energyScale).toBeLessThanOrEqual(1.2)
    expect(t.lookScale).toBeLessThanOrEqual(1.2)
  })
})

describe('World → Body（生活环境影响身体）', () => {
  it('白天正常状态：身体不受影响', () => {
    const m = worldBodyModifiers(neutralWorld)
    expect(m.energyScale).toBe(1)
    expect(m.movementScale).toBe(1)
  })

  it('深夜 + 比平时晚睡：动作慢、呼吸缓、摆动小', () => {
    const m = worldBodyModifiers({ ...neutralWorld, hourContext: 'late_night', sleepLate: true })
    expect(m.movementScale).toBeLessThan(0.85)
    expect(m.breathScale).toBeLessThan(0.95)
    expect(m.swayScale).toBeLessThan(0.8)
  })

  it('连续工作疲劳：能量下降', () => {
    const m = worldBodyModifiers({ ...neutralWorld, fatigue: 0.7, streakMin: 150 })
    expect(m.energyScale).toBeLessThan(0.8)
    expect(m.movementScale).toBeLessThan(1)
  })

  it('异常忙碌的一天：稍微亢奋但有节制', () => {
    const m = worldBodyModifiers({ ...neutralWorld, busyDeviation: 1.5 })
    expect(m.energyScale).toBeGreaterThan(1)
    expect(m.movementScale).toBeGreaterThan(1)
  })

  it('异常安静的一天：身体也安静', () => {
    const m = worldBodyModifiers({ ...neutralWorld, quietDeviation: 1.5 })
    expect(m.energyScale).toBeLessThan(1)
    expect(m.lookScale).toBeLessThan(1)
  })
})

describe('Touch Context — 同一个动作，不同温度', () => {
  it('深夜疲惫 → 温柔回应', () => {
    expect(classifyTouchContext({ ...neutralWorld, hourContext: 'late_night', fatigue: 0.6 }, 'neutral', 'idle')).toBe('gentle')
  })

  it('睡觉心情 → 温柔回应', () => {
    expect(classifyTouchContext(neutralWorld, 'sleepy', 'idle')).toBe('gentle')
  })

  it('下午开心 → 活跃回应', () => {
    expect(classifyTouchContext(neutralWorld, 'happy', 'idle')).toBe('lively')
  })

  it('对话中 → 中性（注意力在对话上）', () => {
    expect(classifyTouchContext(neutralWorld, 'happy', 'listening')).toBe('neutral')
  })

  it('普通白天 → 中性', () => {
    expect(classifyTouchContext(neutralWorld, 'neutral', 'idle')).toBe('neutral')
  })
})

describe('mergeModifiers — 缺层不参与', () => {
  it('空层合并 = 中性', () => {
    expect(mergeModifiers([null, undefined])).toEqual({ energyScale: 1, movementScale: 1, breathScale: 1, swayScale: 1, lookScale: 1 })
  })

  it('多层相乘（1.2 × 0.75 < 1）', () => {
    const base = { energyScale: 1.2, movementScale: 1, breathScale: 1, swayScale: 1, lookScale: 1 }
    const tired = worldBodyModifiers({ ...neutralWorld, fatigue: 0.8 })
    const m = mergeModifiers([base, tired])
    expect(m.energyScale).toBeCloseTo(1.2 * tired.energyScale, 5)
    expect(m.energyScale).toBeLessThan(1)
  })
})
