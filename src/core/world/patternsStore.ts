import { getDatabase } from '../database'
import { toDateKey, type HourBucketRow } from './patterns'

/**
 * daily_patterns persistence: aggregate time statistics only.
 * Never window titles, app history, or behavior traces.
 */

export function recordActiveMinutes(minutes: number, now = new Date()): void {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  const db = getDatabase()
  db.prepare(`
    INSERT INTO daily_patterns (date, hour_bucket, active_minutes) VALUES (?, ?, ?)
    ON CONFLICT(date, hour_bucket)
    DO UPDATE SET active_minutes = active_minutes + excluded.active_minutes
  `).run(toDateKey(now), now.getHours(), minutes)
}

export function loadPatternRows(days = 21): HourBucketRow[] {
  const cutoff = toDateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
  const db = getDatabase()
  const rows = db
    .prepare('SELECT date, hour_bucket, active_minutes FROM daily_patterns WHERE date >= ?')
    .all(cutoff) as unknown as HourBucketRow[]
  return rows
}

export function prunePatternRows(days = 21): number {
  const cutoff = toDateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
  const db = getDatabase()
  return db.prepare('DELETE FROM daily_patterns WHERE date < ?').run(cutoff).changes
}
