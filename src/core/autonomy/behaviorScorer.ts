import type { BehaviorIntent, InterruptLevel } from './behaviorTypes'
import type { SituationSnapshot } from '../world/situation'
import type { RelationshipState } from '../soul/relationshipEvents'
import type { PersonalityTraits } from '../soul/personality'
import type { EmotionState } from '../soul/emotion'

export interface ScoreContext {
  personality: PersonalityTraits
  relationship: RelationshipState
  emotion: EmotionState
  situation: SituationSnapshot | null
}

/**
 * Layer 3+4: personality (Soul) and relationship (Relationship) modulation.
 * score = baseWeight × (1 + mod), where mod is per-intent-kind.
 */
export function scoreIntent(intent: BehaviorIntent, ctx: ScoreContext): number {
  const p = ctx.personality
  const rel = ctx.relationship
  const s = ctx.situation
  let mod = 0

  switch (intent.kind) {
    case 'social':
    case 'ritual':
      // Proactive personalities reach out more; intimate/trusting bonds allow it
      mod += (p.proactiveness - 0.4) * 0.8
      mod += rel.intimacy * 0.5 + rel.trust * 0.3 - 0.3
      // Don't chatter into deep focus
      if (s?.userState === 'deep_work') mod -= 0.4
      break
    case 'care':
      // Trusted + needed pets remind more; gentle personalities remind softer
      mod += rel.trust * 0.3 + rel.dependency * 0.3
      mod += (p.gentleness - 0.5) * 0.2
      break
    case 'recollect':
      mod += rel.familiarity * 0.5 + rel.understanding * 0.3 - 0.2
      break
    case 'watch':
      // Distant relationships observe quietly more than they speak
      mod += (0.3 - rel.intimacy) * 0.4
      mod += p.curiosity * 0.3
      break
    case 'hang':
      mod += rel.intimacy * 0.5 + rel.affection * 0.2
      break
    case 'play':
      mod += (p.humor - 0.5) * 0.3 + rel.affection * 0.2
      break
    case 'explore':
      mod += (p.curiosity - 0.5) * 0.5
      break
    case 'move':
    case 'rest':
    case 'idle':
      break
  }

  // Emotion modulates: sad/lonely pets seek company, playful pets move
  if (intent.kind === 'social') {
    if (ctx.emotion.loneliness > 0.4 || ctx.emotion.sadness > 0.4) mod += 0.3
  }
  if (intent.kind === 'play') {
    if (ctx.emotion.happiness > 0.6 && ctx.emotion.energy > 0.5) mod += 0.3
  }

  return Math.max(0, intent.baseWeight * (1 + mod))
}

/** How the current situation modulates an intent (Layer 2 tail) */
export function situationModifier(kind: BehaviorIntent['kind'], s: SituationSnapshot | null): number {
  if (!s) return 0
  switch (s.userState) {
    case 'recovering':
      // Just finished hard work — prefer quiet company over speech
      return kind === 'watch' || kind === 'move' ? 0.4 : kind === 'social' ? -0.6 : 0
    case 'deep_work':
      return kind === 'care' ? 0.2 : 0
    default:
      return 0
  }
}

export function interruptCost(kind: BehaviorIntent['kind'], s: SituationSnapshot | null): number {
  if (!s) return 0
  if (s.userState === 'deep_work' && (kind === 'social' || kind === 'ritual')) return 0.3
  if (s.userState === 'recovering' && kind === 'care') return 0.5
  return 0
}

export type { InterruptLevel }
