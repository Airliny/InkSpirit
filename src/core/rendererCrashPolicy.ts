/**
 * Renderer crash recovery policy — pure state machine.
 *
 * 第 1 次崩溃 → reload（自动重载）
 * 第 2 次崩溃 → safe mode + reload（只渲染内置「砚」，不加载重资产）
 * 第 3 次崩溃 → repair dialog（停止自动恢复，给出修复路径）
 *
 * 防循环护栏：超过 guardMs 没有崩溃则计数清零。
 * 纯逻辑，无 electron 依赖，可完整单测。
 */

export type RendererCrashAction = 'reload' | 'safe-mode-reload' | 'repair-dialog'

export interface RendererCrashState {
  count: number
  lastAt: number
}

export const EMPTY_CRASH_STATE: RendererCrashState = { count: 0, lastAt: 0 }

export function decideRendererCrashAction(
  state: RendererCrashState,
  now: number,
  guardMs: number
): { action: RendererCrashAction; nextState: RendererCrashState } {
  const count = now - state.lastAt > guardMs ? 0 : state.count
  const nextCount = count + 1
  const nextState: RendererCrashState = { count: nextCount, lastAt: now }

  if (nextCount === 1) return { action: 'reload', nextState }
  if (nextCount === 2) return { action: 'safe-mode-reload', nextState }
  return { action: 'repair-dialog', nextState }
}
