import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { registerChatHandlers } from './chat'
import { registerConfigHandlers } from './config'
import { registerSystemHandlers } from './system'
import { registerDataHandlers } from './data'

export function registerIpcHandlers(agent: Agent): void {
  registerChatHandlers(agent)
  registerConfigHandlers()
  registerSystemHandlers()
  registerDataHandlers()
}
