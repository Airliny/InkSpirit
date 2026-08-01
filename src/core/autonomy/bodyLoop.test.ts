import { describe, it, expect } from 'vitest'
import { pickIdleAnimation, pickAmbientThought, BODY_LOOP_ANIMATIONS } from './bodyLoop'

describe('身体循环边界 — 不产生任何说话/表情', () => {
  it('输出只能是身体循环动画集合', () => {
    for (let i = 0; i < 100; i++) {
      const a = pickIdleAnimation(i / 100, Math.random())
      expect(BODY_LOOP_ANIMATIONS).toContain(a)
    }
  })

  it('低能量倾向 sit/sleep，高能量倾向走/看', () => {
    const low = pickIdleAnimation(0.1, 0.8)
    const high = pickIdleAnimation(0.9, 0.1)
    expect(['sit', 'sleep', 'yawn', 'blink']).toContain(low)
    expect(['stretch', 'walk', 'look_around']).toContain(high)
  })

  it('环境独白是可有可无的（null 或纯想法文本）', () => {
    const none = pickAmbientThought(0, 0.5)
    expect(none).toBeNull()
    const some = pickAmbientThought(1, 0)
    expect(some).toMatch(/^（.+）$/)
  })
})
