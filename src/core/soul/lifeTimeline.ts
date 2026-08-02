import { getDatabase } from '../database'
import { uuidv4 } from '../utils'

/**
 * Life Timeline —— 砚灵的成长经历。
 *
 * 不是聊天记录，不是行为日志：是精心挑选的里程碑事件——
 * 「第一次换身体」「第一次知道主人喜欢咖啡」「第一次提醒休息」。
 * 这些构成它的"过去"，导出时是 Soul Archive 的一部分。
 *
 * 事件分级（防止多年后时间线垃圾化）：
 *   major  必须保存 —— 命名/换身体/关系升级/灵魂恢复/诞生
 *   normal 有限保存 —— 提醒休息/首次聊天/记忆留存（定期清理，保留最近 200 条/365 天）
 *   noise  绝不写入 —— 普通聊天/触摸/表情
 */

export type LifeEventType =
  | 'soul_created'    // 砚灵诞生
  | 'body_changed'    // 第一次换身体
  | 'named'           // 被赋予名字
  | 'first_chat'      // 第一次对话
  | 'rest_reminder'   // 主动提醒休息
  | 'stage_grow'      // 关系升级
  | 'soul_restored'   // 灵魂恢复（备份恢复）
  | 'soul_archived'   // 灵魂归档（导出）
  | 'memory_kept'     // 第一次记住重要的事
  | 'milestone'       // 其他里程碑

export type LifeEventLevel = 'major' | 'normal'

/** normal 级事件的保留策略：保留最近 200 条，且不超过 365 天 */
export const NORMAL_RETAIN = 200
export const NORMAL_RETAIN_DAYS = 365

export interface LifeEvent {
  id: string
  eventType: LifeEventType
  title: string
  detail: string | null
  createdAt: number
  level: LifeEventLevel
}

export const LIFE_EVENT_ICONS: Record<LifeEventType, string> = {
  soul_created: '✨',
  body_changed: '🔄',
  named: '📛',
  first_chat: '💬',
  rest_reminder: '☕',
  stage_grow: '🌱',
  soul_restored: '📦',
  soul_archived: '📤',
  memory_kept: '💎',
  milestone: '⭐'
}

/** 记录一条生命事件；同类事件可去重（如休息提醒每天只记一次） */
export function recordLifeEvent(
  eventType: LifeEventType,
  title: string,
  detail?: string | null,
  dedupeKey?: string,
  level: LifeEventLevel = 'normal'
): LifeEvent {
  const event: LifeEvent = {
    id: dedupeKey ?? uuidv4(),
    eventType,
    title,
    detail: detail ?? null,
    createdAt: Date.now(),
    level
  }
  const db = getDatabase()
  db.prepare(
    'INSERT OR IGNORE INTO life_events (id, event_type, title, detail, created_at, level) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(event.id, event.eventType, event.title, event.detail, event.createdAt, event.level)
  return event
}

export function getLifeEvents(limit = 100, since = 0): LifeEvent[] {
  try {
    const db = getDatabase()
    const rows = db.prepare(
      'SELECT id, event_type, title, detail, created_at, level FROM life_events WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?'
    ).all(since, limit) as {
      id: string; event_type: string; title: string; detail: string | null; created_at: number; level: string
    }[]
    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type as LifeEventType,
      title: r.title,
      detail: r.detail,
      createdAt: r.created_at,
      level: (r.level ?? 'major') as LifeEventLevel
    }))
  } catch {
    return []
  }
}

/** 今天的事件（砚灵日志 · 今天） */
export function getTodayLifeEvents(now = Date.now()): LifeEvent[] {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  return getLifeEvents(200, startOfDay.getTime())
}

/** 首次事件是否已记录（供"第一次"钩子去重） */
export function hasLifeEvent(eventType: LifeEventType): boolean {
  try {
    const db = getDatabase()
    const row = db.prepare('SELECT COUNT(*) as c FROM life_events WHERE event_type = ?').get(eventType) as { c: number }
    return row.c > 0
  } catch {
    return false
  }
}

/**
 * 清理 normal 级事件：major 永久保留；normal 保留最近 NORMAL_RETAIN 条且不超过
 * NORMAL_RETAIN_DAYS 天。返回清理条数。由维护循环调用。
 */
export function pruneLifeEvents(now = Date.now()): number {
  try {
    const db = getDatabase()
    const cutoff = now - NORMAL_RETAIN_DAYS * 24 * 60 * 60 * 1000
    const removed = db.prepare(
      "DELETE FROM life_events WHERE level = 'normal' AND (created_at < ? OR id NOT IN (SELECT id FROM life_events WHERE level = 'normal' ORDER BY created_at DESC LIMIT ?))"
    ).run(cutoff, NORMAL_RETAIN).changes
    return removed
  } catch {
    return 0
  }
}
