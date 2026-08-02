import { describe, it, expect } from 'vitest'
import { emptyLookControl, updateLook, LOOK_RADIUS } from './lookTarget'
import type { CursorInfo } from './lookTarget'

function cursor(x: number, y: number, near = true): CursorInfo {
  return { x, y, near }
}

describe('LookTarget — 偶尔偷看，不一直跟', () => {
  it('游标不在附近 → 不看', () => {
    const c = updateLook(cursor(50, 50, false), emptyLookControl(), 1000, 0.5, () => 0)
    expect(c.active).toBe(false)
  })

  it('游标超出半径 → 不看', () => {
    const c = updateLook(cursor(LOOK_RADIUS + 100, 0), emptyLookControl(), 1000, 0.5, () => 0)
    expect(c.active).toBe(false)
  })

  it('频率为 0 → 永远不看（睡觉/低落时）', () => {
    const c = updateLook(cursor(30, 0), emptyLookControl(), 1000, 0, () => 0)
    expect(c.active).toBe(false)
  })

  it('概率命中 → 开始偷看，方向朝游标', () => {
    const c = updateLook(cursor(60, 0), emptyLookControl(), 1000, 0.5, () => 0.0)
    expect(c.active).toBe(true)
    expect(c.x).toBeGreaterThan(0)
    expect(c.y).toBe(0)
  })

  it('概率未命中 → 不看', () => {
    const c = updateLook(cursor(60, 0), emptyLookControl(), 1000, 0.5, () => 0.99)
    expect(c.active).toBe(false)
  })

  it('正在偷看期间：方向跟随游标移动', () => {
    const first = updateLook(cursor(100, 0), emptyLookControl(), 1000, 0.5, () => 0.0)
    expect(first.active).toBe(true)
    const moved = updateLook(cursor(-40, 30), first, 1000, 0.5, () => 0.99)
    expect(moved.active).toBe(true) // 偷看期间不看概率
    expect(moved.x).toBeLessThan(0) // 跟过去了
  })

  it('偷看超时 → 收回视线', () => {
    const first = updateLook(cursor(100, 0), emptyLookControl(), 1000, 0.5, () => 0.0)
    const later = updateLook(cursor(100, 0), first, first.until + 1, 0.5, () => 0.99)
    expect(later.active).toBe(false)
  })

  it('高频时更容易看、看得更久', () => {
    const low = updateLook(cursor(40, 0), emptyLookControl(), 0, 0.1, () => 0.1)
    const high = updateLook(cursor(40, 0), emptyLookControl(), 0, 0.9, () => 0.1)
    expect(low.active).toBe(false) // chance=0.076 < 0.1 → 低频不开
    expect(high.active).toBe(true) // chance=0.204 ≥ 0.1 → 高频开
    const a = updateLook(cursor(40, 0), emptyLookControl(), 0, 0.1, () => 0)
    const b = updateLook(cursor(40, 0), emptyLookControl(), 0, 0.9, () => 0)
    expect(b.until - a.until).toBeGreaterThan(0) // 高频看得更久
  })
})
