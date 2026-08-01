/**
 * Relationship Engine v2 — pure, config-driven, testable.
 * No DB, no electron: everything here is a deterministic function of inputs.
 *
 * Flow: user interaction → classifyInteraction() → RelationshipEvent
 *       → applyRelationshipEvent() → new RelationshipState
 */

export type RelationshipStage =
  | 'stranger'
  | 'acquaintance'
  | 'friend'
  | 'close_friend'
  | 'partner'

export type RelationshipDimension =
  | 'trust'
  | 'familiarity'
  | 'affection'
  | 'intimacy'
  | 'dependency'
  | 'understanding'

export const RELATIONSHIP_DIMENSIONS: RelationshipDimension[] = [
  'trust',
  'familiarity',
  'affection',
  'intimacy',
  'dependency',
  'understanding'
]

export type RelationshipEventType =
  | 'daily_chat'
  | 'deep_share'
  | 'care'
  | 'conflict'
  | 'reconcile'
  | 'rely'
  | 'achievement'
  | 'correction'
  | 'name_assigned'
  | 'memory_recall_success'
  | 'memory_recall_confirmed'

export type RelationshipEventSource = 'conversation' | 'memory' | 'behavior' | 'identity'

export interface RelationshipEvent {
  type: RelationshipEventType
  /** 0-1, scales the effect */
  intensity: number
  timestamp: number
  source: RelationshipEventSource
  metadata?: Record<string, unknown>
}

export interface RelationshipState {
  userId: string
  trust: number
  familiarity: number
  affection: number
  intimacy: number
  dependency: number
  understanding: number
  interactionCount: number
  /** Display/narrative only — never a decision input */
  stage: RelationshipStage
  firstInteractionAt: number | null
  lastInteractionAt: number | null
}

export type DimensionWeights = Partial<Record<RelationshipDimension, number>>

export type EventWeights = Record<RelationshipEventType, DimensionWeights>

export const EVENT_STEP = 0.05

/** Successful memory feedback rewards the pet's understanding growth */
export const MEMORY_FEEDBACK_GAIN = 0.35

/**
 * Config-driven event → dimension weights.
 * step = weight × intensity × EVENT_STEP; positive moves toward 1, negative toward 0.
 * Overridable at runtime via config key `relationship_event_weights` (JSON merge).
 */
export const DEFAULT_EVENT_WEIGHTS: EventWeights = {
  daily_chat: { familiarity: 0.4, affection: 0.05 },
  deep_share: { intimacy: 0.8, understanding: 0.5, trust: 0.3, familiarity: 0.1 },
  care: { affection: 0.7, intimacy: 0.3, trust: 0.2 },
  rely: { trust: 0.6, dependency: 0.8, understanding: 0.2 },
  conflict: { trust: -0.6, affection: -0.4, intimacy: -0.1 },
  reconcile: { trust: 0.9, understanding: 0.7, affection: 0.3 },
  achievement: { affection: 0.4, trust: 0.3, familiarity: 0.2 },
  correction: { understanding: -0.5 },
  // 命名是用户主动建立身份称呼的行为——信任微增，仅此而已。
  // 名字属于 Identity，不是 Personality 开关：改名绝不改变人格。
  name_assigned: { trust: 0.2 },
  // Memory feedback loop: recalling things the user told us proves we
  // understand. Confirmed recall must NOT exceed the correction-repair gain
  // (MEMORY_FEEDBACK_GAIN) — being corrected and fixing it weighs more than
  // simply remembering once.
  memory_recall_success: { understanding: 0.25, trust: 0.1 },
  memory_recall_confirmed: { understanding: MEMORY_FEEDBACK_GAIN, intimacy: 0.15 }
}

export function mergeWeights(base: EventWeights, override: Partial<EventWeights>): EventWeights {
  const merged: EventWeights = { ...base }
  for (const type of Object.keys(override) as RelationshipEventType[]) {
    merged[type] = { ...base[type], ...override[type] }
  }
  return merged
}

/** Per-event dimension deltas applied on top of the current state */
export function applyRelationshipEvent(
  state: RelationshipState,
  event: RelationshipEvent,
  weights: EventWeights = DEFAULT_EVENT_WEIGHTS
): RelationshipState {
  const w = weights[event.type] ?? {}
  const next: RelationshipState = {
    ...state,
    lastInteractionAt: event.timestamp
  }
  for (const dim of RELATIONSHIP_DIMENSIONS) {
    const weight = w[dim]
    if (weight === undefined) continue
    const delta = weight * event.intensity * EVENT_STEP
    // Positive: asymptotic approach to 1. Negative: multiplicative decay
    // toward 0 (a linear delta on (1-v) would accelerate past the floor).
    next[dim] = delta >= 0
      ? clamp(next[dim] + delta * (1 - next[dim]), 0, 1)
      : clamp(next[dim] * (1 + delta), 0, 1)
  }
  next.interactionCount = state.interactionCount + 1
  if (!next.firstInteractionAt) next.firstInteractionAt = event.timestamp
  next.stage = computeStage(next)
  return next
}

/** Memory feedback: the pet got something right about the user (or not) */
export function applyMemoryFeedback(state: RelationshipState, success: boolean): RelationshipState {
  if (!success) return state
  const next: RelationshipState = { ...state }
  next.understanding = clamp(next.understanding + MEMORY_FEEDBACK_GAIN * (1 - next.understanding), 0, 1)
  return next
}

/** Display-only stage: a weighted projection of the vector, never a decision input */
export function computeStage(rel: {
  trust: number
  familiarity: number
  affection: number
  intimacy: number
  dependency: number
  understanding: number
}): RelationshipStage {
  const score =
    rel.trust * 0.3 +
    rel.familiarity * 0.25 +
    rel.affection * 0.15 +
    rel.intimacy * 0.2 +
    rel.dependency * 0.05 +
    rel.understanding * 0.05
  if (score >= 0.75) return 'partner'
  if (score >= 0.55) return 'close_friend'
  if (score >= 0.35) return 'friend'
  if (score >= 0.18) return 'acquaintance'
  return 'stranger'
}

// ---- Interaction classification (keyword heuristics, no AI) ----

const CORRECTION_PATTERNS = /不是这样|不对|错了|记错|纠正|早就(不|没)|其实是|你搞错/
const RECONCILE_PATTERNS = /对不起|抱歉|不好意思|原谅|别生气|不是故意的|我不该|刚才.*(语气|说话)|当我没说/
const DEEP_SHARE_PATTERNS = /压力|焦虑|担心|难受|失眠|委屈|害怕|心情|感情|分手|家人|朋友|秘密|想哭|崩溃|难过|低落|不快乐|我其实/
const RELY_PATTERNS = /帮我|帮我想|建议|怎么办|能不能(陪|帮)|陪陪我|听我说|出出主意|规划|计划一下|支个招/
const ACHIEVEMENT_PATTERNS = /上线|完成了|通过了|考上了|成功了|升职|毕业|中奖|终于|拿下|搞定了|做完/
const CARE_PATTERNS = /今天怎么样|感觉怎么样|你还好吗|照顾好自己|辛苦了|想你|真棒|好可爱|乖|摸摸|谢谢你|晚安/

/**
 * Classify a user message into a primary relationship event.
 * Priority: correction > reconcile > conflict > deep_share > rely > achievement > care > daily_chat.
 */
export function classifyInteraction(input: {
  userMsg: string
  hostility: number
  kindness: number
}): RelationshipEvent[] {
  const msg = input.userMsg.trim()
  const now = Date.now()

  if (CORRECTION_PATTERNS.test(msg)) {
    return [{ type: 'correction', intensity: 1, timestamp: now, source: 'conversation' }]
  }
  if (RECONCILE_PATTERNS.test(msg)) {
    return [{ type: 'reconcile', intensity: 1, timestamp: now, source: 'conversation' }]
  }
  if (input.hostility >= 0.5) {
    return [{ type: 'conflict', intensity: input.hostility, timestamp: now, source: 'conversation' }]
  }
  if (DEEP_SHARE_PATTERNS.test(msg) && msg.length >= 8) {
    const intensity = Math.min(1, 0.5 + msg.length / 100)
    return [{ type: 'deep_share', intensity, timestamp: now, source: 'conversation' }]
  }
  if (RELY_PATTERNS.test(msg)) {
    return [{ type: 'rely', intensity: 1, timestamp: now, source: 'conversation' }]
  }
  if (ACHIEVEMENT_PATTERNS.test(msg)) {
    return [{ type: 'achievement', intensity: 1, timestamp: now, source: 'conversation' }]
  }
  if (CARE_PATTERNS.test(msg)) {
    return [{ type: 'care', intensity: 0.7, timestamp: now, source: 'conversation' }]
  }
  const intensity = Math.min(1, 0.3 + msg.length / 200)
  return [{ type: 'daily_chat', intensity, timestamp: now, source: 'conversation' }]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ---- Memory recall → relationship feedback ----
// The memory engine produces recall results; this engine maps them to events.
// Wrong recalls get NO reward — the correction flow (understanding −) applies.

export type RecallOutcome = 'success' | 'confirmed' | 'wrong'

/** Minimum relevance for a recall to be rewarded — prevents farming rewards */
export const RECALL_REWARD_THRESHOLD = 0.5

/** 0-1 relevance of a memory right now (retention × importance blend) */
export function recallRelevance(memory: { retentionScore: number; importance: number }): number {
  return (memory.retentionScore + memory.importance) / 2
}

export function shouldRewardRecall(memory: { retentionScore: number; importance: number }): boolean {
  return recallRelevance(memory) >= RECALL_REWARD_THRESHOLD
}

const CORRECTION_INTERJECTIONS = /不对|不是这样|你记错|错了|我(没|不|从来)(有)?(说过|喜欢|讨厌)/
const CONFIRMATION_INTERJECTIONS = /^对[,，.。]|对呀|没错|是的|是呀|嗯嗯|嗯对|确实|就是这样|你记得|记得真(准|清楚)|那次|当时|对对/

/** Classify how the user reacted to a recall in the follow-up message */
export function classifyRecallFeedback(userMsg: string): 'confirmed' | 'wrong' | null {
  const msg = userMsg.trim()
  if (CORRECTION_INTERJECTIONS.test(msg) || /不对|不是|错了|记错|其实(是|不是)/.test(msg)) return 'wrong'
  if (CONFIRMATION_INTERJECTIONS.test(msg)) return 'confirmed'
  return null
}

/** Map a recall outcome to a relationship event (null = no reward) */
export function recallEvent(
  memoryId: string | null,
  outcome: RecallOutcome,
  now: number = Date.now()
): RelationshipEvent | null {
  switch (outcome) {
    case 'success':
      return { type: 'memory_recall_success', intensity: 1, timestamp: now, source: 'memory', metadata: { memoryId } }
    case 'confirmed':
      return { type: 'memory_recall_confirmed', intensity: 1, timestamp: now, source: 'memory', metadata: { memoryId } }
    case 'wrong':
      return null
  }
}

// ---- Relationship change log (event sourcing) ----

/** Bump when DEFAULT_EVENT_WEIGHTS semantics change — replay depends on it */
export const WEIGHTS_VERSION = 2

/** A replayable record of one relationship-affecting event */
export interface RelationshipChangeEntry {
  eventType: RelationshipEventType | 'memory_feedback'
  intensity: number
  eventSource: RelationshipEventSource | 'memory_feedback'
  metadata: Record<string, unknown> | null
  before: Partial<Record<RelationshipDimension, number>>
  after: Partial<Record<RelationshipDimension, number>>
  affected: Partial<Record<RelationshipDimension, number>>
  weightsVersion: number
  timestamp: number
}

/** Pure: derive the change entry from before/after states + the event */
export function computeChangeEntry(
  event: RelationshipEvent | { type: 'memory_feedback'; intensity: number; timestamp: number; source: 'memory_feedback'; metadata?: Record<string, unknown> },
  before: RelationshipState,
  after: RelationshipState
): RelationshipChangeEntry {
  const affected: Partial<Record<RelationshipDimension, number>> = {}
  for (const dim of RELATIONSHIP_DIMENSIONS) {
    const diff = after[dim] - before[dim]
    if (Math.abs(diff) > 0.000001) {
      affected[dim] = Math.round(diff * 10000) / 10000
    }
  }
  const pick = (state: RelationshipState): Partial<Record<RelationshipDimension, number>> => {
    const out: Partial<Record<RelationshipDimension, number>> = {}
    for (const dim of Object.keys(affected) as RelationshipDimension[]) {
      out[dim] = state[dim]
    }
    return out
  }
  return {
    eventType: event.type,
    intensity: event.intensity,
    eventSource: event.source,
    metadata: event.metadata ?? null,
    before: pick(before),
    after: pick(after),
    affected,
    weightsVersion: WEIGHTS_VERSION,
    timestamp: event.timestamp
  }
}
