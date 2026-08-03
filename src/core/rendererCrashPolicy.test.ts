import { describe, it, expect } from 'vitest'
import {
  decideRendererCrashAction,
  EMPTY_CRASH_STATE,
  type RendererCrashState
} from './rendererCrashPolicy'

const GUARD_MS = 2 * 60 * 1000

describe('decideRendererCrashAction', () => {
  it('第一次崩溃 → reload', () => {
    const { action, nextState } = decideRendererCrashAction(EMPTY_CRASH_STATE, 1000, GUARD_MS)
    expect(action).toBe('reload')
    expect(nextState).toEqual({ count: 1, lastAt: 1000 })
  })

  it('第二次崩溃 → safe mode + reload', () => {
    let state: RendererCrashState = EMPTY_CRASH_STATE
    state = decideRendererCrashAction(state, 1000, GUARD_MS).nextState
    const { action, nextState } = decideRendererCrashAction(state, 5000, GUARD_MS)
    expect(action).toBe('safe-mode-reload')
    expect(nextState).toEqual({ count: 2, lastAt: 5000 })
  })

  it('第三次崩溃 → repair dialog（停止自动恢复）', () => {
    let state: RendererCrashState = EMPTY_CRASH_STATE
    for (let i = 1; i <= 2; i++) {
      state = decideRendererCrashAction(state, i * 1000, GUARD_MS).nextState
    }
    const { action, nextState } = decideRendererCrashAction(state, 3000, GUARD_MS)
    expect(action).toBe('repair-dialog')
    expect(nextState).toEqual({ count: 3, lastAt: 3000 })
  })

  it('第三次之后仍返回 repair dialog（不无限重载）', () => {
    let state: RendererCrashState = EMPTY_CRASH_STATE
    for (let i = 1; i <= 5; i++) {
      state = decideRendererCrashAction(state, i * 1000, GUARD_MS).nextState
    }
    const { action } = decideRendererCrashAction(state, 6000, GUARD_MS)
    expect(action).toBe('repair-dialog')
  })

  it('防循环护栏：间隔超过 guardMs 后计数清零，重新从 reload 开始', () => {
    let state: RendererCrashState = { count: 2, lastAt: 0 }
    const { action, nextState } = decideRendererCrashAction(state, GUARD_MS + 1, GUARD_MS)
    expect(action).toBe('reload')
    expect(nextState.count).toBe(1)
  })

  it('护栏边界：间隔恰好等于 guardMs 仍算同一轮崩溃（不重置）', () => {
    const state: RendererCrashState = { count: 2, lastAt: 0 }
    const { action } = decideRendererCrashAction(state, GUARD_MS, GUARD_MS)
    expect(action).toBe('repair-dialog')
  })
})
