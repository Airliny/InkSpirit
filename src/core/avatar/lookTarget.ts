/**
 * 视线跟随（lookAt）——「偶尔偷看，不一直跟」。
 * 鼠标靠近时偶尔看过去，看一会儿就移开；远了就完全忽略。
 * 纯函数 + 显式状态，可单测。
 */

export interface CursorInfo {
  /** 相对桌宠中心的偏移（px，DIP） */
  x: number
  y: number
  /** 主进程已判定在附近（避免渲染层重复算距离） */
  near: boolean
}

export interface LookControl {
  /** 当前是否在看 */
  active: boolean
  /** 这次"偷看"持续到什么时候 */
  until: number
  /** 视线方向（-1..1） */
  x: number
  y: number
}

export const LOOK_RADIUS = 260

export function emptyLookControl(): LookControl {
  return { active: false, until: 0, x: 0, y: 0 }
}

/**
 * 每次游标事件调用。lookFrequency（0-1）来自 BodyState：情绪好/对话中更常看。
 * glanceChance 是每次事件开启一次偷看的概率，事件约 5Hz。
 */
export function updateLook(
  cursor: CursorInfo | null,
  control: LookControl,
  now: number,
  lookFrequency: number,
  rand: () => number = Math.random,
  radius: number = LOOK_RADIUS
): LookControl {
  const near = !!cursor && cursor.near && Math.hypot(cursor.x, cursor.y) <= radius
  if (!near || lookFrequency <= 0) {
    return { active: false, until: 0, x: 0, y: 0 }
  }
  const c = cursor!

  if (control.active && now < control.until) {
    // 正在偷看：方向跟随鼠标
    return { active: true, until: control.until, ...direction(c, radius) }
  }

  // 不常看：概率开启一次短暂注视（频率越高越常看）
  const glanceChance = 0.06 + lookFrequency * 0.16
  if (rand() >= glanceChance) {
    return { active: false, until: 0, x: 0, y: 0 }
  }

  const glanceMs = 900 + lookFrequency * 1600
  return { active: true, until: now + glanceMs, ...direction(c, radius) }
}

/** 距离越近看得越"用力"，方向归一化到 -1..1 */
function direction(c: CursorInfo, radius: number): { x: number; y: number } {
  const dist = Math.hypot(c.x, c.y) || 1
  const strength = Math.max(0.25, 1 - dist / radius)
  const x = clamp(-1, 1, (c.x / dist) * Math.min(1, Math.abs(c.x) / radius) * strength)
  const y = clamp(-1, 1, (c.y / dist) * Math.min(1, Math.abs(c.y) / radius) * strength)
  return { x, y }
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v))
}
