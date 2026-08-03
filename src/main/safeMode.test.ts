import { describe, it, expect, beforeEach } from 'vitest'
import { enterSafeMode, isSafeModeActive, resetSafeModeForTest } from './safeMode'

/**
 * Safe mode 主进程持久标志 —— reload 后新渲染进程通过 IPC 查询恢复，
 * 保证「第 2 次崩溃 → safe mode → 重载」后依然处于安全模式（标志不随
 * 渲染进程状态丢失）。纯逻辑模块，无 electron 依赖。
 */

describe('safeMode', () => {
  beforeEach(() => {
    resetSafeModeForTest()
  })

  it('默认非安全模式', () => {
    expect(isSafeModeActive()).toBe(false)
  })

  it('进入后持久生效（模拟渲染进程 reload 后重新查询）', () => {
    enterSafeMode()
    // 渲染进程崩溃/重载不会触碰主进程状态
    expect(isSafeModeActive()).toBe(true)
  })

  it('重启（重置）后恢复非安全模式', () => {
    enterSafeMode()
    resetSafeModeForTest()
    expect(isSafeModeActive()).toBe(false)
  })
})
