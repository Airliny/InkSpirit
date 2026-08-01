import { describe, it, expect, vi } from 'vitest'
import { createRendererLifecycle } from './rendererLifecycle'

describe('H2 — WebGL context 生命周期状态机', () => {
  it('init → running；lost → suspend（只一次）；restored → 重新 init', () => {
    const init = vi.fn()
    const suspend = vi.fn()
    const lc = createRendererLifecycle({ init, suspend })

    lc.init()
    expect(lc.phase).toBe('running')
    expect(init).toHaveBeenCalledTimes(1)

    lc.handleContextLost()
    expect(lc.phase).toBe('suspended')
    expect(suspend).toHaveBeenCalledTimes(1)

    // 重复 lost 不重复 suspend
    lc.handleContextLost()
    expect(suspend).toHaveBeenCalledTimes(1)

    lc.handleContextRestored()
    expect(lc.phase).toBe('running')
    expect(init).toHaveBeenCalledTimes(2) // 重建渲染资源

    // 恢复后动画继续（running 可再次渲染）
    lc.handleContextRestored() // 无 lost 的 restored 被忽略
    expect(init).toHaveBeenCalledTimes(2)
  })

  it('dispose 后事件全部忽略（不影响其他状态）', () => {
    const init = vi.fn()
    const lc = createRendererLifecycle({ init, suspend: () => {} })
    lc.init()
    lc.dispose()
    lc.handleContextLost()
    lc.handleContextRestored()
    lc.init()
    expect(init).toHaveBeenCalledTimes(1)
    expect(lc.phase).toBe('disposed')
  })

  it('未 init 时的 lost/restored 不触发处理', () => {
    const init = vi.fn()
    const suspend = vi.fn()
    const lc = createRendererLifecycle({ init, suspend })
    lc.handleContextLost()
    lc.handleContextRestored()
    expect(init).not.toHaveBeenCalled()
    expect(suspend).not.toHaveBeenCalled()
  })
})
