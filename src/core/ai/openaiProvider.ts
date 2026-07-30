import OpenAI from 'openai'
import { IAIClient, AIProviderConfig, ChatMessage, ChatResponse } from './provider'

export class OpenAIProvider implements IAIClient {
  public readonly config: AIProviderConfig
  private client: OpenAI

  constructor(config: AIProviderConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined
    })
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role === 'memory' ? 'system' : m.role,
        content: m.content
      })),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    })

    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens
          }
        : undefined
    }
  }

  async *streamChat(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role === 'memory' ? 'system' : m.role,
        content: m.content
      })),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }
}
