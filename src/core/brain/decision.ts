import { getRelationship, recordInteraction } from '../soul/relationship'
import { getCurrentEmotion, applyEmotionDecay } from '../soul/emotion'
import { getActivePersonality } from '../soul/personality'

export interface DecisionContext {
  userIdleMinutes: number
  totalWorkMinutes: number
  isFullscreen: boolean
  isOffHours: boolean
  timeSinceLastInteraction: number
}

export interface ProactiveDecision {
  shouldAct: boolean
  action: 'idle' | 'greet' | 'remind_rest' | 'show_concern' | 'casual_presence'
  message?: string
  reason: string
}

export function shouldProactiveAct(ctx: DecisionContext): ProactiveDecision {
  if (ctx.isFullscreen) {
    return { shouldAct: false, action: 'idle', reason: '用户在全屏模式' }
  }

  const relation = getRelationship()
  if (relation.stage === 'stranger' && ctx.timeSinceLastInteraction < 30) {
    return { shouldAct: false, action: 'idle', reason: '刚认识，不要过于主动' }
  }

  const emotion = getCurrentEmotion()
  if (emotion.energy < 0.15) {
    return { shouldAct: false, action: 'idle', reason: '能量不足' }
  }

  if (ctx.totalWorkMinutes > 240 && ctx.userIdleMinutes > 2) {
    const personality = getActivePersonality()
    const proactiveLevel = personality.traits.proactiveness
    if (proactiveLevel > 0.5) {
      return {
        shouldAct: true,
        action: 'remind_rest',
        message: '今天已经工作很久了，休息一下吧。',
        reason: `连续工作${Math.floor(ctx.totalWorkMinutes / 60)}小时`
      }
    }
  }

  if (ctx.timeSinceLastInteraction > 120 && ctx.userIdleMinutes > 5) {
    return {
      shouldAct: true,
      action: 'casual_presence',
      message: '我在呢~',
      reason: '用户很久没互动了'
    }
  }

  if (ctx.isOffHours && ctx.userIdleMinutes > 1) {
    const personality = getActivePersonality()
    if (personality.traits.gentleness > 0.6) {
      return {
        shouldAct: true,
        action: 'show_concern',
        message: '很晚了，记得早点休息。',
        reason: '深夜提醒'
      }
    }
  }

  return { shouldAct: false, action: 'idle', reason: '不是合适的时机' }
}

export function generateProactiveMessage(
  action: ProactiveDecision['action']
): string {
  const relation = getRelationship()
  const emotion = getCurrentEmotion()
  const personality = getActivePersonality()

  const messages: Record<string, string[]> = {
    remind_rest: [
      '你已经工作很久了，要不要休息一下？',
      '起来走走，喝杯水吧。',
      '我可以等你回来。'
    ],
    show_concern: [
      '很晚了，早点休息吧。',
      '还在忙吗？注意身体。'
    ],
    casual_presence: [
      '我在哦。',
      '嗯~',
      '（悄悄看了你一眼）'
    ],
    greet: [
      '今天过得怎么样？',
      '你回来啦。'
    ]
  }

  const pool = messages[action] ?? messages.casual_presence
  return pool[Math.floor(Math.random() * pool.length)]
}
