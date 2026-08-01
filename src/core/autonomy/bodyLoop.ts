/**
 * Avatar Life Loop — body-level animation selection.
 * Boundary rule: outputs here are NOT perceived as decisions (breathing,
 * blinking, posture). Anything the user perceives as an active choice
 * (speech, approach, seeking the owner) belongs to the BehaviorDirector.
 * This module never produces speech or expressions.
 */

/** Animations allowed in the body loop — all renderer-native, non-verbal */
export const BODY_LOOP_ANIMATIONS = [
  'blink', 'look_around', 'idle', 'stretch', 'sit', 'yawn', 'walk', 'sleep'
] as const

export type BodyLoopAnimation = (typeof BODY_LOOP_ANIMATIONS)[number]

/** Weighted body animation by current energy (0-1). rand ∈ [0,1) */
export function pickIdleAnimation(energy: number, rand: number): BodyLoopAnimation {
  if (energy < 0.3) {
    const pool = ['sit', 'yawn', 'blink', 'sit', 'sleep']
    return pool[Math.floor(rand * pool.length)] as BodyLoopAnimation
  }
  if (energy > 0.7) {
    const pool = ['stretch', 'walk', 'look_around', 'stretch']
    return pool[Math.floor(rand * pool.length)] as BodyLoopAnimation
  }
  if (rand < 0.35) return 'blink'
  if (rand < 0.55) return 'look_around'
  if (rand < 0.75) return 'idle'
  return 'stretch'
}

/** Ambient inner monologue — presence, not intent (null = stay silent) */
export function pickAmbientThought(chance: number, rand: number): string | null {
  if (rand >= chance) return null
  const thoughts = [
    '（发呆）', '（在想事情）', '（望向窗外）', '（轻轻哼着什么）',
    '（数着时间）', '（打了个哈欠）', '（看了看你）', '（伸了个懒腰）'
  ]
  return thoughts[Math.floor(rand * thoughts.length * 8) % thoughts.length]
}
