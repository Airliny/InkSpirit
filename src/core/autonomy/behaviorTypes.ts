import type { SituationSnapshot } from '../world/situation'
import type { RelationshipState, RelationshipStage } from '../soul/relationshipEvents'
import type { PersonalityTraits } from '../soul/personality'
import type { EmotionState } from '../soul/emotion'
import type { BehaviorImpulse } from './drives'
import type { GuardianSignal } from '../safety/guardian'

/** High-level action family — decides how the renderer gets the action */
export type BehaviorKind =
  | 'idle'
  | 'move'
  | 'rest'
  | 'explore'
  | 'play'
  | 'watch'
  | 'hang'
  | 'social'
  | 'care'
  | 'recollect'
  | 'ritual'

/**
 * How intrusive the action is:
 * 0 = animation only (walk/stretch/sleep) — never blocked
 * 1 = visual/thought level (look around, hang window, inner monologue)
 * 2 = speech (greet, chat, recollect)
 * 3 = work-interrupting speech (rest reminders)
 */
export type InterruptLevel = 0 | 1 | 2 | 3

/** The single output of the director — the renderer only consumes this */
export interface BehaviorAction {
  /** Stable id, e.g. 'welcome_home', 'rest_support' */
  id: string
  kind: BehaviorKind
  interruptLevel: InterruptLevel
  urgency: number
  message?: string
  thought?: string
  behavior?: string
  expression?: string
  /** Traceable rationale, written to behavior_logs */
  reason: string
}

/** A candidate the director considers before selection */
export interface BehaviorIntent {
  id: string
  kind: BehaviorKind
  interruptLevel: InterruptLevel
  baseWeight: number
  message?: string
  thought?: string
  behavior?: string
  expression?: string
  /** Important events may break the anti-spam budget (welcome home, rituals) */
  budgetExempt?: boolean
}

export interface DirectorInput {
  situation: SituationSnapshot | null
  relationship: RelationshipState
  personality: PersonalityTraits
  emotion: EmotionState
  /** Last drive impulse from drives.tick() (may be {type:'none'}) */
  driveImpulse: BehaviorImpulse
  /** Anti-spam budget state — decide() advances it when it speaks */
  budget: BudgetState
  flags: {
    /** ms since the user came back after an absence (0 = not just returned) */
    returnedAfterMs: number
    greetingDoneToday: boolean
    nightDoneToday: boolean
    /** a memorable memory exists and the recollect cooldown has passed */
    recallableMemory: boolean
    /** content snippet for the recollect action */
    recollectSnippet: string | null
    /** window hang is physically possible (cooldown/size/quiet checks done) */
    canHang: boolean
    /** system health signal from the Guardian (null = nothing to warn) */
    guardianSignal: GuardianSignal | null
    /** relationship stage just upgraded and not yet expressed (null = none) */
    stageGrowTo: RelationshipStage | null
  }
}

/** Layer 1 output: how intrusive the current situation allows actions to be */
export interface GateResult {
  maxInterruptLevel: InterruptLevel
  reason: string
}

export interface DecideResult {
  action: BehaviorAction | null
  /** Budget advanced when a speaking action was emitted */
  budget: BudgetState
}

import type { BudgetState } from './behaviorBudget'
