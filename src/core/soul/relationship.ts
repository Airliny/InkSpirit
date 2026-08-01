import { getDatabase } from '../database'
import { getConfig, setConfig } from '../config'
import { uuidv4 } from '../utils'
import {
  DEFAULT_EVENT_WEIGHTS,
  applyRelationshipEvent,
  applyMemoryFeedback,
  computeChangeEntry,
  mergeWeights,
  type RelationshipEvent,
  type RelationshipEventType,
  type RelationshipState,
  type RelationshipStage,
  type RelationshipChangeEntry,
  type EventWeights
} from './relationshipEvents'

export type { RelationshipStage } from './relationshipEvents'
export type { RelationshipState as Relationship } from './relationshipEvents'

const PENDING_CORRECTION_KEY = 'pending_correction_at'
const PENDING_TTL_MS = 6 * 60 * 60 * 1000
const PENDING_EXPIRE_MS = 24 * 60 * 60 * 1000

let cached: { at: number; rel: RelationshipState } | null = null
const CACHE_TTL_MS = 5000

/** Reset in-memory relationship (e.g. after importing a backup) */
export function clearRelationshipCache(): void {
  cached = null
}

function loadEventWeights(): EventWeights {
  const raw = getConfig('relationship_event_weights')
  if (!raw) return DEFAULT_EVENT_WEIGHTS
  try {
    const parsed = JSON.parse(raw) as Partial<EventWeights>
    return mergeWeights(DEFAULT_EVENT_WEIGHTS, parsed)
  } catch {
    return DEFAULT_EVENT_WEIGHTS
  }
}

export function getRelationship(userId: string = 'default'): RelationshipState {
  if (cached && cached.rel.userId === userId && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.rel
  }

  const db = getDatabase()
  const row = db.prepare('SELECT * FROM relationships WHERE user_id = ?').get(userId) as
    | Record<string, unknown>
    | undefined
  if (!row) {
    const now = Date.now()
    const state: RelationshipState = {
      userId,
      trust: 0.1,
      familiarity: 0.1,
      affection: 0.1,
      intimacy: 0.05,
      dependency: 0.05,
      understanding: 0.1,
      interactionCount: 0,
      stage: 'stranger',
      firstInteractionAt: now,
      lastInteractionAt: now
    }
    cached = { at: Date.now(), rel: state }
    return state
  }
  const rel: RelationshipState = {
    userId: row.user_id as string,
    trust: row.trust as number,
    familiarity: row.familiarity as number,
    affection: row.affection as number,
    intimacy: row.intimacy as number,
    dependency: row.dependency as number,
    understanding: row.understanding as number,
    interactionCount: row.interaction_count as number,
    stage: row.stage as RelationshipStage,
    firstInteractionAt: row.first_interaction_at as number | null,
    lastInteractionAt: row.last_interaction_at as number | null
  }
  cached = { at: Date.now(), rel }
  return rel
}

/**
 * Single entry point for the Relationship Engine (v2).
 * Events are classified upstream (classifyInteraction) and applied here.
 */
export function recordRelationshipEvent(
  event: RelationshipEvent,
  userId: string = 'default'
): RelationshipState {
  cached = null // invalidate before reading fresh state
  const db = getDatabase()
  const current = getRelationship(userId)
  const updated = applyRelationshipEvent(current, event, loadEventWeights())

  db.prepare(`
    INSERT OR REPLACE INTO relationships
    (user_id, trust, familiarity, affection, intimacy, dependency, understanding,
     interaction_count, stage, first_interaction_at, last_interaction_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    updated.userId,
    updated.trust,
    updated.familiarity,
    updated.affection,
    updated.intimacy,
    updated.dependency,
    updated.understanding,
    updated.interactionCount,
    updated.stage,
    updated.firstInteractionAt,
    updated.lastInteractionAt
  )

  // A correction opens a memory-feedback window: if the corrected fact is
  // stored as a memory afterwards, understanding recovers (see below)
  if (event.type === 'correction') {
    setConfig(PENDING_CORRECTION_KEY, String(Date.now()))
  }
  expireStalePendingCorrection()

  // Event sourcing: every relationship change is replayable
  saveChangeLog(computeChangeEntry(event, current, updated))

  return updated
}

function saveChangeLog(entry: RelationshipChangeEntry): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO relationship_change_log
    (id, event_type, intensity, event_source, metadata, before_json, after_json, affected_json, weights_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    entry.eventType,
    entry.intensity,
    entry.eventSource,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
    JSON.stringify(entry.before),
    JSON.stringify(entry.after),
    JSON.stringify(entry.affected),
    entry.weightsVersion,
    entry.timestamp
  )
  // Bounded: keep the most recent 10k changes (years of interactions)
  db.prepare(
    `DELETE FROM relationship_change_log WHERE id NOT IN (
       SELECT id FROM relationship_change_log ORDER BY created_at DESC LIMIT 10000
     )`
  ).run()
}

/** Replay recent relationship changes (debug / export / "why did intimacy drop") */
export function getRelationshipEventLog(limit = 100): RelationshipChangeEntry[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM relationship_change_log ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[]
  return rows.map((row) => ({
    eventType: row.event_type as RelationshipChangeEntry['eventType'],
    intensity: row.intensity as number,
    eventSource: row.event_source as RelationshipChangeEntry['eventSource'],
    metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : null,
    before: JSON.parse(row.before_json as string),
    after: JSON.parse(row.after_json as string),
    affected: JSON.parse(row.affected_json as string),
    weightsVersion: row.weights_version as number,
    timestamp: row.created_at as number
  }))
}

/** Legacy shim: uncategorized interactions count as light daily chat */
export function recordInteraction(type: RelationshipEventType = 'daily_chat'): RelationshipState {
  return recordRelationshipEvent({
    type,
    intensity: 0.3,
    timestamp: Date.now(),
    source: 'conversation'
  })
}

/**
 * Memory feedback loop: a correction dipped understanding; if the pet then
 * stored the corrected fact as a memory, understanding recovers and grows.
 */
export function acknowledgeMemoryFeedback(userId: string = 'default'): RelationshipState {
  const pendingAt = Number(getConfig(PENDING_CORRECTION_KEY) || 0)
  if (pendingAt === 0) return getRelationship(userId)

  cached = null
  setConfig(PENDING_CORRECTION_KEY, '')

  const db = getDatabase()
  const current = getRelationship(userId)
  const updated = applyMemoryFeedback(current, Date.now() - pendingAt <= PENDING_TTL_MS)
  if (updated === current) return current

  db.prepare(`
    UPDATE relationships SET understanding = ?, stage = ? WHERE user_id = ?
  `).run(updated.understanding, updated.stage, userId)
  cached = null
  saveChangeLog(computeChangeEntry(
    { type: 'memory_feedback', intensity: 1, timestamp: Date.now(), source: 'memory_feedback' },
    current,
    updated
  ))
  return updated
}

/** Drop a stale pending correction so it can't leak into future feedback */
function expireStalePendingCorrection(): void {
  const pendingAt = Number(getConfig(PENDING_CORRECTION_KEY) || 0)
  if (pendingAt !== 0 && Date.now() - pendingAt > PENDING_EXPIRE_MS) {
    setConfig(PENDING_CORRECTION_KEY, '')
  }
}
