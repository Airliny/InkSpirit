/**
 * Presence Budget —— 存在感预算。
 *
 * 生命感来自稀缺，不是频繁。即使反打扰预算没拦住，
 * 身体行为（注视/散步/靠近）也要有每日上限——
 * 用户一天用电脑 10 小时，砚灵不能变成"动画插件"。
 */

export type PresenceAction = 'glance' | 'wander' | 'attention'

export const DAILY_BUDGETS: Record<PresenceAction, number> = {
  glance: 300,    // 主动注视（偶尔偷看）—— 一天最多这么多次
  wander: 30,     // 主动散步（walk 行为）—— 频繁走动会成动画插件
  attention: 60   // 主动注意脉冲（气泡前的看向）
}

/** 语境调制：用户长期不在时预算降低——安静是亲密，不是更积极 */
export interface PresenceContext {
  /** 用户是否在场（近期有活动） */
  userPresent: boolean
}

export const PRESENCE_CONTEXT_MODIFIERS: Record<PresenceAction, (ctx: PresenceContext) => number> = {
  glance: (ctx) => (ctx.userPresent ? 1 : 0.33),   // 在场 300，离开时 100
  wander: (ctx) => (ctx.userPresent ? 1 : 0.33),   // 在场 30，离开时 10
  attention: (ctx) => (ctx.userPresent ? 1 : 0.5)
}

export interface PresenceBudgetState {
  dateKey: string
  used: Partial<Record<PresenceAction, number>>
}

export function emptyPresenceBudget(dateKey: string): PresenceBudgetState {
  return { dateKey, used: {} }
}

export function dateKeyOf(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 某动作在当前语境下的每日上限 */
export function effectiveBudget(action: PresenceAction, ctx: PresenceContext): number {
  return Math.max(1, Math.round(DAILY_BUDGETS[action] * PRESENCE_CONTEXT_MODIFIERS[action](ctx)))
}

/**
 * 尝试花费一次存在感。预算耗尽返回 false——调用方应静默降级
 * （注视 → 不看；散步 → 发呆），而不是显得更急。
 * 跨天自动重置；用户长期不在时预算收紧（真正亲密的人也知道什么时候安静）。
 */
export function spendPresence(
  state: PresenceBudgetState,
  action: PresenceAction,
  now: number,
  ctx: PresenceContext = { userPresent: true }
): { state: PresenceBudgetState; allowed: boolean } {
  const dateKey = dateKeyOf(now)
  if (state.dateKey !== dateKey) {
    state = emptyPresenceBudget(dateKey)
  }
  const used = state.used[action] ?? 0
  if (used >= effectiveBudget(action, ctx)) {
    return { state, allowed: false }
  }
  return {
    state: { dateKey, used: { ...state.used, [action]: used + 1 } },
    allowed: true
  }
}

/** 今日已用占比 0-1（设置页/调试用） */
export function presenceUsage(state: PresenceBudgetState, action: PresenceAction, ctx: PresenceContext = { userPresent: true }): number {
  return Math.min(1, (state.used[action] ?? 0) / effectiveBudget(action, ctx))
}
