/**
 * Guardian core — pure health-warning detection.
 * The Guardian is a SYSTEM signal (like a phone's low-battery warning), not a
 * personality behavior: it only produces a GuardianSignal. Whether (and how)
 * the pet expresses it is decided by the BehaviorDirector.
 */

export type GuardianReason = 'continuous_work' | 'late_night'

export interface GuardianSignal {
  type: 'guardian_warning'
  priority: 'high'
  reason: GuardianReason
  streakMin: number
  lateNight: boolean
}

export interface GuardianSettings {
  enabled: boolean
  workThresholdMin: number
  cooldownMin: number
}

export interface GuardianState {
  wasIdle: boolean
  workStreakStart: number
  lastReminderAt: number
}

export function createGuardianState(): GuardianState {
  return { wasIdle: true, workStreakStart: 0, lastReminderAt: 0 }
}

export const IDLE_THRESHOLD_SEC = 45

/**
 * Advance the guardian by one poll. Returns the state to store back plus an
 * optional signal. Pure: no electron, no IO — fully testable.
 */
export function checkGuardian(
  state: GuardianState,
  input: {
    idleSec: number
    disturbBlocked: boolean
    settings: GuardianSettings
    now?: number
  }
): { state: GuardianState; signal: GuardianSignal | null } {
  const now = input.now ?? Date.now()
  const settings = input.settings
  const isIdle = input.idleSec >= IDLE_THRESHOLD_SEC

  if (!settings.enabled) {
    return { state: { ...createGuardianState(), lastReminderAt: state.lastReminderAt }, signal: null }
  }

  // User is away: hold nothing, no warning
  if (isIdle) {
    return { state: { ...state, wasIdle: true, workStreakStart: 0 }, signal: null }
  }

  // DND (meeting/game/video): keep tracking the streak, never warn
  if (input.disturbBlocked) {
    return {
      state: { ...state, wasIdle: state.wasIdle ? false : state.wasIdle, workStreakStart: state.wasIdle ? now : state.workStreakStart },
      signal: null
    }
  }

  // Start a fresh streak when the user becomes active again
  let next = { ...state }
  if (state.wasIdle) {
    next = { ...next, wasIdle: false, workStreakStart: now }
  }

  const streakMin = (now - next.workStreakStart) / 60000
  const sinceLastMin = (now - next.lastReminderAt) / 60000

  if (streakMin < settings.workThresholdMin || sinceLastMin < settings.cooldownMin) {
    return { state: next, signal: null }
  }

  const hour = new Date(now).getHours()
  const lateNight = hour >= 22 || hour < 6
  const signal: GuardianSignal = {
    type: 'guardian_warning',
    priority: 'high',
    reason: lateNight ? 'late_night' : 'continuous_work',
    streakMin: Math.round(streakMin),
    lateNight
  }
  return {
    state: { ...next, lastReminderAt: now },
    signal
  }
}
