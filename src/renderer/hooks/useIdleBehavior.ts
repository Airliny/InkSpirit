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

export function useIdleBehavior(
  energy: number = 0.8,
  attachment: number = 0.3
): AnimationState {
  const [state, setState] = useState<AnimationState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleMinutesRef = useRef(0)

  const scheduleNext = useCallback(() => {
    const behavior = selectIdleBehavior(energy, attachment, idleMinutesRef.current)
    const config = [
      { name: 'idle_stand', duration: 4000 },
      { name: 'idle_blink_only', duration: 2000 },
      { name: 'idle_walk', duration: 6000 },
      { name: 'idle_sit', duration: 8000 },
      { name: 'idle_sleep', duration: 15000 },
      { name: 'idle_stretch', duration: 6000 },
      { name: 'idle_yawn', duration: 5000 },
      { name: 'idle_watch_mouse', duration: 3000 },
      { name: 'idle_peer_window', duration: 4000 },
      { name: 'idle_climb_window', duration: 4000 },
      { name: 'idle_hide', duration: 4000 },
      { name: 'idle_look_for_user', duration: 5000 }
    ].find(b => b.name === behavior)
    const duration = config?.duration ?? 4000

    setState(BEHAVIOR_TO_STATE[behavior])

    timerRef.current = setTimeout(() => {
      idleMinutesRef.current += duration / 60000
      scheduleNext()
    }, duration)
  }, [energy, attachment])

  useEffect(() => {
    scheduleNext()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return state
}
