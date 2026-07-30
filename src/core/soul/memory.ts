import { getDatabase } from '../database'
import { uuidv4 } from '../utils'

export type MemoryTier = 'short_term' | 'long_term'
export type MemoryType = 'episodic' | 'semantic' | 'procedural'

export interface Memory {
  id: string
  type: MemoryType
  tier: MemoryTier
  content: string
  summary: string | null
  importance: number
  emotionalValence: number
  emotionalIntensity: number
  accessCount: number
  lastAccessedAt: number | null
  createdAt: number
  retentionScore: number
  decayRate: number
  tags: string[]
  relatedMemoryIds: string[]
  sourceConversationId: string | null
}

export function addMemory(
  content: string,
  options: {
    type?: MemoryType
    importance?: number
    emotionalValence?: number
    emotionalIntensity?: number
    tags?: string[]
    sourceConversationId?: string | null
  } = {}
): Memory {
  const db = getDatabase()
  const id = uuidv4()
  const now = Date.now()
  db.prepare(`
    INSERT INTO memories (id, type, tier, content, importance,
      emotional_valence, emotional_intensity, created_at, tags,
      source_conversation_id)
    VALUES (?, ?, 'short_term', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    options.type ?? 'episodic',
    content,
    options.importance ?? 0.5,
    options.emotionalValence ?? 0,
    options.emotionalIntensity ?? 0,
    now,
    JSON.stringify(options.tags ?? []),
    options.sourceConversationId ?? null
  )
  return {
    id,
    type: options.type ?? 'episodic',
    tier: 'short_term',
    content,
    summary: null,
    importance: options.importance ?? 0.5,
    emotionalValence: options.emotionalValence ?? 0,
    emotionalIntensity: options.emotionalIntensity ?? 0,
    accessCount: 0,
    lastAccessedAt: null,
    createdAt: now,
    retentionScore: 1.0,
    decayRate: 0.01,
    tags: options.tags ?? [],
    relatedMemoryIds: [],
    sourceConversationId: options.sourceConversationId ?? null
  }
}

export function getRecentMemories(limit: number = 5): Memory[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT * FROM memories
       WHERE tier = 'long_term'
       ORDER BY importance DESC, last_accessed_at DESC
       LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[]
  return rows.map(mapRow)
}

export function getMemoriesByTags(tags: string[], limit: number = 10): Memory[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT * FROM memories
       WHERE tier = 'long_term'
       ORDER BY importance DESC
       LIMIT 100`
    )
    .all() as Record<string, unknown>[]
  return rows
    .filter((r) => {
      const memTags = JSON.parse(r.tags as string) as string[]
      return tags.some((t) => memTags.includes(t))
    })
    .slice(0, limit)
    .map(mapRow)
}

export function consolidateMemories(): number {
  const db = getDatabase()
  const shortTerm = db
    .prepare("SELECT * FROM memories WHERE tier = 'short_term'")
    .all() as Record<string, unknown>[]

  let consolidated = 0
  for (const row of shortTerm) {
    const score = computeRetentionScore(mapRow(row))
    if (score > 0.5) {
      db.prepare(
        `UPDATE memories SET tier = 'long_term', retention_score = ?, last_accessed_at = ? WHERE id = ?`
      ).run(score, Date.now(), row.id as string)
      consolidated++
    }
  }
  return consolidated
}

export function accessMemory(id: string): void {
  const db = getDatabase()
  db.prepare(
    'UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?'
  ).run(Date.now(), id)
}

export function decayMemories(): number {
  const db = getDatabase()
  const all = db.prepare('SELECT * FROM memories').all() as Record<string, unknown>[]
  let removed = 0
  const now = Date.now()
  for (const row of all) {
    const mem = mapRow(row)
    const elapsedDays = (now - mem.createdAt) / (1000 * 60 * 60 * 24)
    const newScore = mem.retentionScore * Math.exp(-mem.decayRate * elapsedDays)
    if (newScore < 0.1) {
      db.prepare('DELETE FROM memories WHERE id = ?').run(mem.id)
      removed++
    } else {
      db.prepare('UPDATE memories SET retention_score = ? WHERE id = ?').run(newScore, mem.id)
    }
  }
  return removed
}

function computeRetentionScore(mem: Memory): number {
  const accessBonus = Math.min(mem.accessCount * 0.05, 0.3)
  return mem.importance * 0.7 + accessBonus + mem.emotionalIntensity * 0.2
}

function mapRow(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    type: (row.type as MemoryType) ?? 'episodic',
    tier: (row.tier as MemoryTier) ?? 'short_term',
    content: row.content as string,
    summary: row.summary as string | null,
    importance: row.importance as number,
    emotionalValence: row.emotional_valence as number,
    emotionalIntensity: row.emotional_intensity as number,
    accessCount: row.access_count as number,
    lastAccessedAt: row.last_accessed_at as number | null,
    createdAt: row.created_at as number,
    retentionScore: row.retention_score as number,
    decayRate: row.decay_rate as number,
    tags: JSON.parse((row.tags as string) ?? '[]') as string[],
    relatedMemoryIds: JSON.parse((row.related_memory_ids as string) ?? '[]') as string[],
    sourceConversationId: row.source_conversation_id as string | null
  }
}
