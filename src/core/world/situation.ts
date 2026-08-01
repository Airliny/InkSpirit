import type { ForegroundScene } from './scene'
import { toSituationPatterns, type SituationPatterns, type PatternContextLike } from './patterns'

export type HourContext = 'early' | 'day' | 'evening' | 'late_night' | 'dawn'

export type UserState =
  | 'away'
  | 'deep_work'
  | 'active_light'
  | 'playing'
  | 'meeting'
  | 'fatigued'
  | 'recovering'

/**
 * A snapshot of "what is the user's situation right now".
 * Pure synthesis from raw local signals — no AI, no content retained.
 *
 * Versioned: bump `version` when the shape changes so consumers (P3
 * BehaviorDirector, prompt) can migrate cleanly.
 */
export interface SituationSnapshot {
  version: 1
  timestamp: number
  scene: ForegroundScene
  /** 0-1 inferred fatigue */
  fatigue: number
  /** 0-1 focus depth */
  focusDepth: number
  userState: UserState
  hourContext: HourContext
  /** Current continuous active-work minutes */
  streakMin: number
  idleMs: number
  /** Short natural-language conclusion (null = nothing worth saying) */
  inferredNeed: string | null
  /** Compact daily-rhythm summary (null = no history yet) */
  patterns: SituationPatterns | null
}

export interface SituationInput {
  scene: ForegroundScene
  idleMs: number
  streakMin: number
  hour: number
  patternContext?: PatternContextLike | null
}

export const AWAY_THRESHOLD_MS = 120000
export const FATIGUE_THRESHOLD = 0.55
const DEEP_FOCUS_THRESHOLD = 0.5
const RECOVERING_STREAK_MIN = 120

export function getHourContext(hour: number): HourContext {
  if (hour >= 22 || hour < 4) return 'late_night'
  if (hour < 8) return 'dawn'
  if (hour < 11) return 'early'
  if (hour < 17) return 'day'
  return 'evening'
}

/**
 * Fatigue is the max of independent weighted signals (never summed),
 * so a single strong signal can't push it off-scale.
 */
export function computeFatigue(input: SituationInput): number {
  const { hour, streakMin, patternContext } = input
  const isLateNight = hour >= 22 || hour < 6

  let fatigue = 0
  if (isLateNight && streakMin > 0) fatigue = 0.6
  if (streakMin >= 120) fatigue = Math.max(fatigue, 0.4)
  if (streakMin >= 240) fatigue = Math.max(fatigue, 0.8)
  if (patternContext && patternContext.sleepLateHours >= 2) {
    fatigue = Math.max(fatigue, 0.3)
  }
  return fatigue
}

export function computeFocusDepth(input: SituationInput, fatigue: number): number {
  const sceneBoost = input.scene === 'code' || input.scene === 'work' ? 1.1 : 0.8
  const raw = Math.min(1, input.streakMin / 120)
  return Math.min(1, Math.max(0, raw * sceneBoost * (1 - fatigue * 0.4)))
}

export function inferUserState(input: SituationInput, fatigue: number, focusDepth: number): UserState {
  const { scene, idleMs, streakMin } = input

  if (scene === 'meeting') return 'meeting'
  if (scene === 'game') return 'playing'
  if (idleMs >= AWAY_THRESHOLD_MS) return 'away'
  if (fatigue >= FATIGUE_THRESHOLD) return 'fatigued'
  if (scene === 'video') {
    return streakMin >= RECOVERING_STREAK_MIN ? 'recovering' : 'playing'
  }
  if (scene === 'code' || scene === 'work') {
    if (focusDepth >= DEEP_FOCUS_THRESHOLD) return 'deep_work'
  }
  return 'active_light'
}

export function inferNeed(snapshot: Omit<SituationSnapshot, 'inferredNeed' | 'version' | 'timestamp' | 'patterns'>): string | null {
  const lateNight = snapshot.hourContext === 'late_night'
  switch (snapshot.userState) {
    case 'meeting':
      return '主人在会议中，保持安静'
    case 'playing':
      return '主人在娱乐，不要打扰'
    case 'away':
      return '主人暂时离开'
    case 'fatigued':
      return lateNight
        ? '主人可能比较疲劳，适合温柔的休息提醒'
        : '长时间连续工作，主人可能疲劳，适合轻轻提醒休息'
    case 'recovering':
      return '主人刚结束长时间工作，正在放松，安静陪伴就好'
    case 'deep_work':
      return '主人深度专注中，避免打扰'
    default:
      return null
  }
}

/** Pure synthesis: raw signals in, situation snapshot out. */
export function synthesizeSituation(input: SituationInput): SituationSnapshot {
  const fatigue = computeFatigue(input)
  const focusDepth = computeFocusDepth(input, fatigue)
  const hourContext = getHourContext(input.hour)
  const userState = inferUserState(input, fatigue, focusDepth)
  const base = {
    scene: input.scene,
    userState,
    fatigue,
    focusDepth,
    hourContext,
    streakMin: input.streakMin,
    idleMs: input.idleMs
  }
  return {
    version: 1,
    timestamp: Date.now(),
    ...base,
    inferredNeed: inferNeed(base),
    patterns: input.patternContext ? toSituationPatterns(input.patternContext) : null
  }
}

/**
 * One-line world awareness for the system prompt (<= ~60 tokens of Chinese).
 * Returns null when nothing worth telling the model.
 */
export function situationPromptLine(s: SituationSnapshot): string | null {
  if (!s.inferredNeed) return null

  const hour = new Date(s.timestamp).getHours()
  const label = hour < 6 ? '凌晨' : hour < 9 ? '清晨' : hour < 12 ? '上午' : hour < 14 ? '中午' : hour < 18 ? '下午' : hour < 22 ? '晚上' : '深夜'
  const display = hour === 0 || hour > 12 ? hour - (hour > 12 ? 12 : 0) : hour
  let line = `${label}${display}点`
  if (s.streakMin >= 90) {
    line += `，已连续工作约${Math.round(s.streakMin / 60)}小时`
  } else if (s.streakMin >= 45) {
    line += `，已连续工作${Math.round(s.streakMin)}分钟`
  }
  if (s.fatigue >= FATIGUE_THRESHOLD) {
    line += '，看起来比较累'
  }
  return `${line}。${s.inferredNeed}`
}
