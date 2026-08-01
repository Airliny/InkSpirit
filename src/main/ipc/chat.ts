import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { getMainWindow } from '../windowManager'
import { decideRoute, getRouterSettings } from '../../core/cost/router'
import { getUsageSummary, getMonthlyBudget } from '../../core/cost/usage'
import { cacheKey, getCachedReply, setCachedReply } from '../../core/cost/cache'

export function registerChatHandlers(agent: Agent): void {
  ipcMain.handle('agent:chat', async (_event, message: string) => {
    const win = getMainWindow()
    if (!win) return { success: false, error: 'No window' }

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
      const clientInfo = route === 'local' ? agent.getLocalClientInfo() : agent.getActiveClientInfo()
      if (clientInfo) {
        const key = cacheKey(clientInfo.provider, clientInfo.model, message)
        const cached = getCachedReply(key)
        if (cached !== null) {
          win.webContents.send('agent:chat-chunk', cached)
          win.webContents.send('agent:chat-done')
          return { success: true, cached: true }
        }
      }

      const stream = route === 'local'
        ? await agent.chatLocal(message)
        : await agent.chat(message)

      let fullResponse = ''
      for await (const chunk of stream) {
        fullResponse += chunk
        win.webContents.send('agent:chat-chunk', chunk)
      }

      win.webContents.send('agent:chat-done')

      if (clientInfo && fullResponse) {
        setCachedReply(cacheKey(clientInfo.provider, clientInfo.model, message), fullResponse)
      }

      return { success: true, route }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('agent:getState', () => {
    return {
      emotion: agent.getEmotionState(),
      personality: agent.getPersonality(),
      relationshipStage: agent.getRelationshipStage(),
      history: agent.getConversationHistory()
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
}
