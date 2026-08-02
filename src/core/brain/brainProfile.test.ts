import { describe, it, expect } from 'vitest'
import {
  buildBrainProfile,
  capabilityMeter,
  localBrainCapabilities
} from './brainProfile'

describe('Brain Profile — 砚灵的大脑（能力条而非参数）', () => {
  it('GPT 默认均衡偏快', () => {
    const p = buildBrainProfile('openai', 'gpt-4o')
    expect(p.capabilities.chat).toBeGreaterThan(0.7)
    expect(p.capabilities.speed).toBeGreaterThan(0.7)
    expect(p.contextK).toBe(128)
  })

  it('Claude 代码能力突出', () => {
    const p = buildBrainProfile('anthropic', 'claude-sonnet-4')
    expect(p.capabilities.code).toBeGreaterThan(0.9)
    expect(p.contextK).toBe(200)
  })

  it('DeepSeek 推理能力突出', () => {
    const p = buildBrainProfile('deepseek', 'deepseek-chat')
    expect(p.capabilities.reasoning).toBeGreaterThan(0.85)
  })

  it('R1 类推理模型：推理拉满、速度下降', () => {
    const p = buildBrainProfile('deepseek', 'deepseek-r1')
    expect(p.capabilities.reasoning).toBeGreaterThan(0.9)
    expect(p.capabilities.speed).toBeLessThan(0.85)
  })

  it('本地大脑：人类化名称 + isLocal', () => {
    const p = buildBrainProfile('ollama', 'qwen2.5:14b')
    expect(p.isLocal).toBe(true)
    expect(p.name).toContain('本地')
    expect(p.name).toContain('qwen2.5:14b')
  })

  it('能力条映射 0-1 → 5 段', () => {
    expect(capabilityMeter(1)).toBe(5)
    expect(capabilityMeter(0)).toBe(0)
    expect(capabilityMeter(0.3)).toBe(2)
    expect(capabilityMeter(0.7)).toBe(4)
  })

  it('温度：无覆盖用默认，有覆盖用覆盖', () => {
    expect(buildBrainProfile('deepseek', 'deepseek-chat').temperature).toBe(0.8)
    expect(buildBrainProfile('deepseek', 'deepseek-chat', 0.4).temperature).toBe(0.4)
  })

  it('未配置模型 → 名字提示未配置，不崩溃', () => {
    const p = buildBrainProfile('custom', '')
    expect(p.name).toContain('未配置')
    expect(p.capabilities.chat).toBeGreaterThan(0)
  })
})

describe('本地大脑能力预估（按参数规模）', () => {
  it('越大越强但越慢', () => {
    const small = localBrainCapabilities(7)
    const big = localBrainCapabilities(70)
    expect(big.reasoning).toBeGreaterThan(small.reasoning)
    expect(big.speed).toBeLessThan(small.speed)
  })
})
