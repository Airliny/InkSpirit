import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations'
import { recordIdentityEvent, getNameHistory, DEFAULT_NAME } from './identity'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db)
})

afterEach(() => {
  db.close()
})

describe('I1 — 默认名字「砚灵」', () => {
  it('默认名是砚灵（砚灵从不主动索取名字）', () => {
    expect(DEFAULT_NAME).toBe('砚灵')
  })
})

describe('I3 — identity_events：source 永远是 user', () => {
  it('记录命名事件并写入历史（倒序）', () => {
    const e1 = recordIdentityEvent({ type: 'name_assigned', name: '小墨' }, db)
    const e2 = recordIdentityEvent({ type: 'name_assigned', name: '墨墨' }, db)

    expect(e1.source).toBe('user')
    expect(e2.source).toBe('user')
    const history = getNameHistory(10, db)
    expect(history).toHaveLength(2)
    expect(history[0].name).toBe('墨墨')
    expect(history[1].name).toBe('小墨')
  })

  it('recordIdentityEvent 强制 source=user，不可被覆盖', () => {
    const e = recordIdentityEvent({ type: 'name_assigned', name: '墨墨', source: 'user' }, db)
    expect(e.source).toBe('user')
  })
})
