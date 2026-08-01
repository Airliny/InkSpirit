import { describe, it, expect } from 'vitest'
import {
  needsIdentityAnalysis,
  parseIdentityIntent,
  IDENTITY_KEYWORDS
} from './identityIntent'

describe('I4 — 关键词节流（省成本，不是判断结果）', () => {
  it('含身份相关词的消息才进入 LLM 意图判断', () => {
    expect(needsIdentityAnalysis('以后叫你墨墨吧')).toBe(true)
    expect(needsIdentityAnalysis('我觉得你叫墨墨会更适合一点')).toBe(true)
    expect(needsIdentityAnalysis('你的名字叫什么')).toBe(true)
    expect(needsIdentityAnalysis('帮我改成这个名字')).toBe(true)
  })

  it('不含身份相关词的消息直接走普通管线（零成本）', () => {
    expect(needsIdentityAnalysis('今天天气怎么样')).toBe(false)
    expect(needsIdentityAnalysis('帮我看看这段代码')).toBe(false)
    expect(needsIdentityAnalysis('在吗')).toBe(false)
  })

  it('关键词列表是有意为之的节流词（不是黑名单）', () => {
    expect(IDENTITY_KEYWORDS).toContain('叫')
    expect(IDENTITY_KEYWORDS).toContain('名字')
    expect(IDENTITY_KEYWORDS).toContain('以后')
  })
})

describe('I5 — parseIdentityIntent：LLM 输出 → 结构化意图', () => {
  it('assign_name + 高置信 → 执行改名', () => {
    const i = parseIdentityIntent('{"intent":"assign_name","confidence":0.96,"name":"墨墨"}')
    expect(i.intent).toBe('assign_name')
    expect(i.name).toBe('墨墨')
    expect(i.confidence).toBeCloseTo(0.96)
  })

  it('discuss_name → 不产生事件，继续聊天', () => {
    const i = parseIdentityIntent('{"intent":"discuss_name","confidence":0.8,"name":"墨墨"}')
    expect(i.intent).toBe('discuss_name')
    expect(i.name).toBe('墨墨')
  })

  it('none → 普通聊天（猫叫墨墨不是给砚灵改名）', () => {
    const i = parseIdentityIntent('{"intent":"none","confidence":0.01,"name":null}')
    expect(i.intent).toBe('none')
    expect(i.name).toBeNull()
  })

  it('低置信 assign_name 降级为 none：理解层不能乱改身份', () => {
    const i = parseIdentityIntent('{"intent":"assign_name","confidence":0.3,"name":"墨墨"}')
    expect(i.intent).toBe('none')
  })

  it('容忍 ```json 围栏与多余文字', () => {
    const i = parseIdentityIntent('```json\n{"intent":"assign_name","confidence":0.9,"name":"小墨"}\n```')
    expect(i.intent).toBe('assign_name')
    expect(i.name).toBe('小墨')
  })

  it('非法输出 → none（失败时绝不误改名）', () => {
    expect(parseIdentityIntent('我不是JSON').intent).toBe('none')
    expect(parseIdentityIntent('').intent).toBe('none')
    expect(parseIdentityIntent('{"intent":"hacked","confidence":1}').intent).toBe('none')
    expect(parseIdentityIntent('{"confidence":0.9}').intent).toBe('none')
  })

  it('名字截断到 8 字以内，confidence 收敛到 0-1', () => {
    const i = parseIdentityIntent('{"intent":"assign_name","confidence":2,"name":"一二三四五六七八九十"}')
    expect(i.name).toBe('一二三四五六七八')
    expect(i.confidence).toBe(1)
  })
})
