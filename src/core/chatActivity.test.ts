import { describe, it, expect } from 'vitest'
import { reduceActivity, isConversational } from './chatActivity'

describe('Test 1 — 完整状态流', () => {
  it('idle → listening → thinking → speaking → afterSpeak → idle', () => {
    let s = reduceActivity('idle', 'user-sent')
    expect(s).toBe('listening')
    s = reduceActivity(s, 'listen-timeout')
    expect(s).toBe('thinking')
    s = reduceActivity(s, 'first-token')
    expect(s).toBe('speaking')
    s = reduceActivity(s, 'completed')
    expect(s).toBe('afterSpeak')
    s = reduceActivity(s, 'after-speak-done')
    expect(s).toBe('idle')
  })
})

describe('Test 2 — AI 失败恢复', () => {
  it('thinking → error → idle（不卡死）', () => {
    let s = reduceActivity('thinking', 'failed')
    expect(s).toBe('error')
    s = reduceActivity(s, 'error-recovered')
    expect(s).toBe('idle')
  })

  it('listening 阶段失败也进 error', () => {
    expect(reduceActivity('listening', 'failed')).toBe('error')
  })

  it('speaking 中途失败进 error', () => {
    expect(reduceActivity('speaking', 'failed')).toBe('error')
  })
})

describe('Test 3 — 慢模型：不永久 thinking', () => {
  it('thinking 超时 → 回到 idle（身体不再假装）', () => {
    expect(reduceActivity('thinking', 'thinking-timeout')).toBe('idle')
  })
})

describe('Test 5 — 流式输出同步', () => {
  it('listening/thinking 状态收到首 token → 立即 speaking', () => {
    expect(reduceActivity('listening', 'first-token')).toBe('speaking')
    expect(reduceActivity('thinking', 'first-token')).toBe('speaking')
  })
})

describe('防御性：状态只反映真实 pipeline', () => {
  it('非法转换保持原状态', () => {
    expect(reduceActivity('idle', 'first-token')).toBe('idle')
    expect(reduceActivity('idle', 'completed')).toBe('idle')
    expect(reduceActivity('afterSpeak', 'user-sent')).toBe('afterSpeak')
    expect(reduceActivity('error', 'completed')).toBe('error')
  })

  it('对话中暂停自主随机动作（isConversational）', () => {
    expect(isConversational('idle')).toBe(false)
    for (const s of ['listening', 'thinking', 'speaking', 'afterSpeak', 'error'] as const) {
      expect(isConversational(s), s).toBe(true)
    }
  })
})
