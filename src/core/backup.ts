import Database from 'better-sqlite3'
import { createHash } from 'crypto'
import { LATEST_SCHEMA_VERSION } from './migrations'

/**
 * Backup system — the backup is a COMPLETE life-state snapshot, not app data.
 * Pure logic over better-sqlite3: no electron, fully testable.
 *
 * On-disk format (directory, so future assets like avatar configs or memory
 * embeddings can be added without breaking migration):
 *   inkspirit-backup-<ts>/
 *   ├── manifest.json     { format, formatVersion, appVersion, schemaVersion,
 *   │                       soulVersion, createdAt, checksum }
 *   ├── soul.json         { tables: { <table>: rows[] } }  ← the soul
 *   └── avatars/          (optional user assets)
 *
 * manifest.checksum = sha256 of the soul.json payload, so tampering with the
 * soul is always detected. Legacy single-file backups (backup.json with an
 * embedded manifest, or the pre-manifest {app,version,data} shape) remain
 * readable.
 */

export const BACKUP_FORMAT = 'inkspirit-backup'
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_MANIFEST_FILE = 'manifest.json'
export const BACKUP_SOUL_FILE = 'soul.json'
export const BACKUP_LEGACY_FILE = 'backup.json'

/** Every soul table — restoring must never leave "body back, soul gone" */
export const BACKUP_TABLES = [
  'conversations',
  'emotion_snapshots',
  'personalities',
  'personality_evolution_log',
  'relationships',
  'relationship_change_log',
  'memories',
  'identity_events',
  'behavior_logs',
  'daily_patterns'
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  appVersion: string
  schemaVersion: number
  soulVersion: number
  createdAt: number
  checksum: string
}

export interface BackupFile {
  manifest: BackupManifest
  tables: Record<string, Record<string, unknown>[]>
}

export interface BackupOptions {
  appVersion: string
  soulVersion: number
  createdAt?: number
}

export interface RestoreOptions {
  /** secrets (machine-bound API keys) preserved from the live DB */
  preserveConfig?: { key: string; value: string; updated_at: number }[]
  /** legacy backups carry no checksum */
  requireChecksum?: boolean
}

export interface RestoreResult {
  tables: Record<string, number>
  skippedUnknown: string[]
}

export function checksumOf(tables: Record<string, unknown>): string {
  // Deterministic: JSON.stringify of an insertion-ordered object
  return createHash('sha256').update(JSON.stringify(tables)).digest('hex')
}

/**
 * Build a complete life-state snapshot from a database.
 * Reads everything inside one transaction → consistent snapshot.
 */
export function buildBackup(db: Database.Database, opts: BackupOptions): BackupFile {
  const tables: Record<string, Record<string, unknown>[]> = {}
  db.transaction(() => {
    for (const table of BACKUP_TABLES) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
      tables[table] = rows
    }
    // Secrets are machine-bound (DPAPI/Keychain) — never exported
    const config = db.prepare("SELECT key, value, updated_at FROM config WHERE key NOT LIKE 'sec_%'").all() as Record<string, unknown>[]
    tables.config = config
  })()

  return {
    manifest: {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: opts.appVersion,
      schemaVersion: LATEST_SCHEMA_VERSION,
      soulVersion: opts.soulVersion,
      createdAt: opts.createdAt ?? Date.now(),
      checksum: checksumOf(tables)
    },
    tables
  }
}

const ALLOWED_TABLES = new Set<string>([...BACKUP_TABLES, 'config'])

/** Returns an error message, or null when the backup is valid */
export function validateBackup(file: BackupFile, opts: RestoreOptions = {}): string | null {
  const m = file?.manifest
  if (!m || m.format !== BACKUP_FORMAT) return '不是有效的砚灵备份文件'
  if (m.formatVersion !== BACKUP_FORMAT_VERSION) return `不支持的备份格式版本：${m.formatVersion}`
  if (m.schemaVersion > LATEST_SCHEMA_VERSION) {
    return `备份来自更新版本的砚灵（schema ${m.schemaVersion} > 当前 ${LATEST_SCHEMA_VERSION}），请先升级应用`
  }
  // Structural checks first — a tampered file must fail on structure,
  // not merely on checksum, so the real problem is surfaced
  if (!file.tables || typeof file.tables !== 'object') return '备份缺少数据内容'
  for (const table of Object.keys(file.tables)) {
    if (!ALLOWED_TABLES.has(table)) return `备份包含未知表：${table}`
    if (!Array.isArray(file.tables[table])) return `备份表 ${table} 格式错误`
  }
  if (opts.requireChecksum !== false) {
    if (!m.checksum) return '备份缺少完整性校验（checksum）'
    const actual = checksumOf(file.tables)
    if (actual !== m.checksum) return '备份文件已损坏（checksum 不匹配）'
  }
  return null
}

/**
 * Restore a backup into a database (transactional).
 * Only the intersection of backup-row columns and the target schema is
 * inserted — older backups migrate, newer columns get schema defaults.
 */
export function restoreInto(db: Database.Database, file: BackupFile, opts: RestoreOptions = {}): RestoreResult {
  const error = validateBackup(file, opts)
  if (error) throw new Error(error)

  const skippedUnknown: string[] = []
  const counts: Record<string, number> = {}

  const insertTable = db.transaction(() => {
    for (const [table, rows] of Object.entries(file.tables)) {
      if (table === 'config') continue
      const targetCols = tableColumns(db, table)
      db.prepare(`DELETE FROM ${table}`).run()

      let inserted = 0
      for (const row of rows) {
        const cols = targetCols.filter((c) => c in row)
        if (cols.length === 0) {
          skippedUnknown.push(table)
          continue
        }
        const placeholders = cols.map(() => '?').join(', ')
        db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map((c) => row[c] ?? null))
        inserted++
      }
      counts[table] = inserted
    }

    // Config: replace with backup config, then re-inject preserved secrets
    const targetCols = tableColumns(db, 'config')
    db.prepare('DELETE FROM config').run()
    const cfgRows = file.tables.config ?? []
    for (const row of cfgRows) {
      const cols = targetCols.filter((c) => c in row)
      const placeholders = cols.map(() => '?').join(', ')
      db.prepare(`INSERT INTO config (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map((c) => row[c] ?? null))
    }
    for (const sec of opts.preserveConfig ?? []) {
      db.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)').run(sec.key, sec.value, sec.updated_at)
    }
  })

  insertTable()
  return { tables: counts, skippedUnknown }
}

function tableColumns(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[]
  return rows.map((r) => r.name)
}
