import { describe, it, expect } from 'vitest'
import { resolveSpriteUrl } from './modelTypes'
import type { SpriteSource } from '../../../core/avatar/types'

/**
 * Avatar Failure Test（P5）—— 精灵图身体的回退链：
 * 缺图状态自动回退到已有图，全部缺失 → null（渲染层显示内置「砚」）。
 */

const ONE_IDLE: SpriteSource = { idle: 'local://a/idle.png' }

describe('resolveSpriteUrl 回退链', () => {
  it('只有 idle：happy/sad/love/blink 全部回退 idle', () => {
    for (const state of ['happy', 'sad', 'love', 'blink', 'walk', 'sleep'] as const) {
      expect(resolveSpriteUrl({ type: 'sprites', sprites: ONE_IDLE }, state)).toBe('local://a/idle.png')
    }
  })

  it('love 缺失 → 回退 happy → 再回退 idle', () => {
    const sprites: SpriteSource = { idle: 'local://a/idle.png', happy: 'local://a/happy.png' }
    expect(resolveSpriteUrl({ type: 'sprites', sprites }, 'love')).toBe('local://a/happy.png')
    expect(resolveSpriteUrl({ type: 'sprites', sprites }, 'happy')).toBe('local://a/happy.png')
  })

  it('完全无图 → null（渲染层显示内置「砚」，绝不空白）', () => {
    expect(resolveSpriteUrl({ type: 'sprites', sprites: {} }, 'idle')).toBeNull()
  })

  it('未知状态 → 回退 idle', () => {
    expect(resolveSpriteUrl({ type: 'sprites', sprites: ONE_IDLE }, 'dance' as never)).toBe('local://a/idle.png')
  })
})
