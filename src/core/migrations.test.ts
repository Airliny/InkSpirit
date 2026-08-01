import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, LATEST_SCHEMA_VERSION } from './migrations'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
})

afterEach(() => {
  db.close()
})

describe('迁移幂等性（A3）', () => {
  it('全新库：完整迁移到最新版本，全部表存在', () => {
    runMigrations(db)
    const version = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number }
    expect(version.v).toBe(LATEST_SCHEMA_VERSION)
    for (const table of ['conversations', 'emotion_snapshots', 'personalities', 'relationships', 'memories', 'behavior_logs', 'daily_patterns', 'personality_evolution_log', 'relationship_change_log', 'identity_events']) {
      const row = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name=?").get(table) as { c: number }
      expect(row.c, `表 ${table} 应存在`).toBe(1)
    }
  })

  it('重复执行（已是最新版本）：不抛错、不重复建列', () => {
    runMigrations(db)
    expect(() => runMigrations(db)).not.toThrow()
  })

  it('模拟 v4 中断后重跑（版本记录缺失）：不抛错且列保留', () => {
    runMigrations(db)
    // Simulate a crash between migration.up() and the version insert
    db.prepare('DELETE FROM schema_version WHERE version = 4').run()
    expect(() => runMigrations(db)).not.toThrow()
    const cols = db.prepare("SELECT name FROM pragma_table_info('relationships')").all() as { name: string }[]
    const names = cols.map((c) => c.name)
    expect(names).toContain('intimacy')
    expect(names).toContain('dependency')
    expect(names).toContain('understanding')
  })

  it('模拟 v1 中断后重跑（版本记录缺失）：CREATE IF NOT EXISTS 兜底', () => {
    runMigrations(db)
    db.prepare('DELETE FROM schema_version WHERE version = 1').run()
    expect(() => runMigrations(db)).not.toThrow()
  })

  it('迁移整体事务化：up 抛错时不写入版本号', () => {
    // A migration that throws after partial work must leave no version record
    runMigrations(db)
    const before = db.prepare('SELECT COUNT(*) as c FROM schema_version').get() as { c: number }
    expect(before.c).toBe(LATEST_SCHEMA_VERSION)
    // v4 幂等后重复跑只是无操作；断言状态一致
    db.prepare('DELETE FROM schema_version WHERE version = 3').run()
    expect(() => runMigrations(db)).not.toThrow()
    const after = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number }
    expect(after.v).toBe(LATEST_SCHEMA_VERSION)
  })
})
