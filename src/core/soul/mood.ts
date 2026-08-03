import { getDatabase } from '../database'
import { computeMood, MOOD_WINDOW_MS, type MoodSample, type MoodState } from './moodModel'

/**
 * Mood（心境）层 —— 三层情绪的中间层：
 *
 *   Emotion     秒~分钟    此刻的情绪（已有，快照节流落盘）
 *   Mood        小时~天    今天的心境（本模块，由快照重载加权合成）
 *   Temperament 月~长期    气质/底色（已有，关系+人格）
 *
 * Mood 不落盘：从最近 24 小时的情绪快照重载加权合成——重启不丢、无新表、
 * 天然有衰减（旧情绪自动变淡）。
 *
 * 纯模型（类型 + computeMood + 身体调制等）在 moodModel.ts —— 渲染进程
 * 导入的是那个文件；本文件只有数据库访问（getCurrentMood）。
 */

export type { MoodLabel, MoodState, MoodSample } from './moodModel'
export { MOOD_WINDOW_MS, moodLabel, moodBodyModifiers, moodLine, computeMood } from './moodModel'

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
