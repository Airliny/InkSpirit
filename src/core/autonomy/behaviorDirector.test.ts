import { describe, it, expect } from 'vitest'
import { decide, evaluateGate } from './behaviorDirector'
import { createBudget, maxForPersonality, rolloverBudget, spendBudget } from './behaviorBudget'
import { scoreIntent } from './behaviorScorer'
import type { DecideResult, DirectorInput, BehaviorAction } from './behaviorTypes'
import type { RelationshipState, RelationshipEventType } from '../soul/relationshipEvents'
import { applyRelationshipEvent } from '../soul/relationshipEvents'
import type { SituationSnapshot } from '../world/situation'
import { synthesizeSituation } from '../world/situation'
import type { EmotionState } from '../soul/emotion'
import type { PersonalityTraits } from '../soul/personality'
import type { BehaviorImpulse } from './drives'

const personality: PersonalityTraits = {
  humor: 0.5,
  gentleness: 0.6,
  proactiveness: 0.4,
  curiosity: 0.7,
  professionalism: 0.5,
  expressiveness: 0.5,
  warmth: 0.5,
  formality: 0.4
}

const emotion: EmotionState = {
  happiness: 0.6,
  sadness: 0.1,
  curiosity: 0.6,
  energy: 0.6,
  concern: 0.25,
  attachment: 0.3,
  grudge: 0,
  jealousy: 0.05,
  anxiety: 0.1,
  confidence: 0.5,
  loneliness: 0,
  valence: 0.3,
  arousal: 0.4,
  dominantEmotion: 'neutral',
  secondaryEmotion: 'curious',
  baselineHappiness: 0.6,
  decayRate: 0.001,
  lastInteractionAt: Date.now(),
  timestamp: Date.now()
}

function relState(overrides: Partial<RelationshipState> = {}): RelationshipState {
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

/** Grow a relationship by repeated events (reuse engine) */
function growRel(events: [RelationshipEventType, number][]): RelationshipState {
  return events.reduce<RelationshipState>((state, [type, count]) => {
    for (let i = 0; i < count; i++) {
      state = applyRelationshipEvent(state, { type, intensity: 1, timestamp: Date.now(), source: 'conversation' })
    }
    return state
  }, relState())
}

const PARTNER = growRel([['deep_share', 40], ['daily_chat', 40], ['care', 20]])
const STRANGER = relState()

function situation(hour: number, overrides: Partial<SituationSnapshot> = {}): SituationSnapshot {
  return {
    ...synthesizeSituation({ scene: 'work', idleMs: 0, streakMin: 0, hour }),
    timestamp: new Date(2026, 7, 1, hour, 30).getTime(),
    ...overrides
  }
}

function input(overrides: Partial<DirectorInput> = {}): DirectorInput {
  return {
    situation: situation(14),
    relationship: STRANGER,
    personality,
    emotion,
    driveImpulse: { type: 'none' } as BehaviorImpulse,
    flags: {
      returnedAfterMs: 0,
      greetingDoneToday: true,
      nightDoneToday: true,
      recallableMemory: false,
      recollectSnippet: null,
      canHang: false,
      guardianSignal: null,
      stageGrowTo: null
    },
    budget: createBudget(3),
    ...overrides
  }
}

/** Fixed rng → deterministic weighted sampling (always picks first candidate) */
const rngZero = () => 0

function decided(input: DirectorInput): DecideResult {
  return decide(input, rngZero)
}

describe('验收1 — 会议/娱乐不打扰', () => {
  it('meeting 状态：任何说话类/挂窗行为被 Gate 阻止', () => {
    const meeting = input({ situation: situation(14, { userState: 'meeting' }), flags: { returnedAfterMs: 90 * 60000, recallableMemory: true, recollectSnippet: '测试', canHang: true, greetingDoneToday: false, nightDoneToday: false, guardianSignal: null, stageGrowTo: null } })
    const gate = evaluateGate(meeting)
    expect(gate.maxInterruptLevel).toBe(0)

    for (let i = 0; i < 50; i++) {
      const r = decide(meeting, () => i / 50)
      if (r.action) {
        expect(r.action.interruptLevel).toBe(0)
        expect(['social', 'care', 'recollect', 'ritual', 'hang']).not.toContain(r.action.kind)
      }
    }
  })

  it('playing（游戏/视频）同样全静默', () => {
    const g = evaluateGate(input({ situation: situation(20, { userState: 'playing' }) }))
    expect(g.maxInterruptLevel).toBe(0)
  })
})

describe('验收2 — 凌晨疲劳 → 休息陪伴而非随机聊天', () => {
  it('凌晨1点高疲劳：输出 rest_support（care），不是 casual_greet', () => {
    const lateNight = situation(1, {
      userState: 'fatigued',
      fatigue: 0.6,
      hourContext: 'late_night',
      streakMin: 180,
      inferredNeed: '主人可能比较疲劳，适合温柔的休息提醒'
    })
    for (let i = 0; i < 30; i++) {
      const r = decided(input({ situation: lateNight }))
      if (r.action) {
        expect(r.action.id).toBe('rest_support')
        expect(r.action.kind).toBe('care')
        expect(r.action.message).toMatch(/晚|担心|休息|月亮/)
      }
    }
  })

  it('白天疲劳：输出 rest_remind，带工作时长', () => {
    const tired = situation(14, { userState: 'fatigued', fatigue: 0.6, hourContext: 'day', streakMin: 150 })
    for (let i = 0; i < 30; i++) {
      const r = decided(input({ situation: tired }))
      if (r.action) expect(r.action.id).toBe('rest_remind')
    }
  })
})

describe('验收3 — 不同关系 → 不同主动行为', () => {
  it('同样"长期未见回归"：陌生人收到礼貌欢迎，伴侣收到上下文欢迎', () => {
    const returned = {
      returnedAfterMs: 3 * 3600 * 1000,
      greetingDoneToday: true,
      nightDoneToday: true,
      recallableMemory: false,
      recollectSnippet: null,
      canHang: false,
      guardianSignal: null,
      stageGrowTo: null
    }

    // 陌生人：无上下文感知，礼貌欢迎
    const strangerOut = decided(input({
      situation: situation(22, { patterns: { sleepLate: true, unusualSchedule: false, busyDeviation: 0, quietDeviation: 0 } }),
      relationship: STRANGER,
      flags: returned
    }))
    expect(strangerOut.action?.id).toBe('welcome_home')
    expect(strangerOut.action?.message).toBe('欢迎回来。')

    // 高理解+高亲密：感知到"今天回来比平时晚"
    const partnerOut = decided(input({
      situation: situation(22, { patterns: { sleepLate: true, unusualSchedule: false, busyDeviation: 0, quietDeviation: 0 } }),
      relationship: { ...PARTNER, understanding: 0.8 },
      flags: returned
    }))
    expect(partnerOut.action?.id).toBe('welcome_home')
    expect(partnerOut.action?.message).toContain('比平时晚')
  })

  it('伴侣比陌生人的 casual_greet 得分更高（scorer 确定性验证）', () => {
    const ctxFor = (rel: RelationshipState) => ({
      personality,
      relationship: rel,
      emotion,
      situation: situation(14)
    })
    const greetIntent = { id: 'casual_greet', kind: 'social' as const, interruptLevel: 2 as const, baseWeight: 0.25 }
    const strangerScore = scoreIntent(greetIntent, ctxFor(STRANGER))
    const partnerScore = scoreIntent(greetIntent, ctxFor(PARTNER))
    expect(partnerScore).toBeGreaterThan(strangerScore)
  })
})

describe('验收4 — 主动预算：不会刷屏', () => {
  it('低预算连续触发：说话类不超过上限，且输出 reason 可追溯', () => {
    const budget = createBudget(2)
    const flags = { returnedAfterMs: 0, greetingDoneToday: true, nightDoneToday: true, recallableMemory: true, recollectSnippet: '你之前说喜欢黑咖啡', canHang: false, guardianSignal: null, stageGrowTo: null }
    let current = budget
    const speakingIds: string[] = []
    for (let i = 0; i < 40; i++) {
      const r = decide(input({ flags, budget: current }), () => i / 40)
      current = r.budget
      if (r.action?.interruptLevel && r.action.interruptLevel >= 2) {
        speakingIds.push(r.action.id)
        expect(r.action.reason).toBeTruthy()
      }
    }
    expect(speakingIds.length).toBeLessThanOrEqual(2)
  })

  it('重要事件（欢迎回家）可突破预算', () => {
    const budget = spendBudget(spendBudget(createBudget(1)))
    const r = decided(input({
      flags: { returnedAfterMs: 60 * 60000, greetingDoneToday: true, nightDoneToday: true, recallableMemory: false, recollectSnippet: null, canHang: false, guardianSignal: null, stageGrowTo: null },
      budget
    }))
    expect(r.action?.id).toBe('welcome_home')
  })
})

describe('边界 — 离开/恢复/无情境', () => {
  it('用户离开：不说话，只允许安静动作', () => {
    const away = input({ situation: situation(14, { userState: 'away', idleMs: 180000 }) })
    const gate = evaluateGate(away)
    expect(gate.maxInterruptLevel).toBe(0)
    const r = decided(away)
    if (r.action) expect(r.action.interruptLevel).toBe(0)
  })

  it('恢复期：只允许 thought 级，不允许说话', () => {
    const recovering = input({ situation: situation(20, { userState: 'recovering' }) })
    const gate = evaluateGate(recovering)
    expect(gate.maxInterruptLevel).toBe(1)
    const r = decided(recovering)
    if (r.action) {
      expect(r.action.interruptLevel).toBeLessThanOrEqual(1)
      expect(r.action.kind).not.toBe('social')
    }
  })

  it('无情境（启动早期）：保守静默', () => {
    const g = evaluateGate(input({ situation: null }))
    expect(g.maxInterruptLevel).toBe(0)
  })
})

describe('边界 — 日常仪式与回忆', () => {
  it('早晨未问候 → morning_greeting（budgetExempt）', () => {
    const r = decided(input({ situation: situation(8), flags: { greetingDoneToday: false, nightDoneToday: true, returnedAfterMs: 0, recallableMemory: false, recollectSnippet: null, canHang: false, guardianSignal: null, stageGrowTo: null } }))
    expect(r.action?.id).toBe('morning_greeting')
    expect(r.action?.kind).toBe('ritual')
  })

  it('已问候过 → 不再触发仪式', () => {
    const r = decided(input({ situation: situation(8), flags: { greetingDoneToday: true, nightDoneToday: true, returnedAfterMs: 0, recallableMemory: false, recollectSnippet: null, canHang: false, guardianSignal: null, stageGrowTo: null } }))
    if (r.action) expect(r.action.id).not.toBe('morning_greeting')
  })

  it('有可回忆记忆 → recollect 可被选中', () => {
    let saw = false
    for (let i = 0; i < 100; i++) {
      const rr = decide(input({ situation: situation(14), flags: { returnedAfterMs: 0, greetingDoneToday: true, nightDoneToday: true, recallableMemory: true, recollectSnippet: '你之前说喜欢黑咖啡', canHang: false, guardianSignal: null, stageGrowTo: null } }), () => i / 100)
      if (rr.action?.id === 'recollect') { saw = true; break }
    }
    expect(saw).toBe(true)
  })
})

describe('Phase B — Guardian 信号经 Director 表达', () => {
  const guardianSignal = {
    type: 'guardian_warning' as const,
    priority: 'high' as const,
    reason: 'continuous_work' as const,
    streakMin: 95,
    lateNight: false
  }

  it('guardian 信号 → guardian_remind 意图（care，不直接说话）', () => {
    const r = decided(input({ flags: { ...input({}).flags, guardianSignal } }))
    expect(r.action?.id).toBe('guardian_remind')
    expect(r.action?.kind).toBe('care')
    expect(r.action?.message).toContain('95')
  })

  it('guardian 不绕过 DND（meeting 中 gate 拦截）', () => {
    const meeting = input({
      situation: situation(14, { userState: 'meeting' }),
      flags: { ...input({}).flags, guardianSignal }
    })
    for (let i = 0; i < 20; i++) {
      const r = decide(meeting, () => i / 20)
      if (r.action) expect(r.action.id).not.toBe('guardian_remind')
    }
  })

  it('guardian 提醒占用说话预算', () => {
    const budget = createBudget(1)
    const r1 = decided(input({ flags: { ...input({}).flags, guardianSignal }, budget }))
    expect(r1.action?.id).toBe('guardian_remind')
    expect(r1.budget.interactionsThisHour).toBe(1)
  })
})

describe('Phase B — stage 升级经 Director 表达', () => {
  it('stageGrowTo → stage_grow 意图（预算豁免，必达）', () => {
    const r = decided(input({
      situation: situation(14),
      flags: { ...input({}).flags, stageGrowTo: 'friend' as const }
    }))
    expect(r.action?.id).toBe('stage_grow')
    expect(r.action?.kind).toBe('ritual')
    expect(r.action?.message).toContain('朋友')
  })

  it('stage_grow 在 DND 中被 gate 拦截（等待解除）', () => {
    const meeting = input({
      situation: situation(14, { userState: 'meeting' }),
      flags: { ...input({}).flags, stageGrowTo: 'partner' as const }
    })
    const r = decide(meeting, () => 0)
    if (r.action) expect(r.action.id).not.toBe('stage_grow')
  })
})

describe('预算状态机', () => {
  it('maxForPersonality：低主动 2/h，高主动 5/h', () => {
    expect(maxForPersonality(0.2)).toBe(2)
    expect(maxForPersonality(0.8)).toBe(5)
  })

  it('rollover 每小时的窗口重置', () => {
    const b = createBudget(2, 1000)
    const spent = spendBudget(spendBudget(b, 1001), 1002)
    expect(spent.interactionsThisHour).toBe(2)
    const nextHour = rolloverBudget(spent, 1000 + 3600 * 1000)
    expect(nextHour.interactionsThisHour).toBe(0)
  })
})

describe('驱动冲动参与决策', () => {
  it('疲惫时的 sleepiness 冲动被 Gate 允许（动画级）', () => {
    const r = decided(input({
      situation: situation(23, { userState: 'away', idleMs: 300000 }),
      driveImpulse: { type: 'rest', reason: '太困了', intensity: 0.9 } as BehaviorImpulse
    }))
    expect(r.action?.id).toBe('nap')
    expect(r.action?.interruptLevel).toBe(0)
  })
})
