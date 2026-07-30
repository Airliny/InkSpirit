import { ChatMessage, IAIClient } from './ai/provider'
import { OpenAIProvider } from './ai/openaiProvider'
import {
  buildSystemPrompt,
  getRecentMemories,
  PromptContext
} from './ai/promptBuilder'
import { getDatabase } from './database'
import { uuidv4 } from './utils'

interface AgentState {
  personalityTraits: Record<string, number>
  emotionState: Record<string, unknown>
  relationshipStage: string
  conversationHistory: ChatMessage[]
  currentConversationId: string | null
}

function createId(): string {
  return uuidv4()
}

export class Agent {
  private aiClient: IAIClient | null = null
  private state: AgentState

  constructor() {
    this.state = this.loadState()
  }

  private loadState(): AgentState {
    const db = getDatabase()
    const personality = db
      .prepare('SELECT traits_json FROM personalities WHERE is_active = 1 ORDER BY version DESC LIMIT 1')
      .get() as { traits_json: string } | undefined

    const emotion = db
      .prepare('SELECT state_json FROM emotion_snapshots ORDER BY timestamp DESC LIMIT 1')
      .get() as { state_json: string } | undefined

    const relationship = db
      .prepare('SELECT stage FROM relationships WHERE user_id = ?')
      .get('default') as { stage: string } | undefined

    return {
      personalityTraits: personality ? JSON.parse(personality.traits_json) : {},
      emotionState: emotion ? JSON.parse(emotion.state_json) : {},
      relationshipStage: relationship?.stage ?? 'stranger',
      conversationHistory: [],
      currentConversationId: null
    }
  }

  configureProvider(apiKey: string, model?: string): void {
    const providerConfig = {
      id: 'default',
      provider: 'openai' as const,
      apiKey,
      model: model || 'gpt-4o-mini',
      maxTokens: 1024,
      temperature: 0.8
    }
    this.aiClient = new OpenAIProvider(providerConfig)
  }

  async chat(userMessage: string): Promise<AsyncGenerator<string, void, unknown>> {
    if (!this.aiClient) {
      throw new Error('AI provider not configured. Please set API key in settings.')
    }

    if (!this.state.currentConversationId) {
      this.state.currentConversationId = createId()
    }

    const ctx: PromptContext = {
      personalityTraits: this.state.personalityTraits,
      emotionState: this.state.emotionState,
      relationshipStage: this.state.relationshipStage,
      recentMemories: getRecentMemories(5),
      currentTime: new Date().toISOString()
    }

    const systemMsg = buildSystemPrompt(ctx)

    const messages: ChatMessage[] = [
      systemMsg,
      ...this.state.conversationHistory.slice(-20),
      { role: 'user', content: userMessage }
    ]

    this.state.conversationHistory.push({ role: 'user', content: userMessage })

    const stream = this.aiClient.streamChat(messages)

    const self = this
    async function* wrappedStream(): AsyncGenerator<string, void, unknown> {
      let fullResponse = ''
      for await (const chunk of stream) {
        fullResponse += chunk
        yield chunk
      }
      self.state.conversationHistory.push({ role: 'assistant', content: fullResponse })
      self.saveConversation()
    }

    return wrappedStream()
  }

  private saveConversation(): void {
    if (!this.state.currentConversationId) return
    const db = getDatabase()
    const messages = this.state.conversationHistory.slice(-30)
    db.prepare(
      'INSERT OR REPLACE INTO conversations (id, messages_json, created_at) VALUES (?, ?, ?)'
    ).run(
      this.state.currentConversationId,
      JSON.stringify(messages),
      Date.now()
    )
  }

  getConversationHistory(): ChatMessage[] {
    return this.state.conversationHistory
  }

  getEmotionState(): Record<string, unknown> {
    return this.state.emotionState
  }

  getPersonality(): Record<string, number> {
    return this.state.personalityTraits
  }

  getRelationshipStage(): string {
    return this.state.relationshipStage
  }
}
