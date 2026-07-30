import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { getMainWindow } from '../windowManager'

export function registerChatHandlers(agent: Agent): void {
  ipcMain.handle('agent:chat', async (_event, message: string) => {
    try {
      const stream = await agent.chat(message)
      const win = getMainWindow()
      if (!win) throw new Error('No window')

      for await (const chunk of stream) {
        win.webContents.send('agent:chat-chunk', chunk)
      }

      win.webContents.send('agent:chat-done')

      return { success: true }
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
