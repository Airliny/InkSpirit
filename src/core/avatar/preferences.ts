import type { BodyState } from './types'

/**
 * 身体偏好 —— 唯一需要持久化的身体数据。
 *
 * 边界：瞬时状态（视线/呼吸/摆动/注意力）永不落盘，那是"动作"不是"身体"。
 * 身体偏好（用户的选择）持久化到 config `body_preferences`。
 * Body Memory（触摸计数等）走独立 config 键，不进灵魂表。
 */

export interface BodyPreferences {
  /** 视线跟随开关（偶尔偷看） */
  lookFollow: boolean
  /** 重心摆动开关 */
  sway: boolean
  /** 触摸反馈开关（轻触/被抓反应） */
  touchFeel: boolean
}

export const DEFAULT_BODY_PREFERENCES: BodyPreferences = {
  lookFollow: true,
  sway: true,
  touchFeel: true
}

export function parseBodyPreferences(raw: string | null): BodyPreferences {
  if (!raw) return { ...DEFAULT_BODY_PREFERENCES }
  try {
    const parsed = JSON.parse(raw) as Partial<BodyPreferences>
    return {
      lookFollow: parsed.lookFollow ?? DEFAULT_BODY_PREFERENCES.lookFollow,
      sway: parsed.sway ?? DEFAULT_BODY_PREFERENCES.sway,
      touchFeel: parsed.touchFeel ?? DEFAULT_BODY_PREFERENCES.touchFeel
    }
  } catch {
    return { ...DEFAULT_BODY_PREFERENCES }
  }
}

export function serializeBodyPreferences(prefs: BodyPreferences): string {
  return JSON.stringify(prefs)
}

/** 偏好 → 身体参数：关掉视线/摆动时，对应参数归零 */
export function applyBodyPreferences(bodyState: BodyState, prefs: BodyPreferences): BodyState {
  return {
    ...bodyState,
    lookX: prefs.lookFollow ? bodyState.lookX : 0,
    lookY: prefs.lookFollow ? bodyState.lookY : 0,
    lookFrequency: prefs.lookFollow ? bodyState.lookFrequency : 0,
    sway: prefs.sway ? bodyState.sway : 0
  }
}
