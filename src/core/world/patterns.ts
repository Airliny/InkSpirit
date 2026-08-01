/**
 * Daily rhythm pattern: pure aggregation over hour-bucket activity rows.
 * Only minute counts per hour are stored — never window titles or content.
 */

export interface HourBucketRow {
  /** 'YYYY-MM-DD' */
  date: string
  /** 0-23 */
  hour_bucket: number
  active_minutes: number
}

export type Deviation = 'normal' | 'late_night' | 'busy' | 'quiet'

export interface PatternContext {
  /** Per-hour mean across history days (excl. today), 24 entries */
  baselineMinutes: number[]
  /** Today's per-hour minutes, 24 entries */
  todayMinutes: number[]
  activeTodayMin: number
  typicalActiveMin: number
  /** How many late-night hours today exceed baseline (0 = normal) */
  sleepLateHours: number
  deviation: Deviation
}

export const HISTORY_DAYS = 14
/** Late-night window considered for "sleeping late" (22:00–02:00) */
const LATE_NIGHT_HOURS = [22, 23, 0, 1]
/** Minimum excess (minutes) across the window to call it "late" */
const SLEEP_LATE_EXCESS_MIN = 30

/**
 * Compact summary carried by SituationSnapshot.
 * Aggregate time statistics only — never window titles or behavior traces.
 */
export interface SituationPatterns {
  /** Tonight's activity exceeds the user's baseline in the 22-2 window */
  sleepLate: boolean
  /** Today's rhythm deviates from the baseline (busy or quiet) */
  unusualSchedule: boolean
  /** 0+ ratio of today's activity over typical when busy (0 otherwise) */
  busyDeviation: number
  /** 0+ ratio of typical over today's activity when quiet (0 otherwise) */
  quietDeviation: number
}

/** Fields consumed by toSituationPatterns — keeps the dependency minimal */
export interface PatternContextLike {
  sleepLateHours: number
  deviation: Deviation
  activeTodayMin: number
  typicalActiveMin: number
}

export function toSituationPatterns(pc: PatternContextLike): SituationPatterns {
  const busy = pc.deviation === 'busy'
  const quiet = pc.deviation === 'quiet'
  return {
    sleepLate: pc.sleepLateHours > 0,
    unusualSchedule: busy || quiet,
    busyDeviation: busy ? round2(pc.activeTodayMin / Math.max(1, pc.typicalActiveMin)) : 0,
    quietDeviation: quiet ? round2(pc.typicalActiveMin / Math.max(1, pc.activeTodayMin)) : 0
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function computeDailyPattern(rows: HourBucketRow[], now: Date): PatternContext {
  const today = toDateKey(now)
  const hourNow = now.getHours()

  const todayMinutes = new Array<number>(24).fill(0)
  const historySums = new Array<number>(24).fill(0)
  const historyCounts = new Array<number>(24).fill(0)
  const dayTotals: Record<string, number> = {}

  for (const row of rows) {
    const h = row.hour_bucket
    if (h < 0 || h > 23) continue
    if (row.date === today) {
      todayMinutes[h] = (todayMinutes[h] ?? 0) + Math.max(0, row.active_minutes)
    } else {
      historySums[h] += Math.max(0, row.active_minutes)
      historyCounts[h] += 1
      dayTotals[row.date] = (dayTotals[row.date] ?? 0) + Math.max(0, row.active_minutes)
    }
  }

  const baselineMinutes = historySums.map((sum, h) =>
    historyCounts[h] > 0 ? sum / historyCounts[h] : 0
  )

  const activeTodayMin = todayMinutes.reduce((a, b) => a + b, 0)
  const dayTotalsList = Object.values(dayTotals)
  const typicalActiveMin = dayTotalsList.length > 0
    ? dayTotalsList.reduce((a, b) => a + b, 0) / dayTotalsList.length
    : 0

  // Late-night excess: today's 22-2 activity vs baseline on the same hours
  let excessMin = 0
  for (const h of LATE_NIGHT_HOURS) {
    excessMin += todayMinutes[h] - baselineMinutes[h]
  }
  const isNowLateNight = hourNow >= 22 || hourNow < 2
  const sleepLateHours = isNowLateNight && excessMin >= SLEEP_LATE_EXCESS_MIN
    ? Math.max(1, Math.round(excessMin / 60))
    : 0

  let deviation: Deviation = 'normal'
  if (sleepLateHours > 0) {
    deviation = 'late_night'
  } else if (typicalActiveMin > 0 && activeTodayMin > typicalActiveMin * 1.5) {
    deviation = 'busy'
  } else if (typicalActiveMin > 0 && activeTodayMin < typicalActiveMin * 0.3) {
    deviation = 'quiet'
  }

  return {
    baselineMinutes,
    todayMinutes,
    activeTodayMin,
    typicalActiveMin,
    sleepLateHours,
    deviation
  }
}
