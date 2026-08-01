import { useState, useEffect, useRef, useCallback } from 'react'
import { selectIdleBehavior, type IdleBehavior } from '../components/avatar/behaviors'
import type { AnimationState } from '../components/avatar/modelTypes'

const BEHAVIOR_TO_STATE: Record<IdleBehavior, AnimationState> = {
  idle_stand: 'idle',
  idle_walk: 'walk',
  idle_sit: 'sit',
  idle_sleep: 'sleep',
  idle_stretch: 'stretch',
  idle_watch_mouse: 'idle',
  idle_peer_window: 'idle',
  idle_climb_window: 'idle',
  idle_hide: 'idle',
  idle_look_for_user: 'idle',
  idle_yawn: 'yawn',
  idle_blink_only: 'blink'
}

const BEHAVIOR_DURATIONS: Record<IdleBehavior, number> = {
  idle_stand: 4000,
  idle_blink_only: 2000,
  idle_walk: 6000,
  idle_sit: 8000,
  idle_sleep: 15000,
  idle_stretch: 6000,
  idle_yawn: 5000,
  idle_watch_mouse: 3000,
  idle_peer_window: 4000,
  idle_climb_window: 4000,
  idle_hide: 4000,
  idle_look_for_user: 5000
}

export function useIdleBehavior(
  energy: number = 0.8,
  attachment: number = 0.3
): AnimationState {
  const [state, setState] = useState<AnimationState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleMinutesRef = useRef(0)
  const paramsRef = useRef({ energy, attachment })
  const lastParamsRef = useRef({ energy, attachment })

  paramsRef.current = { energy, attachment }

  const scheduleNext = useCallback(() => {
    const { energy: e, attachment: a } = paramsRef.current
    const behavior = selectIdleBehavior(e, a, idleMinutesRef.current)
    const duration = BEHAVIOR_DURATIONS[behavior]

    setState(BEHAVIOR_TO_STATE[behavior])

    timerRef.current = setTimeout(() => {
      idleMinutesRef.current += duration / 60000
      scheduleNext()
    }, duration)
  }, [])

  // Start the cycle once on mount
  useEffect(() => {
    scheduleNext()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleNext])

  // Restart the cycle only when the soul state changed meaningfully,
  // so tiny energy fluctuations (mood sync) don't reset idle behaviors
  useEffect(() => {
    const last = lastParamsRef.current
    const shift = Math.abs(energy - last.energy) + Math.abs(attachment - last.attachment)
    lastParamsRef.current = { energy, attachment }
    if (shift < 0.05) return
    if (timerRef.current) clearTimeout(timerRef.current)
    idleMinutesRef.current = 0
    scheduleNext()
  }, [energy, attachment, scheduleNext])

  return state
}
