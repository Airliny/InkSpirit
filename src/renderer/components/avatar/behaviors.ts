export type IdleBehavior =
  | 'idle_stand'
  | 'idle_walk'
  | 'idle_sit'
  | 'idle_sleep'
  | 'idle_stretch'
  | 'idle_watch_mouse'
  | 'idle_peer_window'
  | 'idle_climb_window'
  | 'idle_hide'
  | 'idle_look_for_user'
  | 'idle_yawn'
  | 'idle_blink_only'

interface BehaviorConfig {
  name: IdleBehavior
  duration: number
  weight: number
  conditions?: {
    minEnergy?: number
    maxEnergy?: number
    minAttachment?: number
    maxAttachment?: number
    minIdleMinutes?: number
    maxIdleMinutes?: number
  }
}

export const IDLE_BEHAVIORS: BehaviorConfig[] = [
  { name: 'idle_stand', duration: 4000, weight: 10 },
  { name: 'idle_blink_only', duration: 2000, weight: 15 },
  { name: 'idle_stretch', duration: 6000, weight: 8, conditions: { minIdleMinutes: 5 } },
  { name: 'idle_yawn', duration: 5000, weight: 6, conditions: { maxEnergy: 0.5 } },
  { name: 'idle_watch_mouse', duration: 3000, weight: 7 },
  { name: 'idle_sit', duration: 8000, weight: 5, conditions: { minIdleMinutes: 10 } },
  { name: 'idle_sleep', duration: 15000, weight: 3, conditions: { maxEnergy: 0.3, minIdleMinutes: 15 } },
  { name: 'idle_peer_window', duration: 4000, weight: 4, conditions: { minAttachment: 0.3 } },
  { name: 'idle_look_for_user', duration: 5000, weight: 3, conditions: { minIdleMinutes: 20, minAttachment: 0.4 } },
  { name: 'idle_walk', duration: 6000, weight: 6 },
]

export function selectIdleBehavior(
  energy: number,
  attachment: number,
  idleMinutes: number
): IdleBehavior {
  const weighted = IDLE_BEHAVIORS.filter((b) => {
    if (b.conditions?.minEnergy !== undefined && energy < b.conditions.minEnergy) return false
    if (b.conditions?.maxEnergy !== undefined && energy > b.conditions.maxEnergy) return false
    if (b.conditions?.minAttachment !== undefined && attachment < b.conditions.minAttachment) return false
    if (b.conditions?.maxAttachment !== undefined && attachment > b.conditions.maxAttachment) return false
    if (b.conditions?.minIdleMinutes !== undefined && idleMinutes < b.conditions.minIdleMinutes) return false
    if (b.conditions?.maxIdleMinutes !== undefined && idleMinutes > b.conditions.maxIdleMinutes) return false
    return true
  })

  if (weighted.length === 0) return 'idle_stand'

  const totalWeight = weighted.reduce((sum, b) => sum + b.weight, 0)
  let rand = Math.random() * totalWeight
  for (const b of weighted) {
    rand -= b.weight
    if (rand <= 0) return b.name
  }
  return weighted[weighted.length - 1].name
}
