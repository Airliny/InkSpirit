import type { BehaviorAction, BehaviorIntent, DecideResult, DirectorInput, GateResult } from './behaviorTypes'
import type { BudgetState } from './behaviorBudget'
import { canSpend, createBudget, maxForPersonality, rolloverBudget, spendBudget } from './behaviorBudget'
import { hangIntent, guardianIntent, recollectIntent, ritualIntents, situationIntents, socialIntent, stageGrowIntent, driveIntent } from './behaviorRules'
import { interruptCost, scoreIntent, situationModifier, type ScoreContext } from './behaviorScorer'
import { AWAY_THRESHOLD_MS } from '../world/situation'

export type { DecideResult, DirectorInput, BehaviorAction, BehaviorIntent, GateResult } from './behaviorTypes'
export type { BudgetState } from './behaviorBudget'

/**
 * Behavior Director — the single decision pipeline for autonomous behavior.
 *
 *   Gate → Situation → Soul → Relationship → Selection
 *
 * Pure: same inputs + rng → same output. Every emitted action carries a
 * traceable reason for behavior_logs.
 */

const MIN_SCORE = 0.15

/** Layer 1: hard gate. DND and absence silence everything above a level. */
export function evaluateGate(input: DirectorInput): GateResult {
  const s = input.situation
  if (!s) return { maxInterruptLevel: 0, reason: 'no_situation' }
  if (s.userState === 'meeting' || s.userState === 'playing') {
    return { maxInterruptLevel: 0, reason: `dnd:${s.userState}` }
  }
  if (s.idleMs >= AWAY_THRESHOLD_MS) return { maxInterruptLevel: 0, reason: 'away' }
  if (s.userState === 'recovering') return { maxInterruptLevel: 1, reason: 'recovering' }
  return { maxInterruptLevel: 3, reason: 'ok' }
}

export function decide(input: DirectorInput, rng: () => number = Math.random): DecideResult {
  const now = Date.now()

  // Layer 1 — Gate
  const gate = evaluateGate(input)

  // Layer 2 — Situation intent candidates
  let candidates: BehaviorIntent[] = []
  const s = input.situation
  candidates = candidates.concat(situationIntents(input))
  candidates = candidates.concat(ritualIntents(input, s ? new Date(s.timestamp).getHours() : new Date(now).getHours()))
  candidates = candidates.concat(guardianIntent(input))
  candidates = candidates.concat(stageGrowIntent(input))
  candidates = candidates.concat(recollectIntent(input))
  candidates = candidates.concat(socialIntent(input))
  candidates = candidates.concat(hangIntent(input))
  candidates = candidates.concat(driveIntent(input.driveImpulse, input.emotion))

  // Gate filter: nothing above the allowed interrupt level
  candidates = candidates.filter(c => c.interruptLevel <= gate.maxInterruptLevel)

  // Budget: speech spends the anti-spam budget, unless the event is important
  const budget = rolloverBudget(input.budget, now)
  const speaking = (c: BehaviorIntent) => c.interruptLevel >= 2
  const budgetAvailable = canSpend(budget, now)
  const affordable = candidates.filter(c => !speaking(c) || c.budgetExempt || budgetAvailable)
  if (affordable.length < candidates.length) {
    candidates = affordable
  }

  // Layer 3+4 — score with soul & relationship modulation
  const ctx: ScoreContext = {
    personality: input.personality,
    relationship: input.relationship,
    emotion: input.emotion,
    situation: s
  }
  const scored = candidates
    .map(c => ({ intent: c, score: scoreIntent(c, ctx) + situationModifier(c.kind, s) - interruptCost(c.kind, s) }))
    .filter(x => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)

  // Layer 5 — weighted sampling
  if (scored.length === 0) {
    return { action: null, budget }
  }

  const total = scored.reduce((sum, x) => sum + x.score, 0)
  let pick = rng() * total
  let chosen = scored[scored.length - 1]
  for (const x of scored) {
    pick -= x.score
    if (pick <= 0) {
      chosen = x
      break
    }
  }

  const c = chosen.intent
  let nextBudget = budget
  if (speaking(c) && !c.budgetExempt) {
    nextBudget = spendBudget(budget, now)
  }

  const action: BehaviorAction = {
    id: c.id,
    kind: c.kind,
    interruptLevel: c.interruptLevel,
    urgency: Math.min(1, chosen.score),
    message: c.message,
    thought: c.thought,
    behavior: c.behavior,
    expression: c.expression,
    reason: `${gate.reason} → ${c.id} (score ${chosen.score.toFixed(2)})`
  }

  return { action, budget: nextBudget }
}

/** Convenience: fresh budget default for callers before first decide */
export function freshBudget(proactiveness: number, now: number = Date.now()): BudgetState {
  return createBudget(maxForPersonality(proactiveness), now)
}
