import { getDatabase } from '../database'
import type { BodyModifiers } from '../avatar/types'

/**
 * Mood（心境）层 —— 三层情绪的中间层：
 *
 *   Emotion     秒~分钟    此刻的情绪（已有，快照节流落盘）
 *   Mood        小时~天    今天的心境（本模块，由快照重载加权合成）
 *   Temperament 月~长期    气质/底色（已有，关系+人格）
 *
 * Mood 不落盘：从最近 24 小时的情绪快照重载加权合成——重启不丢、无新表、
 * 天然有衰减（旧情绪自动变淡）。
 */

export type MoodLabel = 'energetic' | 'content' | 'blue' | 'low' | 'neutral'

export interface MoodState {
  /** -1..1 愉快程度（今天整体） */
  valence: number
  /** 0..1 活跃程度（今天整体） */
  arousal: number
  label: MoodLabel
}

/** 情绪快照样例（computeMood 的输入） */
export interface MoodSample {
  valence: number
  arousal: number
  timestamp: number
}

export const MOOD_WINDOW_MS = 24 * 60 * 60 * 1000
/** 情绪在心境中的"半衰期"——6 小时前的影响只剩一半 */
const MOOD_HALF_LIFE_MS = 6 * 60 * 60 * 1000

export function computeMood(samples: MoodSample[], now: number): MoodState {
  const cutoff = now - MOOD_WINDOW_MS
  let wSum = 0
  let vSum = 0
  let aSum = 0
  for (const s of samples) {
    if (s.timestamp < cutoff) continue
    const w = Math.exp(-(now - s.timestamp) / MOOD_HALF_LIFE_MS)
    wSum += w
    vSum += w * clamp(s.valence, -1, 1)
    aSum += w * clamp(s.arousal, 0, 1)
  }
  if (wSum <= 0) return { valence: 0, arousal: 0.5, label: 'neutral' }
  const valence = vSum / wSum
  const arousal = aSum / wSum
  return { valence, arousal, label: moodLabel(valence, arousal) }
}

export function moodLabel(valence: number, arousal: number): MoodLabel {
  if (valence > 0.2 && arousal > 0.5) return 'energetic'
  if (valence > 0.15) return 'content'
  if (valence < -0.15 && arousal < 0.45) return 'blue'
  if (valence < -0.1) return 'low'
  return 'neutral'
}

/** 心境 → 身体调制（今天是低沉的一天，身体自然安静） */
export function moodBodyModifiers(mood: MoodState): BodyModifiers {
  switch (mood.label) {
    case 'energetic':
      return { energyScale: 1.1, movementScale: 1.08, breathScale: 1.02, swayScale: 1.08, lookScale: 1.1 }
    case 'content':
      return { energyScale: 1.05, movementScale: 1.02, breathScale: 1.01, swayScale: 1.05, lookScale: 1.08 }
    case 'blue':
      return { energyScale: 0.85, movementScale: 0.9, breathScale: 0.95, swayScale: 0.9, lookScale: 0.8 }
    case 'low':
      return { energyScale: 0.8, movementScale: 0.85, breathScale: 0.92, swayScale: 0.8, lookScale: 0.7 }
    default:
      return { energyScale: 1, movementScale: 1, breathScale: 1, swayScale: 1, lookScale: 1 }
  }
}

/** 心境 → 一句话（进提示词，让砚灵知道自己今天的心情） */
export function moodLine(mood: MoodState): string | null {
  switch (mood.label) {
    case 'energetic': return '今天心情很好，精力充沛'
    case 'content': return '今天心情不错，很满足'
    case 'blue': return '今天有点低沉'
    case 'low': return '今天情绪不高'
    default: return null
  }
}

/** 主进程用：从最近 24h 情绪快照合成当前心境（无快照 → 中性） */
export function getCurrentMood(now = Date.now()): MoodState {
  try {
    const db = getDatabase()
    const rows = db.prepare(
      'SELECT state_json, timestamp FROM emotion_snapshots WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 400'
    ).all(now - MOOD_WINDOW_MS) as { state_json: string; timestamp: number }[]
    const samples: MoodSample[] = []
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.state_json) as { valence?: number; arousal?: number }
        if (typeof parsed.valence === 'number') {
          samples.push({ valence: parsed.valence, arousal: parsed.arousal ?? 0.5, timestamp: row.timestamp })
        }
      } catch { /* skip bad snapshot */ }
    }
    return computeMood(samples, now)
  } catch {
    return { valence: 0, arousal: 0.5, label: 'neutral' }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}
