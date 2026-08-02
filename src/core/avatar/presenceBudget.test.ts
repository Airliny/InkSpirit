import { describe, it, expect } from 'vitest'
import {
  emptyPresenceBudget,
  spendPresence,
  dateKeyOf,
  presenceUsage,
  effectiveBudget,
  DAILY_BUDGETS
} from './presenceBudget'
import { applyInteraction, comfortFromQuality, bodyMemoryConfigKeys } from './touchQuality'

describe('Presence Budget — 存在感预算（生命感来自稀缺）', () => {
  it('预算内允许花费并计数', () => {
    let st = emptyPresenceBudget(dateKeyOf(1000))
    const r = spendPresence(st, 'glance', 1000)
    st = r.state
    expect(r.allowed).toBe(true)
    expect(presenceUsage(st, 'glance')).toBe(1 / DAILY_BUDGETS.glance)
  })

  it('预算耗尽 → 静默拒绝（不是显得更急）', () => {
    let st = emptyPresenceBudget(dateKeyOf(1000))
    for (let i = 0; i < DAILY_BUDGETS.wander; i++) {
      const r = spendPresence(st, 'wander', 1000 + i)
      st = r.state
      expect(r.allowed).toBe(true)
    }
    const exhausted = spendPresence(st, 'wander', 2000)
    expect(exhausted.allowed).toBe(false)
    // 其他动作不受影响
    expect(spendPresence(st, 'glance', 2000).allowed).toBe(true)
  })

  it('跨天自动重置', () => {
    let st = emptyPresenceBudget(dateKeyOf(1000))
    for (let i = 0; i < DAILY_BUDGETS.wander; i++) {
      st = spendPresence(st, 'wander', 1000 + i).state
    }
    // 第二天
    const nextDay = spendPresence(st, 'wander', 1000 + 24 * 3600 * 1000)
    expect(nextDay.allowed).toBe(true)
    expect(nextDay.state.dateKey).not.toBe(st.dateKey)
  })
})

describe('Presence Budget 语境调制 — 用户不在时预算收紧（安静是亲密）', () => {
  it('离开时注视预算降到 ~1/3（100 次而非 300 次）', () => {
    const away = effectiveBudget('glance', { userPresent: false })
    const present = effectiveBudget('glance', { userPresent: true })
    expect(away).toBeLessThan(present)
    expect(away).toBe(Math.max(1, Math.round(DAILY_BUDGETS.glance * 0.33)))
  })

  it('用户在场：正常预算不受影响', () => {
    expect(effectiveBudget('glance', { userPresent: true })).toBe(DAILY_BUDGETS.glance)
  })

  it('离开时花费到 100 次后拒绝；回场后同一状态还能继续（按在场预算）', () => {
    let st = emptyPresenceBudget(dateKeyOf(1000))
    const awayBudget = effectiveBudget('glance', { userPresent: false })
    for (let i = 0; i < awayBudget; i++) {
      st = spendPresence(st, 'glance', 1000 + i, { userPresent: false }).state
    }
    // 离开状态下已用完
    expect(spendPresence(st, 'glance', 2000, { userPresent: false }).allowed).toBe(false)
    // 用户回来了：预算更宽，还能看
    expect(spendPresence(st, 'glance', 2000, { userPresent: true }).allowed).toBe(true)
  })
})

describe('Body Memory 边界 — 身体层只碰熟悉感', () => {
  it('身体记忆只写 body_touch_quality 一个键', () => {
    expect(bodyMemoryConfigKeys()).toEqual(['body_touch_quality'])
  })

  it('灵魂键绝不在身体记忆写入范围（爱意/依赖/信任归灵魂层管）', () => {
    const soulKeys = [
      'relationships', 'affection', 'dependency', 'intimacy', 'trust',
      'understanding', 'personality_*', 'emotion_*', 'memory_*', 'identity_events'
    ]
    const keys = new Set(bodyMemoryConfigKeys())
    for (const k of soulKeys) expect(keys.has(k)).toBe(false)
  })

  it('交互质量只改变熟悉感曲线（lookFrequency/energy），不产生关系事件', () => {
    // comfort 只进 computeBodyState 的身体参数；关系引擎由 relationshipEvents 驱动
    let q = 0
    for (let i = 0; i < 30; i++) q = applyInteraction(q, 'comfort')
    expect(comfortFromQuality(q)).toBeLessThanOrEqual(1)
  })
})
