/**
 * Interaction Quality —— 交互质量（Body Memory v2）。
 *
 * 不是"摸 100 次解锁快乐"的养成计数，而是质量：
 *   高质量：难过时被安慰 / 回应主动行为 / 长期陪伴
 *   低质量：连续疯狂点击（刷次数反而扣分）
 *   过度操作：会表达"有点晕……让我休息一下"
 */

export type InteractionKind = 'touch' | 'comfort' | 'respond' | 'spam'

export const QUALITY_WEIGHTS: Record<InteractionKind, number> = {
  touch: 1,      // 普通轻触
  comfort: 5,    // 在它难过时安慰它
  respond: 4,    // 回应它的主动行为
  spam: -2       // 疯狂连点
}

export const QUALITY_MAX = 100
export const SPAM_BATCH_SIZE = 5      // 一次刷屏 = 5 次连点
export const SPAM_WINDOW_MS = 8000    // 窗口期
export const OVERLOAD_STREAK = 3      // 连续 3 次刷屏 → 过载
/** 安静超过这个时长，刷屏记录清零（休息过了） */
export const QUIET_RESET_MS = 30000

/**
 * Body Memory 边界铁律：身体层只能写这些 config 键（熟悉感），
 * 绝不允许碰爱意/依赖/信任等灵魂键——否则灵魂层和身体层会打架，
 * 变成"摸得越多越喜欢"的游戏宠物养成。
 * bodyMemoryConfigKeys() 供测试锁定这条契约。
 */
export function bodyMemoryConfigKeys(): string[] {
  return ['body_touch_quality']
}

export function applyInteraction(quality: number, kind: InteractionKind): number {
  const next = quality + (QUALITY_WEIGHTS[kind] ?? 0)
  return Math.max(0, Math.min(QUALITY_MAX, next))
}

/** 质量 → 身体期待（comfort 0-1），进 computeBodyState */
export function comfortFromQuality(quality: number): number {
  return Math.max(0, Math.min(1, quality / 50))
}

/** 质量 → 人类可读的阶段 */
export function qualityStage(quality: number): { text: string; tier: 0 | 1 | 2 | 3 } {
  if (quality < 10) return { text: '它还在慢慢认识你的手', tier: 0 }
  if (quality < 40) return { text: '它开始习惯你的触摸了', tier: 1 }
  if (quality < 70) return { text: '它被你摸得很安心，一靠近就期待', tier: 2 }
  return { text: '它已经完全信任你的触碰了', tier: 3 }
}

/**
 * 刷屏检测（纯函数 + 显式时间戳）：
 * 窗口期内达到 batch 次触摸 → 这一批记为 spam。
 * 连续 batch 超过 overloadStreak 次 → 过载（需要休息）。
 */
export interface ClickTrackerState {
  /** 最近一次触摸时间戳 */
  lastAt: number
  /** 当前窗口内的触摸次数 */
  batchCount: number
  /** 连续刷屏批次数 */
  spamStreak: number
}

export function emptyClickTracker(): ClickTrackerState {
  return { lastAt: 0, batchCount: 0, spamStreak: 0 }
}

export function trackClick(
  state: ClickTrackerState,
  now: number,
  windowMs: number = SPAM_WINDOW_MS,
  batchSize: number = SPAM_BATCH_SIZE,
  overloadStreak: number = OVERLOAD_STREAK,
  quietResetMs: number = QUIET_RESET_MS
): { state: ClickTrackerState; batch: InteractionKind; overload: boolean } {
  // 安静超过阈值 → 刷屏记录清零（它休息过了）
  const quiet = now - state.lastAt > quietResetMs
  const withinWindow = now - state.lastAt <= windowMs
  const batchCount = withinWindow ? state.batchCount + 1 : 1
  const spamStreak = quiet ? 0 : state.spamStreak

  if (batchCount >= batchSize) {
    // 这一批是刷屏：扣分，重置窗口，累计过载
    return {
      state: { lastAt: now, batchCount: 0, spamStreak: spamStreak + 1 },
      batch: 'spam',
      overload: spamStreak + 1 >= overloadStreak
    }
  }

  return {
    state: { lastAt: now, batchCount, spamStreak },
    batch: 'touch',
    overload: false
  }
}
