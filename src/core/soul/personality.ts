import { getDatabase } from '../database'

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

export function getActivePersonality(): Personality {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM personalities WHERE is_active = 1 ORDER BY version DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined
  if (!row) {
    return {
      id: 'default_personality',
      version: 1,
      isActive: true,
      traits: { ...DEFAULT_TRAITS },
      createdAt: Date.now()
    }
  }
  return {
    id: row.id as string,
    version: row.version as number,
    isActive: (row.is_active as number) === 1,
    traits: JSON.parse(row.traits_json as string) as PersonalityTraits,
    createdAt: row.created_at as number
  }
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

export function tryEvolvePersonality(adjustments: Partial<PersonalityTraits>): boolean {
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

  savePersonality(evolved)
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

export function savePersonality(traits: PersonalityTraits): void {
  const db = getDatabase()
  const current = getActivePersonality()
  db.prepare('UPDATE personalities SET is_active = 0 WHERE is_active = 1').run()
  const id = `personality_v${current.version + 1}_${Date.now()}`
  db.prepare(
    'INSERT INTO personalities (id, version, is_active, traits_json, created_at) VALUES (?, ?, 1, ?, ?)'
  ).run(id, current.version + 1, JSON.stringify(traits), Date.now())
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
