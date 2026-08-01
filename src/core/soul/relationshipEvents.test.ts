import { describe, it, expect } from 'vitest'
import {
  applyRelationshipEvent,
  applyMemoryFeedback,
  classifyInteraction,
  classifyRecallFeedback,
  computeStage,
  mergeWeights,
  recallEvent,
  recallRelevance,
  shouldRewardRecall,
  DEFAULT_EVENT_WEIGHTS,
  MEMORY_FEEDBACK_GAIN,
  type EventWeights,
  type RelationshipEvent,
  type RelationshipState
} from './relationshipEvents'

function makeState(overrides: Partial<RelationshipState> = {}): RelationshipState {
  return {
    userId: 'default',
    trust: 0.1,
    familiarity: 0.1,
    affection: 0.1,
    intimacy: 0.05,
    dependency: 0.05,
    understanding: 0.1,
    interactionCount: 0,
    stage: 'stranger',
    firstInteractionAt: null,
    lastInteractionAt: null,
    ...overrides
  }
}

function event(type: RelationshipEvent['type'], intensity = 1): RelationshipEvent {
  return { type, intensity, timestamp: Date.now(), source: 'conversation' }
}

function applyMany(
  state: RelationshipState,
  type: RelationshipEvent['type'],
  count: number,
  intensity = 1,
  weights?: EventWeights
): RelationshipState {
  let s = state
  for (let i = 0; i < count; i++) s = applyRelationshipEvent(s, event(type, intensity), weights)
  return s
}

describe('验收1 — 天天聊天提升熟悉度，不提升亲密', () => {
  it('30 次日常聊天: familiarity 显著上升, intimacy 保持不变', () => {
    const s = applyMany(makeState(), 'daily_chat', 30)
    expect(s.familiarity).toBeGreaterThan(0.3)
    expect(s.intimacy).toBeCloseTo(0.05, 10)
    expect(s.understanding).toBeCloseTo(0.1, 10)
  })
})

describe('验收2 — 深度分享提升亲密与信任', () => {
  it('30 次深度分享: intimacy 大幅上升, trust 上升', () => {
    const s = applyMany(makeState(), 'deep_share', 30)
    expect(s.intimacy).toBeGreaterThan(0.3)
    expect(s.trust).toBeGreaterThan(0.2)
    expect(s.intimacy).toBeGreaterThan(s.trust)
  })
})

describe('验收3 — 纠正与记忆反馈闭环', () => {
  it('correction 先降低 understanding', () => {
    const before = makeState({ understanding: 0.5 })
    const after = applyRelationshipEvent(before, event('correction'))
    expect(after.understanding).toBeLessThan(before.understanding)
  })

  it('记忆反馈成功后 understanding 回升', () => {
    const before = applyRelationshipEvent(makeState({ understanding: 0.5 }), event('correction'))
    const after = applyMemoryFeedback(before, true)
    expect(after.understanding).toBeGreaterThan(before.understanding)
    expect(after.understanding).toBeLessThanOrEqual(1)
  })

  it('记忆反馈失败是 no-op', () => {
    const before = makeState({ understanding: 0.5 })
    const after = applyMemoryFeedback(before, false)
    expect(after).toBe(before)
    expect(after.understanding).toBe(0.5)
  })
})

describe('验收4 — 天天聊天 vs 偶尔深聊', () => {
  it('A(日常聊天) familiarity 高 intimacy 中；B(深聊) 反过来', () => {
    const a = applyMany(makeState(), 'daily_chat', 30)
    const b = applyMany(makeState(), 'deep_share', 30)
    expect(a.familiarity).toBeGreaterThan(b.familiarity)
    expect(b.intimacy).toBeGreaterThan(a.intimacy)
    expect(a.intimacy).toBeLessThan(b.intimacy)
  })
})

describe('冲突与修复', () => {
  it('conflict 不过度惩罚', () => {
    const s = applyMany(makeState(), 'conflict', 10)
    expect(s.trust).toBeGreaterThan(0.05)
    expect(s.affection).toBeGreaterThan(0.05)
  })

  it('reconcile 显著修复信任', () => {
    const hurt = applyMany(makeState(), 'conflict', 5)
    const repaired = applyMany(hurt, 'reconcile', 3)
    expect(repaired.trust).toBeGreaterThan(hurt.trust)
    expect(repaired.understanding).toBeGreaterThan(hurt.understanding)
  })
})

describe('配置驱动权重', () => {
  it('mergeWeights 支持运行时覆盖单维度', () => {
    const custom = mergeWeights(DEFAULT_EVENT_WEIGHTS, {
      daily_chat: { intimacy: 0.6 }
    })
    const s = applyMany(makeState(), 'daily_chat', 10, 1, custom)
    expect(s.intimacy).toBeGreaterThan(0.2)
  })

  it('事件强度缩放效果', () => {
    const weak = applyMany(makeState(), 'deep_share', 10, 0.3)
    const strong = applyMany(makeState(), 'deep_share', 10, 1)
    expect(strong.intimacy).toBeGreaterThan(weak.intimacy)
  })
})

describe('stage 仅作展示投影', () => {
  it('低维度是 stranger，高维度逐步升级', () => {
    expect(computeStage(makeState())).toBe('stranger')
    const grown = applyMany(applyMany(makeState(), 'deep_share', 40), 'daily_chat', 40)
    expect(computeStage(grown)).not.toBe('stranger')
  })

  it('interactionCount 不影响 stage（权重投影决定）', () => {
    const counted = makeState({ interactionCount: 999 })
    expect(computeStage(counted)).toBe('stranger')
  })
})

describe('classifyInteraction 优先级', () => {
  it('纠正 > 冲突', () => {
    const e = classifyInteraction({ userMsg: '不是这样，你记错了。', hostility: 0.9, kindness: 0 })
    expect(e[0].type).toBe('correction')
  })

  it('道歉 > 冲突', () => {
    const e = classifyInteraction({ userMsg: '对不起，刚才语气不好。', hostility: 0.6, kindness: 0.2 })
    expect(e[0].type).toBe('reconcile')
  })

  it('深度分享需要足够长度', () => {
    const short = classifyInteraction({ userMsg: '压力', hostility: 0, kindness: 0 })
    const long = classifyInteraction({ userMsg: '最近工作压力真的很大，有点失眠，心情很差。', hostility: 0, kindness: 0 })
    expect(short[0].type).toBe('daily_chat')
    expect(long[0].type).toBe('deep_share')
  })

  it('依赖/成就/关心/日常兜底', () => {
    expect(classifyInteraction({ userMsg: '帮我规划一下明天的行程吧', hostility: 0, kindness: 0 })[0].type).toBe('rely')
    expect(classifyInteraction({ userMsg: '我终于把项目上线了！', hostility: 0, kindness: 0 })[0].type).toBe('achievement')
    expect(classifyInteraction({ userMsg: '你今天感觉怎么样？', hostility: 0, kindness: 0 })[0].type).toBe('care')
    expect(classifyInteraction({ userMsg: '今天天气不错', hostility: 0, kindness: 0 })[0].type).toBe('daily_chat')
  })
})

describe('Test 66 — 成功回忆 → memory_recall_success', () => {
  it('understanding 上升，trust 小幅上升', () => {
    const before = makeState({ understanding: 0.3, trust: 0.2 })
    const after = applyRelationshipEvent(before, { type: 'memory_recall_success', intensity: 1, timestamp: Date.now(), source: 'memory' })
    expect(after.understanding).toBeGreaterThan(before.understanding)
    expect(after.trust).toBeGreaterThan(before.trust)
  })

  it('recallEvent 映射正确', () => {
    const ev = recallEvent('mem-1', 'success')
    expect(ev?.type).toBe('memory_recall_success')
    expect(ev?.source).toBe('memory')
    expect(ev?.metadata).toEqual({ memoryId: 'mem-1' })
  })
})

describe('Test 67 — 用户确认 → memory_recall_confirmed', () => {
  it('understanding 上升幅度大于 success，且 intimacy 上升', () => {
    const confirmed = applyRelationshipEvent(makeState({ understanding: 0.3, intimacy: 0.1 }), {
      type: 'memory_recall_confirmed', intensity: 1, timestamp: Date.now(), source: 'memory'
    })
    const success = applyRelationshipEvent(makeState({ understanding: 0.3, intimacy: 0.1 }), {
      type: 'memory_recall_success', intensity: 1, timestamp: Date.now(), source: 'memory'
    })
    expect(confirmed.understanding).toBeGreaterThan(success.understanding)
    expect(confirmed.intimacy).toBeGreaterThan(success.intimacy)
    expect(confirmed.intimacy).toBeGreaterThan(0.1)
  })

  it('确认权重不超过 correction 修复增益（原则校验）', () => {
    expect(DEFAULT_EVENT_WEIGHTS.memory_recall_confirmed.understanding!).toBeLessThanOrEqual(MEMORY_FEEDBACK_GAIN)
    expect(DEFAULT_EVENT_WEIGHTS.memory_recall_success.understanding!).toBeLessThan(
      DEFAULT_EVENT_WEIGHTS.memory_recall_confirmed.understanding!
    )
  })
})

describe('Test 68 — 错误回忆 → 无奖励，走 correction 流程', () => {
  it('recallEvent(wrong) 返回 null', () => {
    expect(recallEvent('mem-1', 'wrong')).toBeNull()
  })

  it('用户的纠正文本被 classifyInteraction 识别为 correction', () => {
    const e = classifyInteraction({ userMsg: '不对，我不喜欢那个，你记错了。', hostility: 0, kindness: 0 })
    expect(e[0].type).toBe('correction')
  })
})

describe('回忆质量门槛', () => {
  it('relevance 低于阈值不奖励（防刷回忆）', () => {
    expect(shouldRewardRecall({ retentionScore: 0.2, importance: 0.3 })).toBe(false)
    expect(shouldRewardRecall({ retentionScore: 0.9, importance: 0.8 })).toBe(true)
    expect(recallRelevance({ retentionScore: 0.9, importance: 0.8 })).toBeCloseTo(0.85)
  })

  it('classifyRecallFeedback：确认/纠正/中性', () => {
    expect(classifyRecallFeedback('对，那次真的很累。')).toBe('confirmed')
    expect(classifyRecallFeedback('没错，就是这个。')).toBe('confirmed')
    expect(classifyRecallFeedback('不对，我不喜欢那个。')).toBe('wrong')
    expect(classifyRecallFeedback('你记错了吧')).toBe('wrong')
    expect(classifyRecallFeedback('嗯，继续说别的吧')).toBeNull()
  })
})

describe('身份边界 — 名字是身份标签，不是人格开关', () => {
  it('name_assigned：只微增信任，人格/关系维度不动', () => {
    const before = makeState({ trust: 0.1, familiarity: 0.5, affection: 0.5, intimacy: 0.4 })
    const after = applyRelationshipEvent(before, {
      type: 'name_assigned',
      intensity: 1,
      timestamp: Date.now(),
      source: 'identity'
    })
    // 微小信任增长：0.2 * 1 * 0.05 = 0.01 起步（渐进收敛）
    expect(after.trust).toBeCloseTo(0.109, 3)
    expect(after.familiarity).toBeCloseTo(0.5, 10)
    expect(after.affection).toBeCloseTo(0.5, 10)
    expect(after.intimacy).toBeCloseTo(0.4, 10)
    expect(after.understanding).toBeCloseTo(0.1, 10)
  })

  it('信任增益极小且收敛：反复改名不会刷高信任', () => {
    const s = applyMany(makeState(), 'name_assigned', 10)
    expect(s.trust).toBeLessThan(0.2)
    // 名字不改变人格——人格维度在 Personality 层，事件根本不触碰
    expect(s.affection).toBeCloseTo(0.1, 10)
  })

  it('信任增长来自"用户主动给予"这一行为，而非名字本身', () => {
    const weights = DEFAULT_EVENT_WEIGHTS.name_assigned!
    expect(weights.trust).toBeGreaterThan(0)
    // 除信任外不触碰任何维度（没有 affection/intimacy 联动）
    expect(weights.affection).toBeUndefined()
    expect(weights.intimacy).toBeUndefined()
    expect(weights.understanding).toBeUndefined()
  })
})
