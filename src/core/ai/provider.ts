export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'memory'
  content: string
}

export interface AIProviderConfig {
  id: string
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama'
  apiKey: string
  baseUrl?: string
  model: string
  maxTokens: number
  temperature: number
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
