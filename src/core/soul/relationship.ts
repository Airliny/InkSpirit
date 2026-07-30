import { getDatabase } from '../database'

export type RelationshipStage =
  | 'stranger'
  | 'acquaintance'
  | 'friend'
  | 'close_friend'
  | 'partner'

export interface Relationship {
  userId: string
  trust: number
  familiarity: number
  affection: number
  interactionCount: number
  stage: RelationshipStage
  firstInteractionAt: number | null
  lastInteractionAt: number | null
}

export function getRelationship(userId: string = 'default'): Relationship {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM relationships WHERE user_id = ?').get(userId) as
    | Record<string, unknown>
    | undefined
  if (!row) {
    const now = Date.now()
    return {
      userId,
      trust: 0.1,
      familiarity: 0.1,
      affection: 0.1,
      interactionCount: 0,
      stage: 'stranger',
      firstInteractionAt: now,
      lastInteractionAt: now
    }
  }
  return {
    userId: row.user_id as string,
    trust: row.trust as number,
    familiarity: row.familiarity as number,
    affection: row.affection as number,
    interactionCount: row.interaction_count as number,
    stage: row.stage as RelationshipStage,
    firstInteractionAt: row.first_interaction_at as number | null,
    lastInteractionAt: row.last_interaction_at as number | null
  }
}

export function recordInteraction(userId: string = 'default'): Relationship {
  const db = getDatabase()
  const rel = getRelationship(userId)

  const familiarityGain = 0.005 + (1 - rel.familiarity) * 0.01
  const trustGain = 0.003 + (1 - rel.trust) * 0.005
  const affectionGain = 0.002 + (1 - rel.affection) * 0.005

  const updated = {
    ...rel,
    interactionCount: rel.interactionCount + 1,
    trust: Math.min(1, rel.trust + trustGain),
    familiarity: Math.min(1, rel.familiarity + familiarityGain),
    affection: Math.min(1, rel.affection + affectionGain),
    lastInteractionAt: Date.now()
  }

  updated.stage = computeStage(updated)

  db.prepare(`
    INSERT OR REPLACE INTO relationships
    (user_id, trust, familiarity, affection, interaction_count, stage, first_interaction_at, last_interaction_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    updated.userId,
    updated.trust,
    updated.familiarity,
    updated.affection,
    updated.interactionCount,
    updated.stage,
    updated.firstInteractionAt,
    updated.lastInteractionAt
  )

  return updated
}

function computeStage(rel: Relationship): RelationshipStage {
  const avg = (rel.trust + rel.familiarity + rel.affection) / 3
  if (avg >= 0.8 || rel.interactionCount > 200) return 'partner'
  if (avg >= 0.6 || rel.interactionCount > 100) return 'close_friend'
  if (avg >= 0.35 || rel.interactionCount > 30) return 'friend'
  if (avg >= 0.15 || rel.interactionCount > 5) return 'acquaintance'
  return 'stranger'
}
