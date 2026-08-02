import type { AIProvider } from './ai/types'
import { PROVIDER_DEFAULTS } from './ai/types'

/**
 * Brain Profile —— 大脑能力模型。
 *
 * 「砚灵的大脑」不是模型管理器：普通用户看到的是
 * 能力条（对话/代码/推理/速度）+ 名字，永远不出现
 * temperature / context length / token 这些参数。
 * 高级用户展开后才有参数。
 */

export interface BrainCapabilities {
  /** 对话能力 0-1 */
  chat: number
  /** 代码能力 0-1 */
  code: number
  /** 推理能力 0-1 */
  reasoning: number
  /** 响应速度 0-1（快 = 高） */
  speed: number
}

export interface BrainProfile {
  provider: AIProvider
  model: string
  /** 人类可读的大脑名（如「DeepSeek · 通用推理」） */
  name: string
  capabilities: BrainCapabilities
  /** 上下文长度（展示用，K 为单位） */
  contextK: number
  /** 当前温度（高级设置可调） */
  temperature: number
  /** 端点（本地/自定义显示） */
  endpoint: string
  /** 是否本地大脑（离线可用） */
  isLocal: boolean
}

const PROVIDER_NAME: Record<AIProvider, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  deepseek: 'DeepSeek',
  custom: '自定义大脑',
  ollama: '本地大脑'
}

/** Provider 级能力基线 */
const PROVIDER_BASE: Record<AIProvider, BrainCapabilities> = {
  openai: { chat: 0.85, code: 0.8, reasoning: 0.75, speed: 0.9 },
  anthropic: { chat: 0.9, code: 0.95, reasoning: 0.9, speed: 0.75 },
  deepseek: { chat: 0.8, code: 0.85, reasoning: 0.9, speed: 0.85 },
  custom: { chat: 0.7, code: 0.7, reasoning: 0.7, speed: 0.7 },
  ollama: { chat: 0.7, code: 0.65, reasoning: 0.65, speed: 0.8 }
}

/** 上下文默认（K 单位，展示用近似值） */
const PROVIDER_CONTEXT_K: Record<AIProvider, number> = {
  openai: 128,
  anthropic: 200,
  deepseek: 128,
  custom: 128,
  ollama: 32
}

const PROVIDER_TEMPERATURE_DEFAULT: Record<AIProvider, number> = {
  openai: 0.8,
  anthropic: 0.8,
  deepseek: 0.8,
  custom: 0.8,
  ollama: 0.8
}

/** 模型家族启发式：按模型名微调能力（增量为 ±，本地模型按规模） */
function modelModifier(model: string): Partial<BrainCapabilities> {
  const m = model.toLowerCase()
  if (m.includes('r1') || m.includes('reason') || m.includes('thinking')) {
    return { reasoning: 0.15, chat: 0.05, speed: -0.15 }
  }
  if (m.includes('coder') || m.includes('code') || m.includes('deepseek-v3') || m.includes('v3')) {
    return { code: 0.12, reasoning: 0.12 }
  }
  if (m.includes('qwen')) {
    return { chat: 0.05, code: -0.05, reasoning: -0.05 }
  }
  if (m.includes('llama') || m.includes('mistral')) {
    return { chat: 0.05, code: -0.05, reasoning: -0.05, speed: -0.05 }
  }
  if (m.includes('gpt-4o') || m.includes('gpt-4')) {
    return { chat: 0.08, code: 0.08, reasoning: 0.12 }
  }
  if (m.includes('gpt-') || m.includes('o3') || m.includes('o4')) {
    return { reasoning: 0.15, speed: -0.05 }
  }
  if (m.includes('claude')) {
    return { chat: 0.05, code: 0.05, reasoning: 0.05 }
  }
  return {}
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** 从 Provider + 模型构造大脑画像 */
export function buildBrainProfile(
  provider: AIProvider,
  model: string,
  temperatureOverride?: number
): BrainProfile {
  const base = PROVIDER_BASE[provider] ?? PROVIDER_BASE.custom
  const mod = modelModifier(model)
  const capabilities: BrainCapabilities = {
    chat: clamp01(base.chat + (mod.chat ?? 0) * 0.3),
    code: clamp01(base.code + (mod.code ?? 0) * 0.3),
    reasoning: clamp01(base.reasoning + (mod.reasoning ?? 0) * 0.3),
    speed: clamp01(base.speed + (mod.speed ?? 0) * 0.3)
  }

  const isLocal = provider === 'ollama'
  const modelName = model || PROVIDER_DEFAULTS[provider]?.defaultModel || '未配置'
  const name = isLocal
    ? `本地 · ${modelName}`
    : `${PROVIDER_NAME[provider]} · ${modelName}`

  return {
    provider,
    model: modelName,
    name,
    capabilities,
    contextK: PROVIDER_CONTEXT_K[provider] ?? 128,
    temperature: temperatureOverride ?? PROVIDER_TEMPERATURE_DEFAULT[provider] ?? 0.8,
    endpoint: PROVIDER_DEFAULTS[provider]?.baseUrl ?? '',
    isLocal
  }
}

/** 能力条人类化标签（0-1 → 5 段） */
export function capabilityMeter(v: number): number {
  return Math.max(0, Math.min(5, Math.round(v * 5)))
}

/** 本地大脑按硬件推荐安装时的能力预估 */
export function localBrainCapabilities(parameterB: number): BrainCapabilities {
  // 规模越大越强但越慢（约 0-8B/9-30B/30B+ 三档）
  if (parameterB >= 30) return { chat: 0.9, code: 0.85, reasoning: 0.85, speed: 0.55 }
  if (parameterB >= 9) return { chat: 0.85, code: 0.78, reasoning: 0.78, speed: 0.7 }
  return { chat: 0.75, code: 0.65, reasoning: 0.62, speed: 0.85 }
}
