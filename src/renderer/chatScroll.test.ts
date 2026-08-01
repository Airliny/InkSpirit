import { describe, it, expect } from 'vitest'
import {
  captureScroll,
  isNearBottom,
  restoreScroll,
  saveChatScroll,
  getSavedChatScroll,
  FOLLOW_THRESHOLD_PX,
  type ChatScrollState
} from './chatScroll'

const el = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 }

describe('captureScroll', () => {
  it('计算 distanceFromBottom 与 wasFollowingLatest（阈值 80px）', () => {
    expect(captureScroll({ ...el, scrollTop: 580 })).toEqual({
      scrollTop: 580,
      distanceFromBottom: 20,
      wasFollowingLatest: true
    })
    // 用户在看历史：底部距离远超阈值
    expect(captureScroll({ ...el, scrollTop: 100 })).toEqual({
      scrollTop: 100,
      distanceFromBottom: 500,
      wasFollowingLatest: false
    })
  })

  it('阈值边界：79px 跟随，80px 不跟随', () => {
    expect(captureScroll({ scrollTop: 1000 - 400 - 79, scrollHeight: 1000, clientHeight: 400 }).wasFollowingLatest).toBe(true)
    expect(captureScroll({ scrollTop: 1000 - 400 - 80, scrollHeight: 1000, clientHeight: 400 }).wasFollowingLatest).toBe(false)
    expect(FOLLOW_THRESHOLD_PX).toBe(80)
  })
})

describe('isNearBottom（新消息跟随判定）', () => {
  it('接近底部 → true，否则 false', () => {
    expect(isNearBottom({ ...el, scrollTop: 560 })).toBe(true)
    expect(isNearBottom({ ...el, scrollTop: 400 })).toBe(false)
  })
})

describe('restoreScroll', () => {
  it('情况 A：之前在底部附近 → 自动定位最新（拉到底）', () => {
    const target = { ...el, scrollTop: 0 }
    restoreScroll(target, { scrollTop: 580, distanceFromBottom: 20, wasFollowingLatest: true })
    expect(target.scrollTop).toBe(1000)
  })

  it('情况 B：在翻历史 → 保留位置，不跳动', () => {
    const target = { ...el, scrollTop: 0 }
    restoreScroll(target, { scrollTop: 200, distanceFromBottom: 400, wasFollowingLatest: false })
    expect(target.scrollTop).toBe(200)
  })

  it('内容变短时 clamp 到最大值，不越界', () => {
    const target = { ...el, scrollHeight: 300, scrollTop: 0 }
    restoreScroll(target, { scrollTop: 2000, distanceFromBottom: 0, wasFollowingLatest: false })
    expect(target.scrollTop).toBe(300)
  })
})

describe('模块级保存（跨 ChatView 挂载）', () => {
  it('保存后可取回', () => {
    saveChatScroll({ scrollTop: 123, distanceFromBottom: 500, wasFollowingLatest: false } as ChatScrollState)
    expect(getSavedChatScroll()).toEqual({ scrollTop: 123, distanceFromBottom: 500, wasFollowingLatest: false })
    saveChatScroll(null)
    expect(getSavedChatScroll()).toBeNull()
  })
})
