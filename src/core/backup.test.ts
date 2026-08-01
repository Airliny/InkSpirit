import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, LATEST_SCHEMA_VERSION } from './migrations'
import { buildBackup, validateBackup, restoreInto, checksumOf, BACKUP_TABLES, type BackupFile } from './backup'

let db: Database.Database
let fresh: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db)
  fresh = new Database(':memory:')
  runMigrations(fresh)
})

afterEach(() => {
  db.close()
  fresh.close()
})

/** Seed every soul table with one recognizable row */
function seed(d: Database.Database): void {
  // migrations seed defaults first — clear so our rows replace them
  d.prepare('DELETE FROM personalities').run()
  d.prepare('DELETE FROM relationships').run()
  d.prepare('DELETE FROM emotion_snapshots').run()
  d.prepare("DELETE FROM config WHERE key NOT LIKE 'sec_%'").run()
  d.prepare("INSERT INTO personalities (id, version, is_active, traits_json, created_at) VALUES ('p1', 3, 1, '{\"warmth\":0.9}', 100)").run()
  d.prepare("INSERT INTO personality_evolution_log (id, personality_version, trait, before_value, after_value, delta, reason, source, created_at) VALUES ('e1', 3, 'warmth', 0.5, 0.55, 0.05, '用户常表达善意', 'care', 200)").run()
  d.prepare("INSERT INTO relationships (user_id, trust, familiarity, affection, intimacy, dependency, understanding, interaction_count, stage, first_interaction_at, last_interaction_at) VALUES ('default', 0.5, 0.6, 0.4, 0.3, 0.2, 0.7, 42, 'friend', 1, 2)").run()
  d.prepare("INSERT INTO relationship_change_log (id, event_type, intensity, event_source, metadata, before_json, after_json, affected_json, weights_version, created_at) VALUES ('r1', 'deep_share', 1, 'conversation', null, '{}', '{}', '{\"intimacy\":0.01}', 1, 300)").run()
  d.prepare("INSERT INTO memories (id, type, tier, content, importance, created_at) VALUES ('m1', 'semantic', 'long_term', '喜欢黑咖啡', 0.8, 400)").run()
  d.prepare("INSERT INTO daily_patterns (date, hour_bucket, active_minutes) VALUES ('2026-07-31', 22, 45)").run()
  d.prepare("INSERT INTO conversations (id, messages_json, created_at) VALUES ('c1', '[]', 500)").run()
  d.prepare("INSERT INTO behavior_logs (id, behavior_id, triggered_by, outcome, timestamp) VALUES ('b1', 'greet', 'director', '{}', 600)").run()
  d.prepare("INSERT INTO config (key, value, updated_at) VALUES ('pet_name', '小砚', 700)").run()
  d.prepare("INSERT INTO config (key, value, updated_at) VALUES ('sec_deepseek_api_key', 'secret', 800)").run()
}

describe('Test 1 — 完整灵魂快照：备份 → 恢复 → 全量一致', () => {
  it('目录格式往返（manifest.json + soul.json 重组）校验通过且恢复一致', () => {
    seed(db)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 3 })

    // Simulate the on-disk directory format: manifest and soul as separate files
    const manifestJson = JSON.stringify(backup.manifest)
    const soulJson = JSON.stringify(backup.tables)
    const reassembled: BackupFile = {
      manifest: JSON.parse(manifestJson),
      tables: JSON.parse(soulJson)
    }
    // manifest.checksum is over the tables payload — identical to soul.json bytes
    expect(checksumOf(reassembled.tables)).toBe(backup.manifest.checksum)
    expect(validateBackup(reassembled)).toBeNull()

    restoreInto(fresh, reassembled)
    expect(fresh.prepare('SELECT COUNT(*) as c FROM memories').get()).toEqual({ c: 1 })
    expect(fresh.prepare('SELECT COUNT(*) as c FROM daily_patterns').get()).toEqual({ c: 1 })
  })

  it('导出包含全部灵魂表，恢复后数据一致', () => {
    seed(db)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 3 })

    // manifest
    expect(backup.manifest.format).toBe('inkspirit-backup')
    expect(backup.manifest.schemaVersion).toBe(LATEST_SCHEMA_VERSION)
    expect(backup.manifest.soulVersion).toBe(3)
    expect(backup.manifest.checksum.length).toBe(64)
    expect(validateBackup(backup)).toBeNull()

    // secrets never exported
    expect(backup.tables.config.some((r) => String(r.key).startsWith('sec_'))).toBe(false)
    // all soul tables present
    for (const t of BACKUP_TABLES) {
      expect(backup.tables[t], `备份应包含 ${t}`).toBeDefined()
    }

    // restore into a fresh DB → identical
    const result = restoreInto(fresh, backup)
    expect(result.tables.relationships).toBe(1)
    const rel = fresh.prepare('SELECT * FROM relationships').get() as { trust: number; intimacy: number }
    expect(rel.trust).toBe(0.5)
    expect(rel.intimacy).toBe(0.3)
    expect((fresh.prepare("SELECT value FROM config WHERE key='pet_name'").get() as { value: string }).value).toBe('小砚')
    // events/logs restored
    expect(fresh.prepare('SELECT COUNT(*) as c FROM personality_evolution_log').get()).toEqual({ c: 1 })
    expect(fresh.prepare('SELECT COUNT(*) as c FROM relationship_change_log').get()).toEqual({ c: 1 })
    expect(fresh.prepare('SELECT COUNT(*) as c FROM daily_patterns').get()).toEqual({ c: 1 })
  })

  it('恢复报告计数正确（灵魂各表条数可展示）', () => {
    seed(db)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 3 })
    const result = restoreInto(fresh, backup)
    expect(result.tables.personalities).toBe(1)
    expect(result.tables.personality_evolution_log).toBe(1)
    expect(result.tables.relationships).toBe(1)
    expect(result.tables.relationship_change_log).toBe(1)
    expect(result.tables.memories).toBe(1)
    expect(result.tables.daily_patterns).toBe(1)
    expect(result.tables.behavior_logs).toBe(1)
    expect(result.tables.conversations).toBe(1)
  })

  it('恢复时保留本机密钥（preserveConfig）', () => {
    seed(db)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 3 })
    const preserve = [{ key: 'sec_openai_api_key', value: 'live-key', updated_at: 999 }]
    restoreInto(fresh, backup, { preserveConfig: preserve })
    expect((fresh.prepare("SELECT value FROM config WHERE key='sec_openai_api_key'").get() as { value: string }).value).toBe('live-key')
  })
})

describe('Test 2 — 恢复失败保护旧数据', () => {
  it('checksum 损坏 → 校验拒绝，目标库不变', () => {
    seed(fresh)
    seed(db)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 1 })
    ;(backup.tables.memories as Record<string, unknown>[])[0].content = '被篡改'
    expect(validateBackup(backup)).toContain('checksum')
    expect(() => restoreInto(fresh, backup)).toThrow(/checksum/)
    expect(fresh.prepare('SELECT COUNT(*) as c FROM memories').get()).toEqual({ c: 1 })
  })

  it('未知表 → 拒绝', () => {
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 1 })
    backup.tables.hacked = [{ evil: 1 }]
    expect(validateBackup(backup)).toContain('未知表')
  })

  it('新版本备份（schema 超前）→ 拒绝且不写入', () => {
    seed(fresh)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 1 })
    backup.manifest.schemaVersion = LATEST_SCHEMA_VERSION + 1
    backup.manifest.checksum = ''
    expect(validateBackup(backup)).toContain('更新版本')
    expect(fresh.prepare('SELECT COUNT(*) as c FROM personalities').get()).toEqual({ c: 1 })
  })

  it('行数据非法（INSERT 失败）→ 事务整体回滚，目标库不变', () => {
    seed(fresh)
    seed(db)
    const backup = buildBackup(db, { appVersion: '0.2.3', soulVersion: 1 })
    ;(backup.tables.personalities as Record<string, unknown>[]).push({ id: 'bad', version: 'not-a-number' })
    expect(() => restoreInto(fresh, backup)).toThrow()
    // nothing partially restored
    expect(fresh.prepare('SELECT COUNT(*) as c FROM personalities').get()).toEqual({ c: 1 })
    expect(fresh.prepare('SELECT COUNT(*) as c FROM relationships').get()).toEqual({ c: 1 })
  })
})

describe('Test 3 — 旧版本备份可迁移', () => {
  it('schema v1 备份（无新列）恢复到当前 schema：新列用默认值', () => {
    // Simulate an old backup: relationships without intimacy columns
    const legacy = buildBackup(db, { appVersion: '0.1.0', soulVersion: 1 })
    legacy.manifest.schemaVersion = 1
    legacy.manifest.checksum = '' // old backups had no checksum
    ;(legacy.tables.relationships as Record<string, unknown>[]) = [
      { user_id: 'default', trust: 0.2, familiarity: 0.3, affection: 0.1, interaction_count: 5, stage: 'acquaintance', first_interaction_at: 1, last_interaction_at: 2 }
    ]
    // validate: legacy file must pass with requireChecksum: false
    expect(validateBackup(legacy, { requireChecksum: false })).toBeNull()

    const result = restoreInto(fresh, legacy, { requireChecksum: false })
    const rel = fresh.prepare('SELECT * FROM relationships').get() as { intimacy: number; dependency: number; understanding: number }
    expect(rel.intimacy).toBe(0.05) // schema default
    expect(rel.dependency).toBe(0.05)
    expect(rel.understanding).toBe(0.1)
    expect(result.tables.relationships).toBe(1)
  })
})
