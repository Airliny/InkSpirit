import { getCurrentEmotion, applyEmotionDecay, type EmotionState } from '../soul/emotion'
import { getRelationship } from '../soul/relationship'

export interface Drives {
  restlessness: number
  sleepiness: number
  curiosity: number
  social: number
  comfort: number
  playfulness: number
}

export const DEFAULT_DRIVES: Drives = {
  restlessness: 0.2,
  sleepiness: 0.1,
  curiosity: 0.4,
  social: 0.2,
  comfort: 0.15,
  playfulness: 0.3
}

export type BehaviorImpulse =
  | { type: 'none' }
  | { type: 'move'; reason: string; intensity: number }
  | { type: 'rest'; reason: string }
  | { type: 'explore'; reason: string }
  | { type: 'socialize'; reason: string; urgency: number }
  | { type: 'self_soothe'; reason: string }
  | { type: 'play'; reason: string; energy: number }
  | { type: 'think'; thought: string }

export interface PetState {
  drives: Drives
  impulse: BehaviorImpulse
  innerThought: string | null
  lastImpulseTime: number
}

let petState: PetState = {
  drives: { ...DEFAULT_DRIVES },
  impulse: { type: 'none' },
  innerThought: null,
  lastImpulseTime: Date.now()
}

export function getPetState(): PetState {
  return petState
}

/**
 * Advances the pet's internal state by one tick.
 * Drives build up naturally, then the strongest one triggers an impulse.
 */
export function tick(elapsedSeconds: number, userIdleMs: number = 0): BehaviorImpulse {
  const emotion = getCurrentEmotion()
  const rel = getRelationship()
  const hour = new Date().getHours()

  // --- Update drives based on time, emotion, and environment ---
  const d = petState.drives

  // Restlessness: builds with time + energy, releases with movement
  const restlessnessRate = 0.02 + emotion.energy * 0.04 + (userIdleMs > 60000 ? 0.03 : 0)
  d.restlessness = Math.min(1, d.restlessness + restlessnessRate * elapsedSeconds / 60)

  // Sleepiness: builds at night, when energy is low
  const isNight = hour >= 22 || hour <= 5
  const sleepinessRate = 0.01 + (isNight ? 0.06 : 0) + ((1 - emotion.energy) * 0.05)
  d.sleepiness = Math.min(1, d.sleepiness + sleepinessRate * elapsedSeconds / 60)

  // Curiosity: builds when user is active, when pet is curious
  const curiosityRate = 0.015 + emotion.curiosity * 0.04 + (userIdleMs < 30000 ? 0.03 : -0.01)
  d.curiosity = Math.max(0, Math.min(1, d.curiosity + curiosityRate * elapsedSeconds / 60))

  // Social: builds with attachment, when user is idle
  const socialRate = 0.01 + rel.affection * 0.05 + (userIdleMs > 60000 ? 0.02 : -0.02)
  d.social = Math.max(0, Math.min(1, d.social + socialRate * elapsedSeconds / 60))

  // Comfort: builds when sad/anxious/hurt
  const comfortRate = 0.005 + emotion.sadness * 0.06 + emotion.anxiety * 0.05 + emotion.grudge * 0.02
  d.comfort = Math.max(0, Math.min(1, d.comfort + comfortRate * elapsedSeconds / 60))

  // Playfulness: builds with happiness + energy
  const playRate = 0.01 + emotion.happiness * 0.04 + emotion.energy * 0.03
  d.playfulness = Math.max(0, Math.min(1, d.playfulness + playRate * elapsedSeconds / 60))

  // --- Find the strongest urge ---
  const urges: [keyof Drives, number][] = [
    ['restlessness', d.restlessness],
    ['sleepiness', d.sleepiness],
    ['curiosity', d.curiosity],
    ['social', d.social],
    ['comfort', d.comfort],
    ['playfulness', d.playfulness]
  ]
  urges.sort((a, b) => b[1] - a[1])

  const threshold = 0.55 + Math.random() * 0.3 // variable threshold adds unpredictability
  const strongest = urges[0]

  if (strongest[1] < threshold) {
    petState.impulse = { type: 'none' }
    return petState.impulse
  }

  // --- Generate impulse from strongest drive ---
  let impulse: BehaviorImpulse
  const drive = strongest[0]
  const intensity = strongest[1]

  switch (drive) {
    case 'restlessness':
      impulse = {
        type: 'move',
        reason: intensity > 0.8 ? '坐不住了' : intensity > 0.65 ? '想动一动' : '换个地方',
        intensity
      }
      d.restlessness = Math.max(0, d.restlessness - intensity * 0.6)
      break

    case 'sleepiness':
      impulse = {
        type: 'rest',
        reason: intensity > 0.8 ? '太困了' : intensity > 0.65 ? '有点累' : '眯一会儿'
      }
      d.sleepiness = Math.max(0, d.sleepiness - intensity * 0.7)
      break

    case 'curiosity':
      impulse = {
        type: 'explore',
        reason: intensity > 0.8 ? '很好奇' : '看看周围'
      }
      d.curiosity = Math.max(0, d.curiosity - intensity * 0.5)
      break

    case 'social':
      {
        const isUrgent = intensity > 0.8
        impulse = {
          type: 'socialize',
          reason: isUrgent ? '想你了' : emotion.sadness > 0.4 ? '有点孤单' : '想打个招呼',
          urgency: intensity
        }
        d.social = Math.max(0, d.social - intensity * (isUrgent ? 0.8 : 0.5))
      }
      break

    case 'comfort':
      impulse = {
        type: 'self_soothe',
        reason: emotion.dominantEmotion === 'anxious' ? '不安' : emotion.dominantEmotion === 'sad' ? '难过' : '需要安慰'
      }
      d.comfort = Math.max(0, d.comfort - intensity * 0.5)
      break

    case 'playfulness':
      impulse = {
        type: 'play',
        reason: intensity > 0.8 ? '好开心！' : '想玩',
        energy: emotion.energy
      }
      d.playfulness = Math.max(0, d.playfulness - intensity * 0.5)
      break

    default:
      impulse = { type: 'none' }
  }

  petState.impulse = impulse
  petState.lastImpulseTime = Date.now()

  // Generate an inner thought occasionally
  if (Math.random() < 0.15) {
    petState.innerThought = generateInnerThought(emotion, impulse)
  }

  return impulse
}

function generateInnerThought(emotion: EmotionState, impulse: BehaviorImpulse): string | null {
  const thoughts: Record<string, string[]> = {
    happy: ['今天心情不错', '（轻轻哼着歌）', '主人在真好'],
    sad: ['有点想哭', '（鼻子发酸）', '好想被抱一下'],
    hurt: ['为什么要这样对我...', '（不想说话）', '好难过'],
    anxious: ['不会有事吧...', '（不安地搓手）', '有点害怕'],
    excited: ['好开心好开心！', '（蹦蹦跳跳）', '今天太棒了'],
    curious: ['那是什么？', '主人在做什么呢', '想凑近看看'],
    lonely: ['好安静...', '什么时候回来呢', '（望向门口）'],
    tired: ['好困...', '（打了个哈欠）', '想睡觉了'],
    jealous: ['哼...', '（撇嘴）', '明明我也可以'],
    proud: ['嘿嘿', '（挺起胸）', '我做到了'],
    shy: ['（脸红了）', '被看着有点不好意思', ''],
    thoughtful: ['在想事情...', '嗯...', '有意思'],
    neutral: ['今天天气真好', '嗯', '（发呆）']
  }

  const pool = thoughts[emotion.dominantEmotion] ?? thoughts.neutral
  const filtered = pool.filter(t => t.length > 0)
  if (filtered.length === 0) return null
  return filtered[Math.floor(Math.random() * filtered.length)]
}

export function resetDrives(): void {
  petState = {
    drives: { ...DEFAULT_DRIVES },
    impulse: { type: 'none' },
    innerThought: null,
    lastImpulseTime: Date.now()
  }
}
