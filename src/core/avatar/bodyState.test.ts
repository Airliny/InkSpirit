import { describe, it, expect } from 'vitest'
import { computeBodyState } from './bodyState'
import type { BodyStateInput } from './bodyState'

function input(overrides: Partial<BodyStateInput> = {}): BodyStateInput {
  return { expression: 'neutral', activity: 'idle', mood: 'neutral', state: 'idle', look: { x: 0, y: 0 }, ...overrides }
}

describe('BodyState — 情绪驱动身体参数', () => {
  it('neutral 是基线', () => {
    const s = computeBodyState(input())
    expect(s.energy).toBe(0.5)
    expect(s.movementSpeed).toBe(1)
    expect(s.breathSpeed).toBe(1)
    expect(s.sway).toBe(1)
  })

  it('happy 更活泼：动作幅度与呼吸加快', () => {
    const s = computeBodyState(input({ expression: 'happy' }))
    expect(s.energy).toBeGreaterThan(0.5)
    expect(s.movementSpeed).toBeGreaterThan(1)
    expect(s.breathSpeed).toBeGreaterThan(1)
  })

  it('sad 更安静：能量低、摆幅小、看得少', () => {
    const s = computeBodyState(input({ expression: 'sad' }))
    expect(s.energy).toBeLessThan(0.5)
    expect(s.sway).toBeLessThan(1)
    expect(s.lookFrequency).toBeLessThan(0.35)
  })

  it('sleep 状态身体不摆', () => {
    const s = computeBodyState(input({ state: 'sleep' }))
    expect(s.sway).toBe(0)
    expect(s.breathSpeed).toBeLessThan(1)
  })

  it('思考时注意力在用户身上：看得很频繁、动作安静', () => {
    const s = computeBodyState(input({ activity: 'thinking', expression: 'sad' }))
    expect(s.lookFrequency).toBeGreaterThanOrEqual(0.9)
    expect(s.movementSpeed).toBeLessThan(1)
  })

  it('look 传入后原样（钳制到 ±1）', () => {
    const s = computeBodyState(input({ look: { x: 2, y: -0.5 } }))
    expect(s.lookX).toBe(1)
    expect(s.lookY).toBe(-0.5)
  })
})
