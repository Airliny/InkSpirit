import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { registerChatHandlers } from './chat'
import { registerConfigHandlers } from './config'
import { registerSystemHandlers } from './system'
import { registerDataHandlers } from './data'
import { registerUpdateHandlers } from './update'
import { registerModelHandlers } from './model'
import { registerCostHandlers } from './cost'
import { registerAvatarHandlers } from './avatar'
import { registerLifeHandlers } from './life'

export function registerIpcHandlers(agent: Agent): void {
  registerChatHandlers(agent)
  registerConfigHandlers()
  registerSystemHandlers()
  registerDataHandlers(agent)
  registerUpdateHandlers()
  registerModelHandlers(agent)
  registerCostHandlers()
  registerAvatarHandlers()
  registerLifeHandlers()
}
