import { ChatMessage, IAIClient, AIProviderConfig, AIProvider, PROVIDER_DEFAULTS } from './brain/ai/types'
import { OpenAIProvider } from './brain/ai/openai'
import { AnthropicProvider } from './brain/ai/anthropic'
import { buildSystemPrompt, buildAgentContext, AgentContext } from './brain/prompt'
import { getLatestSituation } from './world/sensor'
import { situationPromptLine } from './world/situation'
import { analyzeConversationForMemories } from './brain/reflection'
import { getActivePersonality } from './soul/personality'
import {
  getCurrentEmotion, hurtEmotion, feelScared, feelJealous,
  feelAppreciated, feelDisappointed, feelLonely, forgiveEmotion, isIgnoring
} from './soul/emotion'
import { getRelationship, recordRelationshipEvent, acknowledgeMemoryFeedback, recordInteraction } from './soul/relationship'
import { classifyInteraction, classifyRecallFeedback, recallEvent } from './soul/relationshipEvents'
import { addMemory } from './soul/memory'
import { assignName } from './soul/identity'
import { needsIdentityAnalysis, analyzeIdentityIntent } from './soul/identityIntent'
import { decideMode, type PersonalityMode } from './soul/mode'
import { getDatabase } from './database'
import { getConfig, setConfig } from './config'
import { setSecureConfig, getSecureConfig } from './secureStore'
import { uuidv4 } from './utils'
import { recordUsage } from './cost/usage'
import { detectUnsafe, refusalMessage, type ViolationLevel } from './safety/policy'
import { tryEvolvePersonality } from './soul/personality'

export class Agent {
  private aiClient: IAIClient | null = null
  private localClient: IAIClient | null = null
  private conversationHistory: ChatMessage[] = []
  private currentConversationId: string | null = null
  private currentProvider: AIProvider = 'openai'
  private currentModel: string = ''
  /** Set when the last assistant reply mentioned a memory; consumed by the
   *  next user message as recall feedback (confirm / correct / neutral) */
  private awaitingRecallConfirmation = false

  constructor() {
    const savedLocal = getConfig('local_model')
    if (savedLocal) this.configureLocalModel(savedLocal)
    // Restore the primary provider so getModelInfo() is accurate right away
    const provider = (getConfig('provider') as AIProvider) || 'openai'
    const apiKey = getSecureConfig(`${provider}_api_key`) || ''
    const model = getConfig(`${provider}_model`) || undefined
    this.configureProvider(provider, apiKey, model, undefined)
    // Continue the last session so the model keeps its context after a restart
    this.restoreLastConversation()
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
      const savedKey = getSecureConfig(`${provider}_api_key`)
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

    // Save to config (API key encrypted). Save even when empty so the user
    // can clear a stored key by clearing the field.
    setConfig('provider', provider)
    if (apiKey !== undefined) setSecureConfig(`${provider}_api_key`, apiKey)
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

  /** Semantic safety check for a message (used by IPC cache-hit path too) */
  async checkUnsafe(text: string): Promise<boolean> {
    const detector = this.localClient ?? this.aiClient
    if (!detector) return false
    try {
      return (await detectUnsafe(detector, text)) !== 'none'
    } catch {
      return false
    }
  }

  getActiveClientInfo(): { provider: AIProvider; model: string } {
    return { provider: this.currentProvider, model: this.currentModel }
  }

  getLocalClientInfo(): { provider: 'ollama'; model: string } | null {
    if (!this.localClient) return null
    return { provider: 'ollama', model: this.localClient.config.model }
  }

  /** Reset cached clients & history (e.g. after restoring a backup) */
  resetClients(): void {
    this.aiClient = null
    this.localClient = null
    this.conversationHistory = []
    this.currentConversationId = null
    this.currentProvider = (getConfig('provider') as AIProvider) || 'openai'
    this.currentModel = getConfig(`${this.currentProvider}_model`) || ''
    const savedLocal = getConfig('local_model')
    if (savedLocal) this.configureLocalModel(savedLocal)
    this.restoreLastConversation()
  }

  /** Continue the most recent persisted conversation after a restart */
  restoreLastConversation(): void {
    try {
      const db = getDatabase()
      const row = db.prepare(
        'SELECT id, messages_json FROM conversations ORDER BY created_at DESC LIMIT 1'
      ).get() as { id: string; messages_json: string } | undefined
      if (!row) return
      const parsed = JSON.parse(row.messages_json) as ChatMessage[]
      const restored = parsed.filter(m => m.role === 'user' || m.role === 'assistant')
      if (restored.length === 0) return
      this.conversationHistory = restored.slice(-50)
      this.currentConversationId = row.id
    } catch {
      // restore is best-effort
    }
  }

  private ensureClient(): IAIClient {
    if (!this.aiClient) {
      const provider = (getConfig('provider') as AIProvider) || 'openai'
      const apiKey = getSecureConfig(`${provider}_api_key`) || ''
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

    const pipe = await this.runPipeline(userMessage, client)
    if (pipe.kind === 'refuse') return this.safetyRefusal(pipe.level)
    if (pipe.kind === 'naming') return this.namingResponse(pipe.name)
    if (pipe.kind === 'cold') return this.coldResponse(pipe.hostility, provider, model, userMessage)

    const messages: ChatMessage[] = [
      pipe.systemMsg,
      ...this.conversationHistory.slice(-20),
      { role: 'user', content: userMessage }
    ]

    this.conversationHistory.push({ role: 'user', content: userMessage })
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50)
    }

    const stream = client.streamChat(messages)

    const self = this
    async function* wrappedStream(): AsyncGenerator<string, void, unknown> {
      let fullResponse = ''
      for await (const chunk of stream) {
        fullResponse += chunk
        yield chunk
      }
      self.recordExchange(userMessage, fullResponse, provider, model)
      // Semantic review of the reply: prefer local model; short replies are
      // sampled randomly (~20%) instead of always checked, to save tokens
      const reviewDetector = self.localClient ?? client
      const isShort = fullResponse.trim().length <= 20
      const unsafeOut = isShort && Math.random() >= 0.2
        ? 'none' as const
        : await detectUnsafe(reviewDetector, fullResponse)
      if (unsafeOut === 'none') {
        analyzeConversationForMemories(userMessage, fullResponse, self.currentConversationId!).catch(() => {})
        self.trySemanticMemory(client, userMessage, fullResponse).catch(() => {})
      }
    }

    return wrappedStream()
  }

  /**
   * The soul pipeline: every interaction changes the pet BEFORE any LLM call.
   * Shared by the normal chat path AND the response-cache path (M1 fix) —
   * we cache the reply, never the experience.
   */
  async runPipeline(
    userMessage: string,
    client?: IAIClient
  ): Promise<
    | { kind: 'ok'; systemMsg: ChatMessage; mode: PersonalityMode }
    | { kind: 'refuse'; level: ViolationLevel }
    | { kind: 'naming'; name: string }
    | { kind: 'cold'; hostility: number }
  > {
    const resolvedClient = client ?? this.ensureClient()

    // Content safety FIRST — before anything else (incl. naming), so a
    // violating message or a violating name can't slip through.
    // Token-lean: skip ultra-short casual messages, prefer the free local
    // model when available; the main model's own guardrails back us up.
    const skipCheck = userMessage.trim().length <= 8
    const detector = this.localClient ?? resolvedClient
    const violation = skipCheck ? 'none' as const : await detectUnsafe(detector, userMessage)
    if (violation !== 'none') {
      return { kind: 'refuse', level: violation }
    }

    // Identity Intent Layer：命名是高语义、低频的行为，交给 AI 理解而不是
    // 规则猜测。关键词只做节流（省成本），LLM 才是理解层——AI 不是审核员。
    // 只有用户明确决定（assign_name + 高置信）才写入身份事件；discuss/none
    // 一律继续普通聊天，不打断、不产生事件。
    if (needsIdentityAnalysis(userMessage)) {
      const intent = await analyzeIdentityIntent(this.localClient ?? resolvedClient, userMessage)
      if (intent.intent === 'assign_name' && intent.name) {
        // 名字本身仍要过安全检测，防止短消息绕过（"叫你冰毒"）
        const nameV = await detectUnsafe(detector, intent.name)
        if (nameV !== 'none') {
          return { kind: 'refuse', level: 'hard' }
        }
        assignName(intent.name)
        // 命名是用户主动建立身份称呼的行为：关系层只感知这个事件本身
        // （信任微增），名字是 Identity 不是 Personality 开关——人格不动。
        recordRelationshipEvent({
          type: 'name_assigned',
          intensity: 1,
          timestamp: Date.now(),
          source: 'identity',
          metadata: { name: intent.name, reason: '用户主动建立身份称呼' }
        })
        return { kind: 'naming', name: intent.name }
      }
    }

    const sentiment = analyzeSentiment(userMessage)

    if (isIgnoring() && sentiment.hostility > 0.3) {
      return { kind: 'cold', hostility: sentiment.hostility }
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

    // Relationship v2: classify the interaction into relationship events.
    // Interaction COUNT no longer drives the vector — event types do.
    for (const event of classifyInteraction({
      userMsg: userMessage,
      hostility: sentiment.hostility,
      kindness: sentiment.kindness
    })) {
      recordRelationshipEvent(event)
    }

    // Recall feedback: if the pet just mentioned a memory, this reply tells
    // whether it was right. Confirmed → relationship reward; wrong → no
    // reward (the correction event above already handles the dip).
    if (this.awaitingRecallConfirmation) {
      const outcome = classifyRecallFeedback(userMessage)
      const ev = outcome ? recallEvent(null, outcome) : null
      if (ev) recordRelationshipEvent(ev)
      this.awaitingRecallConfirmation = false
    }

    // How the user treats the pet slowly reshapes its personality:
    // kindness breeds warmth, hostility breeds guardedness & humor as a shield
    if (sentiment.kindness > 0.6) {
      tryEvolvePersonality(
        { warmth: 0.75, gentleness: 0.7 },
        '用户经常表达善意与关怀，砚灵慢慢变得更温暖体贴',
        'care'
      )
    } else if (sentiment.hostility > 0.5) {
      tryEvolvePersonality(
        { gentleness: 0.3, humor: 0.65, warmth: 0.3 },
        '长期被严厉对待，砚灵变得收敛，学会用幽默保护自己',
        'conflict'
      )
    } else if (sentiment.hostility > 0.2) {
      tryEvolvePersonality(
        { gentleness: 0.45 },
        '偶尔被指责，砚灵说话不再那么直接',
        'conflict'
      )
    }

    const personality = getActivePersonality()
    const emotion = getCurrentEmotion()
    const relationship = getRelationship()

    // Dual mode: auto-detect per message (model-assisted), or use manual setting
    const modeSetting = getConfig('personality_mode') || 'auto'
    const mode: PersonalityMode = modeSetting === 'auto'
      ? await decideMode(this.localClient ?? resolvedClient, userMessage)
      : (modeSetting === 'professional' ? 'professional' : 'companion')
    if (modeSetting === 'auto') {
      setConfig('personality_mode_current', mode)
    }

    // World Model feeds a one-line situation awareness into the prompt
    const situation = getLatestSituation()
    const situationLine = situation ? situationPromptLine(situation) : null

    const ctx: AgentContext = buildAgentContext({
      personalityTraits: personality.traits,
      emotionState: emotion,
      relationshipStage: relationship.stage,
      currentTime: new Date().toISOString(),
      mode,
      situation: situationLine ?? undefined
    })

    return { kind: 'ok', systemMsg: buildSystemPrompt(ctx), mode }
  }

  /**
   * Persist a completed exchange (LLM-generated OR cache-served) into the
   * conversation and usage ledger. The cache path must call this too, so a
   * cached reply still "happens" to the pet.
   */
  recordExchange(userMessage: string, assistantReply: string, provider: string, model: string): void {
    this.conversationHistory.push({ role: 'user', content: userMessage })
    this.conversationHistory.push({ role: 'assistant', content: assistantReply })
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50)
    }
    this.saveConversation()
    recordUsage(provider, model, userMessage, assistantReply)
    // A reply that references a memory opens a recall-confirmation window
    this.awaitingRecallConfirmation = /记得|想起来|你之前说|上次你说|以前你说/.test(assistantReply)
  }

  /**
   * Semantic memory: ask the AI to distill important facts about the user
   * into a short long-term memory. Throttled to keep cost low.
   */
  private async trySemanticMemory(client: IAIClient, userMsg: string, assistantMsg: string): Promise<void> {
    const now = Date.now()
    const lastAt = Number(getConfig('last_semantic_memory_at') || 0)
    if (now - lastAt < 30 * 60 * 1000) return

    // Only bother when the conversation looks meaningful
    const meaningful = /记住|生日|名字|喜欢|讨厌|最爱|爱|工作|项目|家人|朋友|猫|狗|宠物|计划|梦想|考试|面试|旅行|重要|最近|今天|明天|周末|老板|同事|学校/.test(userMsg)
    if (!meaningful && userMsg.length < 20) return

    setConfig('last_semantic_memory_at', String(now))

    const res = await client.chat([
      {
        role: 'system',
        content: '你是砚灵，一个桌面伙伴，正在记录和用户的相处记忆。请把下面这段对话中，用户透露的关于自己的重要信息提炼成一条简短的长期记忆（20-40 字，第三人称）。只记录事实与感受，不要寒暄。如果没有值得记住的信息，只回复"无"。'
      },
      { role: 'user', content: `用户：${userMsg.slice(0, 300)}\n砚灵：${assistantMsg.slice(0, 300)}` }
    ])

    const summary = res.content.trim().replace(/^"|"$/g, '')
    if (!summary || summary === '无' || summary.length < 4) return

    addMemory(summary, {
      type: 'semantic',
      importance: 0.75,
      tags: ['语义记忆'],
      sourceConversationId: this.currentConversationId
    })
    // Memory feedback: a stored fact about the user rewards understanding —
    // especially right after the user corrected us
    acknowledgeMemoryFeedback()
  }

  private async *safetyRefusal(level: ViolationLevel): AsyncGenerator<string, void, unknown> {
    const msg = refusalMessage(level)
    this.conversationHistory.push({ role: 'assistant', content: msg })
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50)
    }
    this.saveConversation()
    recordInteraction()
    // Track how often the user crosses the line (light touch, not blocking)
    const count = Number(getConfig('safety_violations') || 0)
    setConfig('safety_violations', String(count + 1))
    yield msg
  }

  private async *namingResponse(name: string): AsyncGenerator<string, void, unknown> {
    const responses = [
      `好，我记住了。`,
      `嗯，记住了。`,
      `（点点头）好。`
    ]
    const msg = responses[Math.floor(Math.random() * responses.length)]
    this.conversationHistory.push({ role: 'assistant', content: msg })
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50)
    }
    this.saveConversation()
    recordInteraction()
    yield msg
  }

  private async *coldResponse(hostility: number, provider: AIProvider, model: string, userMessage: string): AsyncGenerator<string, void, unknown> {
    const responses = hostility > 0.7
      ? ['（转过身去，不理你）', '（沉默）']
      : ['...', '（没有看你）', '嗯。']
    const msg = responses[Math.floor(Math.random() * responses.length)]
    this.conversationHistory.push({ role: 'assistant', content: msg })
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50)
    }
    // Cold responses still count as interactions and are persisted
    this.saveConversation()
    recordInteraction()
    recordUsage(provider, model, userMessage, msg)
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
