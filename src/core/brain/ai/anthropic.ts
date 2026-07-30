import { IAIClient, AIProviderConfig, ChatMessage, ChatResponse } from './types'

export class AnthropicProvider implements IAIClient {
  public readonly config: AIProviderConfig
  private baseUrl: string

  constructor(config: AIProviderConfig) {
    this.config = config
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com'
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const body = this.buildBody(messages, false)
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic error ${res.status}: ${err}`)
    }
    const data = await res.json()
    const content = data.content?.[0]?.text ?? ''
    return {
      content,
      usage: data.usage
        ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens }
        : undefined
    }
  }

  async *streamChat(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const body = this.buildBody(messages, true)
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic error ${res.status}: ${err}`)
    }
    const text = await res.text()
    // Anthropic SSE: each line starts with "data: "
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr) continue
      try {
        const evt = JSON.parse(jsonStr)
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          yield evt.delta.text
        }
      } catch {}
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        })
      })
      return res.ok
    } catch {
      return false
    }
  }

  private buildBody(messages: ChatMessage[], stream: boolean) {
    const systemMsgs: string[] = []
    const chatMsgs: { role: string; content: string }[] = []

    for (const m of messages) {
      if (m.role === 'system' || m.role === 'memory') {
        systemMsgs.push(m.content)
      } else if (m.role === 'user') {
        chatMsgs.push({ role: 'user', content: m.content })
      } else if (m.role === 'assistant') {
        chatMsgs.push({ role: 'assistant', content: m.content })
      }
    }

    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemMsgs.length > 0 ? systemMsgs.join('\n\n') : undefined,
      messages: chatMsgs,
      stream
    }
  }
}
