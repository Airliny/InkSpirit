import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'inkspirit.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
