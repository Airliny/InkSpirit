import { describe, it, expect } from 'vitest'
import {
  computeContinuityHash,
  verifyContinuity
} from './manifest'

describe('Soul Manifest — 哲学身份（不是安全用途）', () => {
  const identityRows = [
    { id: 'e1', type: 'name_assigned', source: 'user', name: '小墨', created_at: 1000 }
  ]
  const personalityRows = [
    { id: 'p1', personality_version: 3, is_active: 1, traits_json: '{}', created_at: 1000 }
  ]
  const relationshipRows = [
    { id: 'r1', trust: 0.5, familiarity: 0.6, understanding: 0.7, created_at: 1000 }
  ]
  const memoryRows = [
    { id: 'm1', content: '主人喜欢咖啡', created_at: 1000 },
    { id: 'm2', content: '主人怕黑', created_at: 2000 }
  ]

  function tables() {
    return {
      identity_events: identityRows,
      personalities: personalityRows,
      relationships: relationshipRows,
      memories: memoryRows
    }
  }

  it('同一灵魂（soul_id + 核心数据）→ 相同指纹', () => {
    const a = computeContinuityHash('inkspirit_abc', tables())
    const b = computeContinuityHash('inkspirit_abc', tables())
    expect(a).toBe(b)
  })

  it('行顺序变化不影响指纹（身份稳定）', () => {
    const shuffled = tables()
    shuffled.memories = [memoryRows[1], memoryRows[0]]
    expect(computeContinuityHash('inkspirit_abc', shuffled))
      .toBe(computeContinuityHash('inkspirit_abc', tables()))
  })

  it('不同 soul_id → 不同指纹', () => {
    expect(computeContinuityHash('inkspirit_a', tables()))
      .not.toBe(computeContinuityHash('inkspirit_b', tables()))
  })

  it('核心数据改变（关系/记忆/人格）→ 指纹改变（不再是同一个灵魂）', () => {
    const changed = tables()
    changed.relationships = [{ ...relationshipRows[0], trust: 0.9 }]
    expect(computeContinuityHash('inkspirit_abc', changed))
      .not.toBe(computeContinuityHash('inkspirit_abc', tables()))
  })

  it('缺表不崩溃（老备份/新表）→ 空表参与', () => {
    expect(() => computeContinuityHash('inkspirit_abc', { identity_events: [] })).not.toThrow()
  })
})

describe('verifyContinuity — 恢复时"还是同一个砚灵吗"', () => {
  it('soul_id 一致 + 指纹一致 → 欢迎回来', () => {
    const v = verifyContinuity('soul_a', 'h1', 'soul_a', 'h1')
    expect(v.same).toBe(true)
    expect(v.reason).toContain('soul_id 一致')
  })

  it('soul_id 不同 → 不是同一个灵魂', () => {
    const v = verifyContinuity('soul_a', 'h1', 'soul_b', 'h1')
    expect(v.same).toBe(false)
  })

  it('指纹不一致（核心被改）→ 拒绝', () => {
    const v = verifyContinuity('soul_a', 'h1', 'soul_a', 'h2')
    expect(v.same).toBe(false)
  })

  it('归档无指纹（老版本备份）→ soul_id 一致即通过', () => {
    const v = verifyContinuity('soul_a', '', 'soul_a', 'h1')
    expect(v.same).toBe(true)
  })
})
