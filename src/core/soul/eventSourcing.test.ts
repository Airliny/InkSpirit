import { describe, it, expect } from 'vitest'
import {
  computeChangeEntry,
  WEIGHTS_VERSION,
  type RelationshipEvent,
  type RelationshipState
} from './relationshipEvents'
import { computeEvolutionLogEntries, type PersonalityTraits } from './personality'

const state = (overrides: Partial<RelationshipState> = {}): RelationshipState => ({
  userId: 'default',
  trust: 0.1,
  familiarity: 0.1,
  affection: 0.1,
  intimacy: 0.05,
  dependency: 0.05,
  understanding: 0.1,
  interactionCount: 5,
  stage: 'stranger',
  firstInteractionAt: 1,
  lastInteractionAt: 2,
  ...overrides
})

const traits = (overrides: Partial<PersonalityTraits> = {}): PersonalityTraits => ({
  humor: 0.5,
  gentleness: 0.6,
  proactiveness: 0.4,
  curiosity: 0.7,
  professionalism: 0.5,
  expressiveness: 0.5,
  warmth: 0.5,
  formality: 0.4,
  ...overrides
})

describe('H2 — computeChangeEntry（关系变更日志纯函数）', () => {
  it('记录 affected 增量（仅变化的维度）', () => {
    const event: RelationshipEvent = {
      type: 'deep_share',
      intensity: 1,
      timestamp: 1000,
      source: 'conversation',
      metadata: { extra: true }
    }
    const before = state({ intimacy: 0.05, trust: 0.1 })
    const after = state({ intimacy: 0.081, trust: 0.115 })
    const entry = computeChangeEntry(event, before, after)

    expect(entry.eventType).toBe('deep_share')
    expect(entry.weightsVersion).toBe(WEIGHTS_VERSION)
    expect(entry.metadata).toEqual({ extra: true })
    expect(entry.affected.intimacy).toBeCloseTo(0.031)
    expect(entry.affected.trust).toBeCloseTo(0.015)
    // unaffected dims are not listed
    expect(entry.affected.affection).toBeUndefined()
    // before/after only carry affected dims (compact replay)
    expect(entry.before.intimacy).toBe(0.05)
    expect(entry.after.intimacy).toBe(0.081)
    expect(entry.before.familiarity).toBeUndefined()
  })

  it('无变化的事件产生空 affected（不写死日志）', () => {
    const event: RelationshipEvent = { type: 'daily_chat', intensity: 0.3, timestamp: 1, source: 'conversation' }
    const s = state()
    const entry = computeChangeEntry(event, s, s)
    expect(Object.keys(entry.affected).length).toBe(0)
  })

  it('memory_feedback 伪事件可记录（纠正闭环可回放）', () => {
    const before = state({ understanding: 0.5 })
    const after = state({ understanding: 0.675 })
    const entry = computeChangeEntry(
      { type: 'memory_feedback', intensity: 1, source: 'memory_feedback', timestamp: 5 },
      before,
      after
    )
    expect(entry.eventType).toBe('memory_feedback')
    expect(entry.affected.understanding).toBeCloseTo(0.175)
  })
})

describe('H1 — computeEvolutionLogEntries（人格进化日志纯函数）', () => {
  it('仅记录超过最小增量的特质变化', () => {
    const before = traits()
    const after = traits({ warmth: 0.55, gentleness: 0.61, humor: 0.5001 })
    const entries = computeEvolutionLogEntries(before, after, 7, '用户经常表达善意', 'care')

    expect(entries.length).toBe(2)
    const warmth = entries.find((e) => e.trait === 'warmth')!
    expect(warmth).toMatchObject({
      personalityVersion: 7,
      before: 0.5,
      after: 0.55,
      delta: 0.05,
      reason: '用户经常表达善意',
      source: 'care'
    })
    // below MIN_TRAIT_DELTA → skipped
    expect(entries.find((e) => e.trait === 'humor')).toBeUndefined()
    expect(entries.find((e) => e.trait === 'gentleness')).toBeDefined()
  })

  it('无变化返回空数组', () => {
    const s = traits()
    expect(computeEvolutionLogEntries(s, s, 1, null, null)).toEqual([])
  })
})
