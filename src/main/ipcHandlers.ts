import { ipcMain } from 'electron'
import { Agent } from '../core/agent'
import { getMainWindow } from './windowManager'
import { getDatabase } from '../core/database'
import { setConfig, getConfig } from '../core/config'

export function registerIpcHandlers(agent: Agent): void {
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

  ipcMain.handle('agent:configureProvider', (_event, apiKey: string, model?: string) => {
    try {
      agent.configureProvider(apiKey, model)
      setConfig('openai_api_key', apiKey)
      if (model) setConfig('openai_model', model)
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

  ipcMain.handle('config:get', (_event, key: string) => {
    return getConfig(key)
  })

  ipcMain.handle('config:set', (_event, key: string, value: string) => {
    setConfig(key, value)
    return true
  })

  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle('window:toggleAlwaysOnTop', () => {
    return getMainWindow()?.isAlwaysOnTop() ?? false
  })
}
