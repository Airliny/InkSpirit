export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'memory'
  content: string
}

export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'custom'

export const PROVIDER_DEFAULTS: Record<AIProvider, { baseUrl: string; defaultModel: string }> = {
  openai:    { baseUrl: '',                              defaultModel: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com',     defaultModel: 'claude-sonnet-4-20250514' },
  deepseek:  { baseUrl: 'https://api.deepseek.com',      defaultModel: 'deepseek-chat' },
  ollama:    { baseUrl: 'http://localhost:11434/v1',     defaultModel: 'llama3' },
  custom:    { baseUrl: '',                              defaultModel: '' }
}

/** 自定义 API 必须由用户提供完整配置（地址/Key/模型），无官方默认值 */
export function isCustomProvider(p: AIProvider): boolean {
  return p === 'custom'
}

export interface ChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

export interface IAIClient {
  readonly config: AIProviderConfig
  chat(messages: ChatMessage[]): Promise<ChatResponse>
  streamChat(messages: ChatMessage[]): AsyncGenerator<string, void, unknown>
  healthCheck(): Promise<boolean>
}

export interface AIProviderConfig {
  id: string
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  model: string
  maxTokens: number
  temperature: number
}

export { OpenAIProvider } from './openai'
export { AnthropicProvider } from './anthropic'
