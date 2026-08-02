import { describe, it, expect } from 'vitest'
import { pickActionForExpression, pickBodyAction, resolveBehaviorState, filterBodyLoopAnimations } from './actions'
import {
  BUILTIN_CAPABILITIES,
  SPRITE_CAPABILITIES,
  LIVE2D_CAPABILITIES
} from './bodies'

/** 完全静态的身体：什么都不会 */
const STATIC_CAPS = { look: false, blink: false, sway: false, breath: false, motion: false, expression: false }

describe('BodyAction Registry — 情绪 → 候选动作 → 能力过滤 → 可用动作', () => {
  it('猫（有 tail）：开心 → 摇尾巴（tail_wave 优先于 bounce）', () => {
    const catCaps = { ...SPRITE_CAPABILITIES, tail: true }
    expect(pickBodyAction('happy', catCaps)?.id).toBe('happy_tail')
  })

  it('完全静态的身体：开心 → 没有任何可用动作 → null → idle', () => {
    expect(pickBodyAction('happy', STATIC_CAPS)).toBeNull()
    expect(pickActionForExpression('happy', STATIC_CAPS)).toBe('idle')
  })

  it('精灵图身体（sway/expression）：开心 → 蹦跳；难过 → 蜷缩', () => {
    expect(pickBodyAction('happy', SPRITE_CAPABILITIES)?.id).toBe('happy_bounce')
    expect(pickBodyAction('sad', SPRITE_CAPABILITIES)?.id).toBe('sad_curl')
    expect(pickBodyAction('love', SPRITE_CAPABILITIES)?.id).toBe('love_snuggle')
    expect(pickBodyAction('surprised', SPRITE_CAPABILITIES)?.id).toBe('surprised_jump')
  })

  it('Live2D 身体：tired → 打哈欠（有 motion）；curious → 探头看', () => {
    expect(pickBodyAction('tired', LIVE2D_CAPABILITIES)?.id).toBe('tired_yawn')
    expect(pickBodyAction('curious', LIVE2D_CAPABILITIES)?.id).toBe('curious_lean')
  })

  it('内置砚（有 sway 无 motion/expression）：开心 → 蹦跳（只靠摆动）', () => {
    expect(pickBodyAction('happy', BUILTIN_CAPABILITIES)?.id).toBe('happy_bounce')
  })

  it('未知情绪 → null（绝不崩溃）', () => {
    expect(pickBodyAction('rage', SPRITE_CAPABILITIES)).toBeNull()
  })
})

describe('resolveBehaviorState — 行为按身体能力降级', () => {
  it('有 motion：walk/sit/sleep/stretch/yawn 原样', () => {
    for (const b of ['walk', 'sit', 'sleep', 'stretch', 'yawn']) {
      expect(resolveBehaviorState(b, SPRITE_CAPABILITIES)).toBe(b)
    }
  })

  it('无 motion（内置砚）：walk/sit/sleep 全部降级为 idle', () => {
    for (const b of ['walk', 'sit', 'sleep', 'stretch', 'yawn']) {
      expect(resolveBehaviorState(b, BUILTIN_CAPABILITIES)).toBe('idle')
    }
  })

  it('无 blink 的身体收到 blink → idle；Live2D 有 blink → 照做', () => {
    expect(resolveBehaviorState('blink', SPRITE_CAPABILITIES)).toBe('idle')
    expect(resolveBehaviorState('blink', LIVE2D_CAPABILITIES)).toBe('blink')
  })

  it('未知行为 → idle（绝不崩溃）', () => {
    expect(resolveBehaviorState('tail_wave', SPRITE_CAPABILITIES)).toBe('idle')
  })
})

describe('filterBodyLoopAnimations — 身体循环动画池按能力过滤', () => {
  const pool = ['blink', 'look_around', 'idle', 'stretch', 'sit', 'yawn', 'walk', 'sleep']

  it('内置身体：只剩 look_around/idle', () => {
    expect(filterBodyLoopAnimations(pool, BUILTIN_CAPABILITIES)).toEqual(['look_around', 'idle'])
  })

  it('精灵图身体：全保留（除 blink）', () => {
    const filtered = filterBodyLoopAnimations(pool, SPRITE_CAPABILITIES)
    expect(filtered).not.toContain('blink')
    expect(filtered).toContain('walk')
    expect(filtered).toContain('sleep')
  })
})
