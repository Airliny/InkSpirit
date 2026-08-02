import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { getMainWindow } from '../windowManager'
import { decideRoute, getRouterSettings } from '../../core/cost/router'
import { getUsageSummary, getMonthlyBudget } from '../../core/cost/usage'
import { cacheKey, getCachedReply, setCachedReply } from '../../core/cost/cache'
import { getCurrentEmotion, emotionToExpression } from '../../core/soul/emotion'
import { getDatabase } from '../../core/database'
import { countMemories } from '../../core/soul/memory'
import { hasLifeEvent, recordLifeEvent } from '../../core/soul/lifeTimeline'
import { buildBrainProfile } from '../../core/brain/brainProfile'
import { getConfig } from '../../core/config'
import { logTo } from '../logs'

export function registerChatHandlers(agent: Agent): void {
  ipcMain.handle('agent:chat', async (_event, message: string) => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' }

    // Life Timeline：第一次对话（幂等，只记一次；不打扰聊天）
    try {
      if (!hasLifeEvent('first_chat')) {
        const short = message.length > 40 ? message.slice(0, 40) + '…' : message
        recordLifeEvent('first_chat', '第一次对话', `你对它说了：「${short}」`, undefined, 'normal')
      }
    } catch { /* best-effort */ }

    try {
      const settings = getRouterSettings()
      const route = decideRoute(message, settings)

      // Budget check: cloud requests must respect the monthly budget
      if (route === 'cloud') {
        const usage = getUsageSummary()
        if (usage.budgetExceeded) {
          return {
            success: false,
            budgetBlocked: true,
            error: '本月预算已用完，请调整预算或使用本地模型'
          }
        }
      }

      // Cache: identical message within 10 minutes returns the cached reply
      // (key includes current emotion so mood-affected replies differ).
      // M1: the CACHE only caches the LLM text — the soul pipeline always
      // runs first, so a repeated message still changes emotion/relationship/
      // memory. We cache the answer, never the experience.
      const clientInfo = route === 'local' ? agent.getLocalClientInfo() : agent.getActiveClientInfo()
      if (clientInfo) {
        const mood = emotionToExpression(getCurrentEmotion().dominantEmotion)
        const key = cacheKey(clientInfo.provider, clientInfo.model, `${mood}|${message}`)
        const cached = getCachedReply(key)
        if (cached !== null) {
          // Full soul experience first (safety / emotion / relationship /
          // personality / memory feedback all apply — same path as normal chat)
          const pipe = await agent.runPipeline(message)
          if (pipe.kind !== 'ok') {
            // Naming/refusal/cold are rare and short — let the agent handle
            // them fresh (they never benefit from the cache anyway)
            const stream = await agent.chat(message)
            for await (const chunk of stream) {
              if (win.isDestroyed()) break
              win.webContents.send('agent:chat-chunk', chunk)
            }
            if (!win.isDestroyed()) win.webContents.send('agent:chat-done')
            return { success: true, cached: false }
          }
          win.webContents.send('agent:chat-chunk', cached)
          win.webContents.send('agent:chat-done')
          // The exchange still "happens": persisted to history + usage ledger
          agent.recordExchange(message, cached, clientInfo.provider, clientInfo.model)
          return { success: true, cached: true }
        }
      }

      let usedRoute = route
      let fullResponse = ''
      const liveWin = win

      // 流式消费：把 chunk 发给渲染进程，返回完整回复
      async function drainStream(stream: AsyncGenerator<string, void, unknown>): Promise<string> {
        let full = ''
        for await (const chunk of stream) {
          full += chunk
          if (liveWin.isDestroyed()) break
          liveWin.webContents.send('agent:chat-chunk', chunk)
        }
        return full
      }

      // 大脑降级策略：主大脑失败 → 尝试本地大脑 → 都没有才失败
      if (usedRoute === 'local') {
        try {
          fullResponse = await drainStream(await chatWithLocalFallback())
        } catch {
          // local model unavailable (Ollama stopped / model removed) — fall back to cloud
          usedRoute = 'cloud'
          fullResponse = await drainStream(await agent.chat(message))
        }
      } else {
        try {
          fullResponse = await drainStream(await agent.chat(message))
        } catch (cloudError) {
          // 云端大脑暂时不可用（限流/网络/Key 失效）→ 降到本地大脑
          const local = agent.getLocalClientInfo()
          if (local) {
            try {
              fullResponse = await drainStream(await agent.chatLocal(message))
              usedRoute = 'local'
            } catch {
              throw cloudError
            }
          } else {
            throw cloudError
          }
        }
      }

      async function chatWithLocalFallback() {
        try {
          return await agent.chatLocal(message)
        } catch {
          // local model unavailable (Ollama stopped / model removed) — fall back to cloud
          usedRoute = 'cloud'
          return agent.chat(message)
        }
      }

      if (!win.isDestroyed()) win.webContents.send('agent:chat-done')

      // Only cache substantive replies — cold/terse responses (e.g. "（沉默）")
      // shouldn't be reused verbatim. When the local route fell back to the
      // cloud model, attribute the reply to the model that actually answered.
      const answerInfo = usedRoute === 'cloud' ? agent.getActiveClientInfo() : clientInfo
      if (answerInfo && fullResponse.length >= 8) {
        const mood = emotionToExpression(getCurrentEmotion().dominantEmotion)
        setCachedReply(cacheKey(answerInfo.provider, answerInfo.model, `${mood}|${message}`), fullResponse)
      }

      return { success: true, route: usedRoute }
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unknown error'
      logTo('brain', `chat failed: ${raw}`)
      const friendly = /401|403|api[_ ]?key|unauthorized|invalid.*key/i.test(raw)
        ? '大脑的钥匙好像不对…请到设置里检查一下 API Key'
        : /ECONNREFUSED|fetch failed|network|timeout|socket/i.test(raw)
          ? '当前大脑暂时无法连接，我可以等一会儿…你也可以稍后再试试。'
          : raw
      return { success: false, error: friendly }
    }
  })

  ipcMain.handle('agent:getState', () => {
    const rel = agent.getRelationshipState()
    return {
      emotion: agent.getEmotionState(),
      personality: agent.getPersonality(),
      relationshipStage: agent.getRelationshipStage(),
      relationship: rel,
      history: agent.getConversationHistory(),
      memories: countMemories()
    }
  })

  ipcMain.handle('agent:getModelInfo', () => {
    const active = agent.getActiveClientInfo()
    const local = agent.getLocalClientInfo()
    return { provider: active.provider, model: active.model, localModel: local?.model ?? null }
  })

  // Brain Center —— 砚灵的大脑（能力画像，不是参数列表）
  ipcMain.handle('brain:getProfile', () => {
    const active = agent.getActiveClientInfo()
    const savedTemp = Number(getConfig(`temperature_${active.provider}`))
    const profile = buildBrainProfile(
      active.provider,
      active.model,
      Number.isFinite(savedTemp) && savedTemp >= 0 && savedTemp <= 2 ? savedTemp : undefined
    )
    // 端点：本地/自定义用已存配置
    if (profile.isLocal || active.provider === 'custom') {
      const savedUrl = getConfig(`${active.provider}_base_url`)
      if (savedUrl) profile.endpoint = savedUrl
    }
    return profile
  })

  ipcMain.handle('brain:setTemperature', (_event, provider: string, temperature: number) => {
    try {
      return { success: true, temperature: agent.setTemperature(provider as Parameters<typeof agent.setTemperature>[0], temperature) }
    } catch (e: any) {
      return { success: false, error: e?.message ?? '设置失败' }
    }
  })

  // Restore the most recent conversation from the database
  ipcMain.handle('chat:getHistory', () => {
    try {
      const db = getDatabase()
      const row = db.prepare(
        'SELECT messages_json FROM conversations ORDER BY created_at DESC LIMIT 1'
      ).get() as { messages_json: string } | undefined
      if (!row) return []
      const messages = JSON.parse(row.messages_json) as { role: string; content: string }[]
      return messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-30)
    } catch {
      return []
    }
  })

  // Clear conversation history (memory and DB)
  ipcMain.handle('chat:clear', () => {
    try {
      const db = getDatabase()
      db.prepare('DELETE FROM conversations').run()
      db.prepare('DELETE FROM memories WHERE source_conversation_id IS NOT NULL').run()
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('agent:configureProvider', (_event, provider: string, apiKey?: string, model?: string, baseUrl?: string) => {
    try {
      agent.configureProvider(provider as any, apiKey, model, baseUrl)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('agent:testConnection', async (_event, provider: string, apiKey?: string, model?: string, baseUrl?: string) => {
    try {
      return await agent.testConnection(provider as any, apiKey || '', model || '', baseUrl || '')
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}
