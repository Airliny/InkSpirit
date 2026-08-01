import { getDatabase } from '../database'
import { uuidv4 } from '../utils'

export interface PersonalityTraits {
  humor: number
  gentleness: number
  proactiveness: number
  curiosity: number
  professionalism: number
  expressiveness: number
  warmth: number
  formality: number
}

export interface Personality {
  id: string
  version: number
  isActive: boolean
  traits: PersonalityTraits
  createdAt: number
}

export const DEFAULT_TRAITS: PersonalityTraits = {
  humor: 0.5,
  gentleness: 0.6,
  proactiveness: 0.4,
  curiosity: 0.7,
  professionalism: 0.5,
  expressiveness: 0.5,
  warmth: 0.5,
  formality: 0.4
}

const EVOLVE_RATE = 0.015
const EVOLVE_COOLDOWN_HOURS = 6
const MIN_TRAIT_DELTA = 0.005

/** One per-trait change row — the "why" of a personality evolution */
export interface PersonalityEvolutionEntry {
  personalityVersion: number
  trait: keyof PersonalityTraits
  before: number
  after: number
  delta: number
  reason: string | null
  source: string | null
  timestamp: number
}

/** Pure: compute log entries from a before/after trait snapshot */
export function computeEvolutionLogEntries(
  before: PersonalityTraits,
  after: PersonalityTraits,
  version: number,
  reason: string | null,
  source: string | null,
  timestamp: number = Date.now()
): PersonalityEvolutionEntry[] {
  const entries: PersonalityEvolutionEntry[] = []
  for (const trait of Object.keys(after) as (keyof PersonalityTraits)[]) {
    const diff = Math.abs(after[trait] - before[trait])
    if (diff < MIN_TRAIT_DELTA) continue
    entries.push({
      personalityVersion: version,
      trait,
      before: before[trait],
      after: after[trait],
      delta: round2(after[trait] - before[trait]),
      reason,
      source,
      timestamp
    })
  }
  return entries
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

let cachedPersonality: { at: number; p: Personality } | null = null
const PERSONALITY_TTL_MS = 5000

/** Reset in-memory personality (e.g. after importing a backup) */
export function clearPersonalityCache(): void {
  cachedPersonality = null
}

export function getActivePersonality(): Personality {
  if (cachedPersonality && Date.now() - cachedPersonality.at < PERSONALITY_TTL_MS) {
    return cachedPersonality.p
  }
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM personalities WHERE is_active = 1 ORDER BY version DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined
  if (!row) {
    const fallback: Personality = {
      id: 'default_personality',
      version: 1,
      isActive: true,
      traits: { ...DEFAULT_TRAITS },
      createdAt: Date.now()
    }
    cachedPersonality = { at: Date.now(), p: fallback }
    return fallback
  }
  const p: Personality = {
    id: row.id as string,
    version: row.version as number,
    isActive: (row.is_active as number) === 1,
    traits: JSON.parse(row.traits_json as string) as PersonalityTraits,
    createdAt: row.created_at as number
  }
  cachedPersonality = { at: Date.now(), p }
  return p
}

export function evolvePersonality(
  current: PersonalityTraits,
  adjustments: Partial<PersonalityTraits>,
  rate: number = EVOLVE_RATE
): PersonalityTraits {
  const evolved = { ...current }
  for (const key of Object.keys(adjustments) as (keyof PersonalityTraits)[]) {
    const target = adjustments[key]
    if (target !== undefined) {
      evolved[key] = clamp(evolved[key] + (target - evolved[key]) * rate, 0, 1)
    }
  }
  return evolved
}

export function tryEvolvePersonality(
  adjustments: Partial<PersonalityTraits>,
  reason: string | null = null,
  source: string | null = null
): boolean {
  const current = getActivePersonality()
  const hoursSinceLast = (Date.now() - current.createdAt) / (1000 * 60 * 60)

  if (hoursSinceLast < EVOLVE_COOLDOWN_HOURS) {
    return false
  }

  const evolved = evolvePersonality(current.traits, adjustments)
  const maxDelta = maxTraitDelta(current.traits, evolved)
  if (maxDelta < MIN_TRAIT_DELTA) {
    return false
  }

  const nextVersion = current.version + 1
  savePersonality(evolved, nextVersion)
  // Event-sourced: every change answers "why"
  const entries = computeEvolutionLogEntries(current.traits, evolved, nextVersion, reason, source)
  for (const entry of entries) {
    saveEvolutionLogEntry(entry)
  }
  return true
}

function maxTraitDelta(a: PersonalityTraits, b: PersonalityTraits): number {
  const keys = Object.keys(a) as (keyof PersonalityTraits)[]
  let max = 0
  for (const key of keys) {
    const d = Math.abs(a[key] - b[key])
    if (d > max) max = d
  }
  return max
}

export function savePersonality(traits: PersonalityTraits, versionOverride?: number): void {
  cachedPersonality = null // invalidate before writing
  const db = getDatabase()
  const current = getActivePersonality()
  const nextVersion = versionOverride ?? current.version + 1
  db.prepare('UPDATE personalities SET is_active = 0 WHERE is_active = 1').run()
  const id = `personality_v${nextVersion}_${Date.now()}`
  db.prepare(
    'INSERT INTO personalities (id, version, is_active, traits_json, created_at) VALUES (?, ?, 1, ?, ?)'
  ).run(id, nextVersion, JSON.stringify(traits), Date.now())
  cachedPersonality = null
}

function saveEvolutionLogEntry(entry: PersonalityEvolutionEntry): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO personality_evolution_log
    (id, personality_version, trait, before_value, after_value, delta, reason, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    entry.personalityVersion,
    entry.trait,
    entry.before,
    entry.after,
    entry.delta,
    entry.reason,
    entry.source,
    entry.timestamp
  )
}

/** Query the evolution history of a trait (or all) — "why is 砚灵 so gentle" */
export function getPersonalityEvolutionHistory(trait?: keyof PersonalityTraits, limit = 50): PersonalityEvolutionEntry[] {
  const db = getDatabase()
  const rows = (trait
    ? db.prepare(
        'SELECT * FROM personality_evolution_log WHERE trait = ? ORDER BY created_at DESC LIMIT ?'
      ).all(trait, limit)
    : db.prepare('SELECT * FROM personality_evolution_log ORDER BY created_at DESC LIMIT ?').all(limit)) as Record<string, unknown>[]
  return rows.map((row) => ({
    personalityVersion: row.personality_version as number,
    trait: row.trait as keyof PersonalityTraits,
    before: row.before_value as number,
    after: row.after_value as number,
    delta: row.delta as number,
    reason: row.reason as string | null,
    source: row.source as string | null,
    timestamp: row.created_at as number
  }))
}

export type ReminderTone = 'gentle' | 'playful' | 'direct'

export interface BehaviorStyle {
  greetFrequency: number
  reminderTone: ReminderTone
  curiosity: number
  idleThoughtChance: number
}

/** Derive how the pet behaves from its current personality (behavior feedback loop) */
export function getBehaviorStyle(): BehaviorStyle {
  const p = getActivePersonality().traits
  const tone: ReminderTone = p.humor > 0.6 ? 'playful' : p.gentleness > 0.6 ? 'gentle' : 'direct'
  return {
    greetFrequency: 0.15 + p.proactiveness * 0.35,
    reminderTone: tone,
    curiosity: p.curiosity,
    idleThoughtChance: 0.05 + p.curiosity * 0.1 + p.expressiveness * 0.08
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
