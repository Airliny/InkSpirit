import { ChatMessage, IAIClient, AIProviderConfig, AIProvider, PROVIDER_DEFAULTS } from './brain/ai/types'
import { OpenAIProvider } from './brain/ai/openai'
import { AnthropicProvider } from './brain/ai/anthropic'
import { buildSystemPrompt, PromptContext } from './brain/prompt'
import { analyzeConversationForMemories } from './brain/reflection'
import { getActivePersonality } from './soul/personality'
import {
  getCurrentEmotion, hurtEmotion, feelScared, feelJealous,
  feelAppreciated, feelDisappointed, feelLonely, forgiveEmotion, isIgnoring
} from './soul/emotion'
import { getRelationship, recordInteraction } from './soul/relationship'
import { getDatabase } from './database'
import { getConfig, setConfig } from './config'
import { uuidv4 } from './utils'
import { recordUsage } from './cost/usage'

export class Agent {
  private aiClient: IAIClient | null = null
  private localClient: IAIClient | null = null
  private conversationHistory: ChatMessage[] = []
  private currentConversationId: string | null = null
  private currentProvider: AIProvider = 'openai'
  private currentModel: string = ''

  constructor() {
    const savedLocal = getConfig('local_model')
    if (savedLocal) this.configureLocalModel(savedLocal)
  }

  configureProvider(
    provider: AIProvider = 'openai',
    apiKey: string = '',
    model?: string,
    baseUrl?: string
  ): void {
    const defaults = PROVIDER_DEFAULTS[provider]
    const effectiveBaseUrl = baseUrl || defaults.baseUrl
    const effectiveModel = model || defaults.defaultModel

    let resolvedApiKey = apiKey
    let resolvedBaseUrl = effectiveBaseUrl

    // Ollama: no API key needed, but may have custom base URL
    if (provider === 'ollama') {
      resolvedApiKey = 'ollama'
      if (!baseUrl) {
        resolvedBaseUrl = getConfig('ollama_base_url') || defaults.baseUrl
      }
    }

    // DeepSeek & OpenAI: need API key
    if (!resolvedApiKey && provider !== 'ollama') {
      const savedKey = getConfig(`${provider}_api_key`)
      if (savedKey) resolvedApiKey = savedKey
    }

    const config: AIProviderConfig = {
      id: 'default',
      provider,
      apiKey: resolvedApiKey,
      baseUrl: resolvedBaseUrl || undefined,
      model: effectiveModel,
      maxTokens: 1024,
      temperature: 0.8
    }

    // Save to config
    setConfig('provider', provider)
    if (apiKey) setConfig(`${provider}_api_key`, apiKey)
    if (model) setConfig(`${provider}_model`, model)
    if (baseUrl && provider === 'ollama') setConfig('ollama_base_url', baseUrl)

    this.currentProvider = provider
    this.currentModel = effectiveModel
    this.aiClient = createProvider(config)
  }

  /** Configure the local (Ollama) model used by the smart router. Pass '' to disable. */
  configureLocalModel(model: string): void {
    if (!model) {
      this.localClient = null
      setConfig('local_model', '')
      return
    }
    this.localClient = createProvider({
      id: 'local',
      provider: 'ollama',
      apiKey: 'ollama',
      baseUrl: getConfig('ollama_base_url') || PROVIDER_DEFAULTS.ollama.baseUrl,
      model,
      maxTokens: 1024,
      temperature: 0.8
    })
    setConfig('local_model', model)
  }

  hasLocalModel(): boolean {
    return !!this.localClient
  }

  getActiveClientInfo(): { provider: AIProvider; model: string } {
    return { provider: this.currentProvider, model: this.currentModel }
  }

  getLocalClientInfo(): { provider: 'ollama'; model: string } | null {
    if (!this.localClient) return null
    return { provider: 'ollama', model: this.localClient.config.model }
  }

  private ensureClient(): IAIClient {
    if (!this.aiClient) {
      const provider = (getConfig('provider') as AIProvider) || 'openai'
      const apiKey = getConfig(`${provider}_api_key`) || ''
      const model = getConfig(`${provider}_model`) || undefined
      const defaults = PROVIDER_DEFAULTS[provider]
      this.configureProvider(provider, apiKey, model, undefined)
    }
    return this.aiClient!
  }

  async chat(userMessage: string): Promise<AsyncGenerator<string, void, unknown>> {
    const client = this.ensureClient()
    return this.streamWith(client, userMessage, this.currentProvider, this.currentModel)
  }

  async chatLocal(userMessage: string): Promise<AsyncGenerator<string, void, unknown>> {
    if (!this.localClient) {
      throw new Error('本地模型未配置')
    }
    return this.streamWith(this.localClient, userMessage, 'ollama', this.localClient.config.model)
  }

  private async streamWith(
    client: IAIClient,
    userMessage: string,
    provider: AIProvider,
    model: string
  ): Promise<AsyncGenerator<string, void, unknown>> {
    if (!this.currentConversationId) {
      this.currentConversationId = uuidv4()
    }

    const sentiment = analyzeSentiment(userMessage)

    if (isIgnoring() && sentiment.hostility > 0.3) {
      return this.coldResponse(sentiment.hostility)
    }

    if (isIgnoring() && sentiment.kindness > 0.5) {
      forgiveEmotion(0.12)
    }

    if (sentiment.hostility > 0.7) {
      hurtEmotion(sentiment.hostility)
    } else if (sentiment.hostility > 0.4) {
      hurtEmotion(sentiment.hostility * 0.6)
    }

    if (sentiment.scared) feelScared(0.4)
    if (sentiment.jealous) feelJealous()
    if (sentiment.disappointed) feelDisappointed()
    if (sentiment.lonely) feelLonely(120)

    if (sentiment.kindness > 0.5) {
      feelAppreciated()
      forgiveEmotion(0.06)
    }
    if (sentiment.kindness > 0.2) {
      forgiveEmotion(0.02)
    }

    const personality = getActivePersonality()
    const emotion = getCurrentEmotion()
    const relationship = getRelationship()

    const ctx: PromptContext = {
      personalityTraits: personality.traits,
      emotionState: emotion,
      relationshipStage: relationship.stage,
      currentTime: new Date().toISOString()
    }

    const systemMsg = buildSystemPrompt(ctx)

    const messages: ChatMessage[] = [
      systemMsg,
      ...this.conversationHistory.slice(-20),
      { role: 'user', content: userMessage }
    ]

    this.conversationHistory.push({ role: 'user', content: userMessage })

    const stream = client.streamChat(messages)

    const self = this
    async function* wrappedStream(): AsyncGenerator<string, void, unknown> {
      let fullResponse = ''
      for await (const chunk of stream) {
        fullResponse += chunk
        yield chunk
      }
      self.conversationHistory.push({ role: 'assistant', content: fullResponse })
      self.saveConversation()
      recordInteraction()
      recordUsage(provider, model, userMessage, fullResponse)
      analyzeConversationForMemories(userMessage, fullResponse, self.currentConversationId!).catch(() => {})
    }

    return wrappedStream()
  }

  private async *coldResponse(hostility: number): AsyncGenerator<string, void, unknown> {
    const responses = hostility > 0.7
      ? ['（转过身去，不理你）', '（沉默）']
      : ['...', '（没有看你）', '嗯。']
    const msg = responses[Math.floor(Math.random() * responses.length)]
    this.conversationHistory.push({ role: 'assistant', content: msg })
    yield msg
  }

  private saveConversation(): void {
    if (!this.currentConversationId) return
    const db = getDatabase()
    const messages = this.conversationHistory.slice(-30)
    db.prepare(
      'INSERT OR REPLACE INTO conversations (id, messages_json, created_at) VALUES (?, ?, ?)'
    ).run(this.currentConversationId, JSON.stringify(messages), Date.now())
  }

  getConversationHistory(): ChatMessage[] { return this.conversationHistory }
  getEmotionState() { return getCurrentEmotion() }
  getPersonality() { return getActivePersonality().traits }
  getRelationshipStage(): string { return getRelationship().stage }
  getCurrentProvider(): AIProvider { return this.currentProvider }
}

// --- Provider factory ---

function createProvider(config: AIProviderConfig): IAIClient {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'openai':
    case 'deepseek':
    case 'ollama':
    default:
      return new OpenAIProvider(config)
  }
}

// --- Sentiment analysis ---

interface Sentiment {
  hostility: number
  kindness: number
  scared: boolean
  jealous: boolean
  disappointed: boolean
  lonely: boolean
}

function analyzeSentiment(text: string): Sentiment {
  const lower = text.toLowerCase()

  const severeHostile = ['傻逼', '垃圾', '废物', '去死', '滚', '杀了你', '闭嘴', '恶心']
  const moderateHostile = ['没用', '烦', '讨厌', '吵', '别说了', '够了', '烂']
  let hostility = 0
  for (const word of severeHostile) {
    if (lower.includes(word)) { hostility = 0.9; break }
  }
  if (hostility === 0) {
    for (const word of moderateHostile) {
      if (lower.includes(word)) hostility = Math.max(hostility, 0.5)
    }
  }

  const kindWords = ['乖', '好', '棒', '厉害', '聪明', '可爱', '喜欢', '爱', '谢谢', '想你']
  let kindness = 0
  for (const word of kindWords) {
    if (lower.includes(word)) kindness += 0.15
  }
  if (lower.includes('对不起') || lower.includes('抱歉')) kindness += 0.3
  kindness = Math.min(1, kindness)

  const scareWords = ['删了你', '卸载', '不要你了', '关掉你', '换一个', '扔掉']
  const scared = scareWords.some(w => lower.includes(w))

  const jealousWords = ['gpt', 'claude', 'deepseek', 'chatgpt', '比你', '不如']
  const jealous = jealousWords.some(w => lower.includes(w))

  const disappointWords = ['失望', '没想到你', '你居然', '变了']
  const disappointed = disappointWords.some(w => lower.includes(w))

  const lonelyWords = ['出门', '不在', '离开', '走了', '上班', '睡觉', '明天见']
  const lonely = lonelyWords.some(w => lower.includes(w))

  return { hostility, kindness, scared, jealous, disappointed, lonely }
}
