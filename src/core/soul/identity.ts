import type Database from 'better-sqlite3'
import { getDatabase } from '../database'
import { getConfig, setConfig } from '../config'
import { addMemory } from './memory'
import { uuidv4 } from '../utils'

/**
 * Identity — 身份连续性的数字生命。
 *
 * 命名原则：名字是用户赋予的，不是砚灵索取的。
 * - 默认名字永远是「砚灵」，砚灵从不主动请求命名、从不提醒、从不安排命名任务。
 * - 只有当用户在聊天中自然赋予新称呼时，身份才会改变。
 * - 所有身份事件（identity_events）的 source 永远是 'user'。
 * - 名字存入长期记忆 + 事件历史，换模型 / 换身体 / 备份恢复后保持不变。
 *
 * 纯逻辑 over better-sqlite3：函数接受 db 参数，无 electron，完全可测试。
 */

export const DEFAULT_NAME = '砚灵'

export type IdentityEventType = 'name_assigned'

export interface IdentityEvent {
  id: string
  type: IdentityEventType
  /** 永远为 'user' —— 身份变化只由用户发起 */
  source: 'user'
  name: string
  metadata: Record<string, unknown> | null
  createdAt: number
}

/** 当前名字：用户赋予的名字，未赋予时永远是默认名「砚灵」 */
export function getPetName(): string {
  return getConfig('pet_name') ?? DEFAULT_NAME
}

/** 用户赋予新名字：写入配置、长期记忆，并记录用户行为事件 */
export function assignName(name: string, db: Database.Database = getDatabase()): IdentityEvent {
  setConfig('pet_name', name)
  addMemory(`用户给我起名叫「${name}」`, {
    type: 'semantic',
    importance: 0.9,
    tier: 'long_term',
    tags: ['名字']
  })
  return recordIdentityEvent({ type: 'name_assigned', name }, db)
}

export function recordIdentityEvent(
  event: Omit<IdentityEvent, 'id' | 'source' | 'createdAt' | 'metadata'> &
    { source?: 'user'; metadata?: Record<string, unknown> | null },
  db: Database.Database = getDatabase()
): IdentityEvent {
  const full: IdentityEvent = {
    id: uuidv4(),
    type: event.type,
    source: 'user',
    name: event.name,
    metadata: event.metadata ?? null,
    createdAt: Date.now()
  }
  db.prepare(`
    INSERT INTO identity_events (id, type, source, name, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(full.id, full.type, full.source, full.name, full.metadata ? JSON.stringify(full.metadata) : null, full.createdAt)
  return full
}

/** 名字历史（含修改记录），按时间倒序（同毫秒时按插入顺序） */
export function getNameHistory(limit = 50, db: Database.Database = getDatabase()): IdentityEvent[] {
  const rows = db
    .prepare('SELECT * FROM identity_events ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[]
  return rows.map((row) => ({
    id: row.id as string,
    type: row.type as IdentityEventType,
    source: 'user' as const,
    name: row.name as string,
    metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : null,
    createdAt: row.created_at as number
  }))
}
