import { describe, it, expect } from 'vitest'
import {
  applyInteraction,
  comfortFromQuality,
  qualityStage,
  trackClick,
  emptyClickTracker,
  QUALITY_WEIGHTS
} from './touchQuality'

describe('Interaction Quality — 不是点击次数养成游戏', () => {
  it('普通触摸 +1，高质量互动更多，刷屏扣分', () => {
    let q = 0
    q = applyInteraction(q, 'touch')
    expect(q).toBe(QUALITY_WEIGHTS.touch)
    q = applyInteraction(q, 'comfort')
    expect(q).toBe(QUALITY_WEIGHTS.touch + QUALITY_WEIGHTS.comfort)
    q = applyInteraction(q, 'spam')
    expect(q).toBe(QUALITY_WEIGHTS.touch + QUALITY_WEIGHTS.comfort + QUALITY_WEIGHTS.spam)
  })

  it('质量有界 0-100', () => {
    let q = 0
    for (let i = 0; i < 200; i++) q = applyInteraction(q, 'comfort')
    expect(q).toBe(100)
    for (let i = 0; i < 200; i++) q = applyInteraction(q, 'spam')
    expect(q).toBe(0)
  })

  it('comfort 曲线：质量/50', () => {
    expect(comfortFromQuality(0)).toBe(0)
    expect(comfortFromQuality(50)).toBe(1)
    expect(comfortFromQuality(25)).toBe(0.5)
  })

  it('质量阶段文案', () => {
    expect(qualityStage(5).tier).toBe(0)
    expect(qualityStage(30).tier).toBe(1)
    expect(qualityStage(55).tier).toBe(2)
    expect(qualityStage(85).tier).toBe(3)
  })
})

describe('刷屏检测 — 连续疯狂点击不算互动', () => {
  it('窗口期内 5 连点 → 刷屏批', () => {
    let st = emptyClickTracker()
    let batch: string = 'touch'
    for (let i = 0; i < 5; i++) {
      const r = trackClick(st, 1000 + i * 100)
      st = r.state
      batch = r.batch
      expect(r.overload).toBe(false)
    }
    expect(batch).toBe('spam')
  })

  it('间隔超过窗口 → 每批都算普通触摸', () => {
    let st = emptyClickTracker()
    const r1 = trackClick(st, 1000)
    st = r1.state
    const r2 = trackClick(st, 1000 + 9000)
    expect(r2.batch).toBe('touch')
  })

  it('连续 3 次刷屏 → 过载（有点晕，需要休息）', () => {
    let st = emptyClickTracker()
    let overload = false
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 5; i++) {
        const r = trackClick(st, 10000 + round * 10000 + i * 100)
        st = r.state
        overload = r.overload
      }
    }
    expect(overload).toBe(true)
  })

  it('休息超过 30 秒 → 刷屏记录清零', () => {
    let st = emptyClickTracker()
    for (let i = 0; i < 5; i++) {
      st = trackClick(st, 10000 + i * 100).state
    }
    expect(st.spamStreak).toBe(1)
    // 休息 40 秒后继续点 → 从零开始
    st = trackClick(st, 10000 + 40000).state
    expect(st.spamStreak).toBe(0)
  })

  it('正常触摸后不累计过载', () => {
    let st = emptyClickTracker()
    st = trackClick(st, 1000).state
    st = trackClick(st, 5000).state
    expect(st.spamStreak).toBe(0)
  })
})
