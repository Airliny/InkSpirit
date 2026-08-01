import { computeDailyPattern, type PatternContext } from './patterns'
import { loadPatternRows } from './patternsStore'
import { synthesizeSituation, type SituationInput, type SituationSnapshot } from './situation'

/**
 * World Sensor: the single in-memory holder of the latest SituationSnapshot.
 *
 * Consumers (prompt / P3 BehaviorDirector) read via getLatestSituation().
 * The sensor itself never triggers behavior — understanding only.
 */

let latest: SituationSnapshot | null = null
let patternContext: PatternContext | null = null
let lastPatternRefreshAt = 0
const PATTERN_REFRESH_MS = 10 * 60 * 1000

export function getLatestSituation(): SituationSnapshot | null {
  return latest
}

/** Recompute the daily-rhythm baseline from the DB (call once at startup, then on feed throttle) */
export function refreshPatternContext(now = new Date()): PatternContext | null {
  patternContext = computeDailyPattern(loadPatternRows(), now)
  lastPatternRefreshAt = Date.now()
  return patternContext
}

/** Feed raw signals and get a fresh snapshot. Pattern baseline refreshes on a throttle. */
export function feed(input: SituationInput): SituationSnapshot {
  if (!patternContext || Date.now() - lastPatternRefreshAt > PATTERN_REFRESH_MS) {
    refreshPatternContext()
  }
  latest = synthesizeSituation({ ...input, patternContext })
  return latest
}
