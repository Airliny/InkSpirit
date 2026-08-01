import Database from 'better-sqlite3'
import { getDatabase } from './database'

// In-memory cache: config is read on every heartbeat/guardian/router decision,
// so hitting the DB each time is wasteful. Writes go through to the DB.
const cache = new Map<string, string>()

// Cache prepared statements for the hot read/write paths
let stmtGet: Database.Statement | null = null
let stmtSet: Database.Statement | null = null

function ensureStmts(): void {
  if (!stmtGet) {
    const db = getDatabase()
    stmtGet = db.prepare('SELECT value FROM config WHERE key = ?')
    stmtSet = db.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)')
  }
}

export interface Config {
  key: string
  value: string
  updatedAt: number
}

export function getConfig(key: string): string | null {
  if (cache.has(key)) {
    const v = cache.get(key)!
    return v === '\u0000' ? null : v
  }
  ensureStmts()
  const row = stmtGet!.get(key) as { value: string } | undefined
  const value = row?.value ?? null
  cache.set(key, value ?? '\u0000')
  return value
}

export function setConfig(key: string, value: string): void {
  cache.set(key, value)
  ensureStmts()
  stmtSet!.run(key, value, Date.now())
}

/** Drop the cache (e.g. after importing a backup, or tests) */
export function clearConfigCache(): void {
  cache.clear()
}

/** 测试接缝：重置语句句柄（换库后旧句柄失效，vitest only） */
export function resetConfigStatementsForTest(): void {
  stmtGet = null
  stmtSet = null
  cache.clear()
}

/** Warm the cache from the DB at startup */
export function preloadConfig(): void {
  try {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[]
    cache.clear()
    for (const row of rows) cache.set(row.key, row.value)
  } catch {
    // DB not ready yet — cache stays empty, reads will hit the DB
  }
}
