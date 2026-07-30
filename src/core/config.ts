import { getDatabase } from './database'

export interface Config {
  key: string
  value: string
  updatedAt: number
}

export function getConfig(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  const db = getDatabase()
  db.prepare(
    'INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)'
  ).run(key, value, Date.now())
}
