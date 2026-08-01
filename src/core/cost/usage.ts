import { getConfig, setConfig } from '../config'

// Approximate pricing per 1M tokens (USD), for cost estimation
const PRICING: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai:gpt-4o': { input: 2.5, output: 10 },
  'anthropic:claude-sonnet-4-20250514': { input: 3, output: 15 },
  'anthropic:claude-sonnet-4-5': { input: 3, output: 15 },
  'anthropic:claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'deepseek:deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek:deepseek-reasoner': { input: 0.55, output: 2.19 },
  'ollama:': { input: 0, output: 0 }
}

export interface UsageEntry {
  promptTokens: number
  completionTokens: number
  requests: number
  costUsd: number
}

export interface UsageSummary {
  month: string
  entries: Record<string, UsageEntry>
  totalTokens: number
  totalCostUsd: number
  budgetUsd: number
  budgetExceeded: boolean
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getPricing(provider: string, model: string): { input: number; output: number } {
  return PRICING[`${provider}:${model}`] ?? PRICING[`${provider}:`] ?? { input: 0.5, output: 1.5 }
}

/** Estimate tokens from Chinese/English text (~1 token per 1.5 chars average) */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 1.5))
}

export function recordUsage(
  provider: string,
  model: string,
  promptText: string,
  completionText: string
): UsageSummary {
  const promptTokens = estimateTokens(promptText)
  const completionTokens = estimateTokens(completionText)
  const pricing = getPricing(provider, model)
  const costUsd = (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output

  const key = `usage_${provider}_${currentMonth()}`
  const current: UsageEntry = JSON.parse(getConfig(key) ?? 'null') ?? {
    promptTokens: 0, completionTokens: 0, requests: 0, costUsd: 0
  }
  current.promptTokens += promptTokens
  current.completionTokens += completionTokens
  current.requests += 1
  current.costUsd += costUsd
  setConfig(key, JSON.stringify(current))

  return getUsageSummary()
}

export function getUsageSummary(): UsageSummary {
  const month = currentMonth()
  const entries: Record<string, UsageEntry> = {}
  const providers = ['openai', 'anthropic', 'deepseek', 'ollama']
  for (const p of providers) {
    const raw = getConfig(`usage_${p}_${month}`)
    if (raw) {
      entries[p] = JSON.parse(raw) as UsageEntry
    }
  }

  let totalTokens = 0
  let totalCostUsd = 0
  for (const e of Object.values(entries)) {
    totalTokens += e.promptTokens + e.completionTokens
    totalCostUsd += e.costUsd
  }

  const budgetUsd = Number(getConfig('cost_monthly_budget_usd') || 0)
  return {
    month,
    entries,
    totalTokens,
    totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
    budgetUsd,
    budgetExceeded: budgetUsd > 0 && totalCostUsd >= budgetUsd
  }
}

export function setMonthlyBudget(usd: number): void {
  setConfig('cost_monthly_budget_usd', String(Math.max(0, usd)))
}

export function getMonthlyBudget(): number {
  return Number(getConfig('cost_monthly_budget_usd') || 0)
}
