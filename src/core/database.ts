import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { runMigrations } from './migrations'

let db: Database.Database | null = null
let dbState: DatabaseState | null = null

export type DatabaseStatus = 'healthy' | 'failed'

export interface DatabaseState {
  status: DatabaseStatus
  lastError: string | null
  /** the corrupt data file still exists locally (can be backed up by user) */
  backupAvailable: boolean
}

function dbPath(): string {
  return path.join(app.getPath('userData'), 'inkspirit.db')
}

/**
 * Open (or reopen) the database with full startup protection.
 * NEVER throws — failure is reported via DatabaseState so the caller can
 * enter Recovery Mode instead of hanging invisible.
 */
export function openDatabase(): DatabaseState {
  if (dbState?.status === 'healthy') return dbState

  try {
    const d = new Database(dbPath())
    d.pragma('journal_mode = WAL')
    d.pragma('foreign_keys = ON')
    runMigrations(d)
    db = d
    dbState = { status: 'healthy', lastError: null, backupAvailable: false }
  } catch (err) {
    db = null
    dbState = {
      status: 'failed',
      lastError: err instanceof Error ? err.message : String(err),
      backupAvailable: fs.existsSync(dbPath())
    }
  }
  return dbState
}

export function getDatabaseState(): DatabaseState {
  return dbState ?? openDatabase()
}

/**
 * Recovery: move the corrupt database files aside (user's data is preserved
 * on disk, nothing is deleted), then initialize a fresh database.
 */
export function recoverDatabase(): DatabaseState {
  const base = dbPath()
  const stamp = Date.now()
  for (const suffix of ['', '-wal', '-shm']) {
    const p = base + suffix
    if (fs.existsSync(p)) {
      try {
        fs.renameSync(p, `${p}.corrupt-${stamp}`)
      } catch {
        // keep going — the open attempt below will surface the real error
      }
    }
  }
  dbState = null
  db = null
  return openDatabase()
}

export function getDatabase(): Database.Database {
  if (!db) {
    const state = openDatabase()
    if (state.status !== 'healthy') {
      throw new Error(`数据库不可用：${state.lastError}`)
    }
  }
  return db!
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
  dbState = null
}

/** 测试接缝：把单例指向内存库（vitest only，生产代码不调用） */
export function useInMemoryDatabaseForTest(): void {
  const d = new Database(':memory:')
  d.pragma('journal_mode = WAL')
  d.pragma('foreign_keys = ON')
  runMigrations(d)
  db = d
  dbState = { status: 'healthy', lastError: null, backupAvailable: false }
}
