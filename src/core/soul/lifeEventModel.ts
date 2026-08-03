/**
 * Life Timeline —— 砚灵的成长经历（纯模型，无数据库依赖）。
 *
 * 不是聊天记录，不是行为日志：是精心挑选的里程碑事件——
 * 「第一次换身体」「第一次知道主人喜欢咖啡」「第一次提醒休息」。
 * 这些构成它的"过去"，导出时是 Soul Archive 的一部分。
 *
 * 本文件只含类型与常量 —— 渲染进程可以直接导入（不携带数据库代码）。
 * 数据库读写（recordLifeEvent/getLifeEvents…）在 lifeTimeline.ts 中。
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
