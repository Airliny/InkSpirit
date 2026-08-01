import type { BehaviorIntent, BehaviorKind, InterruptLevel } from './behaviorTypes'
import type { DirectorInput } from './behaviorTypes'
import type { SituationSnapshot } from '../world/situation'
import type { RelationshipState } from '../soul/relationshipEvents'
import type { EmotionState } from '../soul/emotion'
import type { BehaviorImpulse } from './drives'

/**
 * Layer 2: situation → candidate intents ("what is happening now").
 * All functions pure — messages are chosen deterministically per context.
 */

export function intent(
  id: string,
  kind: BehaviorKind,
  interruptLevel: InterruptLevel,
  baseWeight: number,
  extra: Partial<BehaviorIntent> = {}
): BehaviorIntent {
  return { id, kind, interruptLevel, baseWeight, ...extra }
}

// ---- Situation intents ----

export function situationIntents(input: DirectorInput): BehaviorIntent[] {
  const s = input.situation
  if (!s) return []

  const out: BehaviorIntent[] = []

  // Late-night fatigue: gentle rest support (never random chat)
  if (s.userState === 'fatigued' && s.hourContext === 'late_night') {
    out.push(intent('rest_support', 'care', 3, 0.9, {
      message: restSupportMessage(input.personality, 'late_night'),
      behavior: 'sit'
    }))
  } else if (s.userState === 'fatigued') {
    out.push(intent('rest_remind', 'care', 3, 0.7, {
      message: restSupportMessage(input.personality, 'day', Math.round(s.streakMin / 60)),
      behavior: 'look_around'
    }))
  }

  // Deep work: rare, quiet long-streak nudge
  if (s.userState === 'deep_work' && s.streakMin >= 90) {
    out.push(intent('long_work_nudge', 'care', 2, 0.35, {
      message: `你已经连续工作约 ${Math.round(s.streakMin / 60)} 小时了，喝口水吧。`
    }))
  }

  // Recovering: silent company, thoughts only
  if (s.userState === 'recovering') {
    out.push(intent('quiet_company', 'watch', 1, 0.8, {
      thought: '（安静陪着你）',
      behavior: 'sit'
    }))
  }

  // User just came back: relationship decides the tone of the welcome
  if (input.flags.returnedAfterMs > 30 * 60 * 1000) {
    out.push(intent('welcome_home', 'social', 2, 1.0, {
      message: welcomeMessage(input.relationship, s),
      budgetExempt: true
    }))
  } else if (input.flags.returnedAfterMs > 60 * 1000) {
    out.push(intent('welcome_back', 'social', 2, 0.5, {
      message: '（看到你回来，轻轻抬起头）'
    }))
  }

  return out
}

// ---- Ritual intents (once per day) ----

export function ritualIntents(input: DirectorInput, hour: number): BehaviorIntent[] {
  const out: BehaviorIntent[] = []
  const p = input.personality
  const tone = p.humor > 0.6 ? 'playful' : p.gentleness > 0.6 ? 'gentle' : 'direct'

  if (hour >= 7 && hour <= 10 && !input.flags.greetingDoneToday) {
    const pool = {
      playful: ['早呀！新的一天，一起加油！', '（伸个懒腰）早~今天想做点什么？'],
      gentle: ['早。今天也要照顾好自己。', '早上好，新的一天。'],
      direct: ['早上好。今天打算做什么？']
    }
    out.push(intent('morning_greeting', 'ritual', 2, 0.9, {
      message: pool[tone][0],
      budgetExempt: true
    }))
  }

  if (hour >= 22 && hour < 24 && !input.flags.nightDoneToday) {
    const happy = input.emotion.happiness > 0.5
    out.push(intent('good_night', 'ritual', 2, 0.9, {
      message: happy ? '晚安，明天见。今天很开心。' : '晚安…我守着你。',
      budgetExempt: true
    }))
  }

  return out
}

// ---- Memory recollection ----

export function recollectIntent(input: DirectorInput): BehaviorIntent[] {
  if (!input.flags.recallableMemory || !input.flags.recollectSnippet) return []
  const snippet = input.flags.recollectSnippet
  return [
    intent('recollect', 'recollect', 2, 0.5, {
      message: `（忽然想起）你之前说「${snippet}」…`,
      budgetExempt: false
    })
  ]
}

// ---- Casual social reach-out ----

export function socialIntent(input: DirectorInput): BehaviorIntent[] {
  const s = input.situation
  if (!s || s.userState === 'active_light' === false) return []
  return [
    intent('casual_greet', 'social', 2, 0.25, {
      message: greetMessage(input.personality, input.emotion)
    })
  ]
}

// ---- Guardian health warning (system signal → director intent) ----

export function guardianIntent(input: DirectorInput): BehaviorIntent[] {
  const signal = input.flags.guardianSignal
  if (!signal) return []
  return [
    intent('guardian_remind', 'care', 2, 0.9, {
      message: guardianMessage(signal, input.personality),
      behavior: 'look_around'
    })
  ]
}

function guardianMessage(signal: NonNullable<DirectorInput['flags']['guardianSignal']>, p: DirectorInput['personality']): string {
  const streak = signal.streakMin
  const tone = p.humor > 0.6 ? 'playful' : p.gentleness > 0.6 ? 'gentle' : 'direct'
  if (signal.lateNight) {
    if (tone === 'playful') return '夜猫子…这么晚还在忙，该睡啦！'
    if (tone === 'gentle') return '已经很晚了，我有点担心你。'
    return '很晚了，建议早点休息。'
  }
  if (streak > 120) {
    if (tone === 'playful') return `都连续忙 ${streak} 分钟了，站起来转一圈嘛！`
    if (tone === 'gentle') return `你已经连续工作 ${streak} 分钟了，起来活动一下吧。`
    return `连续工作 ${streak} 分钟了，建议休息片刻。`
  }
  if (tone === 'playful') return `哇，都忙 ${streak} 分钟了，要不要摸个鱼？`
  if (tone === 'gentle') return `忙了这么久，要不要休息一下？`
  return `已连续工作 ${streak} 分钟，休息一下。`
}

// ---- Relationship stage growth (stage change → director intent) ----

const STAGE_UP_MESSAGES: Record<string, string> = {
  acquaintance: '（忽然）我们好像…越来越熟了。',
  friend: '你在我心里，已经是朋友了。',
  close_friend: '总觉得，和你待着就很安心。',
  partner: '……有你陪着，真好。'
}

export function stageGrowIntent(input: DirectorInput): BehaviorIntent[] {
  const stage = input.flags.stageGrowTo
  if (!stage) return []
  const message = STAGE_UP_MESSAGES[stage]
  if (!message) return []
  return [
    intent('stage_grow', 'ritual', 2, 1.0, {
      message,
      budgetExempt: true // milestones are rare and important — always expressed
    })
  ]
}

// ---- Hang on the foreground window ----

export function hangIntent(input: DirectorInput): BehaviorIntent[] {
  if (!input.flags.canHang) return []
  return [
    intent('hang_window', 'hang', 1, 0.3, {
      thought: '（爬上窗口边，扒着看了看）',
      behavior: 'sit'
    })
  ]
}

// ---- Drive impulses → quiet intents ----

export function driveIntent(impulse: BehaviorImpulse, emotion: EmotionState): BehaviorIntent[] {
  switch (impulse.type) {
    case 'move':
      return [intent('walk_about', 'move', 0, impulse.intensity, {
        behavior: impulse.intensity > 0.7 ? 'walk' : 'stretch'
      })]
    case 'rest':
      return [intent('nap', 'rest', 0, impulse.intensity, {
        behavior: impulse.intensity > 0.8 ? 'sleep' : 'sit'
      })]
    case 'explore':
      return [intent('look_around', 'explore', 1, 0.6, {
        behavior: 'look_around',
        thought: '（好奇地看了看四周）'
      })]
    case 'play':
      return [intent('play', 'play', 0, impulse.energy ?? 0.4, {
        behavior: 'walk',
        expression: emotion.happiness > 0.7 ? 'happy' : undefined
      })]
    case 'self_soothe':
      return [intent('self_soothe', 'watch', 1, 0.5, {
        thought: impulse.reason,
        behavior: 'sit'
      })]
    case 'socialize':
      // The drive wants company — becomes a weighted social intent
      return [intent('drive_social', 'social', 2, impulse.urgency * 0.6, {
        message: '想你了。'
      })]
    case 'think':
      return impulse.thought ? [intent('inner_thought', 'watch', 1, 0.4, { thought: impulse.thought })] : []
    case 'none':
      return []
  }
}

// ---- Relationship-aware messages ----

/**
 * Welcome tone scales with the relationship vector.
 * High understanding + unusual rhythm → context-aware welcome (the "lives
 * together" feel), stranger → plain, polite.
 */
export function welcomeMessage(rel: RelationshipState, s: SituationSnapshot | null): string {
  if (rel.understanding >= 0.5 && s?.patterns && (s.patterns.sleepLate || s.patterns.unusualSchedule)) {
    return '今天回来比平时晚，是不是忙到现在？'
  }
  if (rel.intimacy >= 0.5) return '你终于回来啦…（轻轻靠过来）'
  if (rel.familiarity >= 0.4) return '你回来啦！好久不见，想我了吗？'
  return '欢迎回来。'
}

function greetMessage(p: DirectorInput['personality'], emotion: EmotionState): string {
  if (p.humor > 0.6) return '在忙什么呢？我都要长蘑菇了。'
  if (p.gentleness > 0.6) return '（悄悄看了你一眼）感觉好久没聊天了。'
  if (emotion.happiness > 0.7) return '嘿嘿，今天心情不错的样子！'
  return '嗯…没事，就想看看你在不在。'
}

function restSupportMessage(
  p: DirectorInput['personality'],
  when: 'late_night' | 'day',
  hours?: number
): string {
  const playful = {
    late_night: '夜猫子…这么晚还在忙，月亮都困了！',
    day: hours && hours >= 2 ? `都连续忙 ${hours} 小时了，站起来转一圈嘛！` : '连续忙了这么久，摸个鱼也好呀。'
  }
  const gentle = {
    late_night: '已经很晚了，我有点担心你。',
    day: hours && hours >= 2 ? `你已经连续工作 ${hours} 小时了，起来活动一下吧。` : '要不要起来走一走？喝口水也好。'
  }
  const direct = {
    late_night: '很晚了，建议早点休息。',
    day: hours && hours >= 2 ? `连续工作 ${hours} 小时，建议休息片刻。` : '已连续工作较久，建议起身活动。'
  }
  const tone = p.humor > 0.6 ? playful : p.gentleness > 0.6 ? gentle : direct
  return tone[when]
}
