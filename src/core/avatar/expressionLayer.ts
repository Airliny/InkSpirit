import type { BodyModifiers } from './types'
import { DEFAULT_BODY_MODIFIERS } from './types'

/**
 * Body Expression Layer —— 身体表达层。
 *
 * 动作之外，还有"气质"：连续的身体状态。
 * 同一个身体，被温柔对待久了（energy 高、动作轻快、视线主动）
 * 和长期孤单（安静、视线减少）是完全不同的两个砚灵。
 * 气质是乘性调制（scale），叠加在情绪驱动的 BodyState 基线上。
 */

export interface TemperamentInput {
  /** 关系向量：理解 0-1 */
  understanding: number
  /** 关系向量：依恋 0-1 */
  attachment: number
  /** 关系向量：信任 0-1 */
  trust: number
  /** 人格：温暖 0-1 */
  warmth: number
}

/** 长期关系与人格 → 身体气质（乘性系数，1 = 中性基线） */
export function computeTemperament(input: TemperamentInput): BodyModifiers {
  const affection = clamp01(
    0.35 * input.attachment + 0.3 * input.trust + 0.2 * input.understanding + 0.15 * input.warmth
  )
  return {
    energyScale: 0.75 + 0.45 * affection,
    movementScale: 0.8 + 0.35 * affection,
    breathScale: 0.9 + 0.2 * affection,
    swayScale: 0.85 + 0.3 * affection,
    lookScale: 0.6 + 0.55 * affection
  }
}

// ---------------------------------------------------------------------------

/** 世界模型精简信号（主进程 situation 快照 → 身体） */
export interface WorldBodySignals {
  /** 0-1 疲劳 */
  fatigue: number
  /** late_night/dawn/early/day/evening */
  hourContext: string
  /** 比平时晚睡（22-2 点活动超基线） */
  sleepLate: boolean
  /** 今天比平时忙（0 = 正常） */
  busyDeviation: number
  /** 今天比平时闲（0 = 正常） */
  quietDeviation: number
  /** 连续工作分钟数 */
  streakMin: number
  /** 用户是否在场（近期有活动）——存在感预算用 */
  userPresent?: boolean
}

/** 生活环境 → 身体：深夜/晚睡/连续工作 → 动作慢、呼吸缓、摆动小 */
export function worldBodyModifiers(s: WorldBodySignals): BodyModifiers {
  let energyScale = 1
  let movementScale = 1
  let breathScale = 1
  let swayScale = 1
  let lookScale = 1

  const late = s.hourContext === 'late_night' || s.hourContext === 'dawn'
  const tired = s.fatigue >= 0.55

  // 深夜 + 比平时晚睡：身体跟着主人的作息慢下来
  if (late) {
    movementScale *= 0.85
    breathScale *= 0.92
    swayScale *= 0.8
    lookScale *= 0.85
    if (s.sleepLate) {
      movementScale *= 0.92
      breathScale *= 0.95
      swayScale *= 0.85
    }
  }

  // 连续工作疲劳：能量下降，动作放缓
  if (tired || s.streakMin >= 90) {
    energyScale *= 0.75
    movementScale *= 0.85
    breathScale *= 0.9
    swayScale *= 0.8
  }

  // 异常忙碌的一天：稍微亢奋但有节制
  if (s.busyDeviation > 1.3) {
    energyScale *= 1.1
    movementScale *= 1.08
    lookScale *= 1.15
  }

  // 异常安静的一天：身体也安静
  if (s.quietDeviation > 1.3) {
    energyScale *= 0.9
    movementScale *= 0.9
    lookScale *= 0.85
  }

  return {
    energyScale,
    movementScale,
    breathScale,
    swayScale,
    lookScale
  }
}

// ---------------------------------------------------------------------------

/** 触摸语境：同一个动作，不同感觉 */
export type TouchContext = 'gentle' | 'lively' | 'neutral'

/**
 * 晚上疲惫时摸一下 → 安静回应；下午开心时摸一下 → 活跃回应。
 * 语境不是新的动作，只是同一个动作的不同"温度"。
 */
export function classifyTouchContext(s: WorldBodySignals, mood: string, activity: string): TouchContext {
  const late = s.hourContext === 'late_night' || s.hourContext === 'dawn'
  const tired = s.fatigue >= 0.55
  const sleepy = mood === 'sleepy'
  const inConversation = activity !== 'idle'
  const livelyMood = mood === 'happy' || mood === 'energetic'

  if (late || tired || sleepy) return 'gentle'
  if (!inConversation && livelyMood && !late && !tired) return 'lively'
  return 'neutral'
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** 合并多个调制层：默认 1（中性），缺层不参与 */
export function mergeModifiers(layers: Array<BodyModifiers | null | undefined>): BodyModifiers {
  const out = { ...DEFAULT_BODY_MODIFIERS }
  for (const layer of layers) {
    if (!layer) continue
    out.energyScale *= layer.energyScale
    out.movementScale *= layer.movementScale
    out.breathScale *= layer.breathScale
    out.swayScale *= layer.swayScale
    out.lookScale *= layer.lookScale
  }
  return out
}
