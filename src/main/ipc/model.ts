import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { getOllamaStatus, listModels, searchCatalog, pullModel, removeModel } from '../modelManager/modelManager'
import { getHardwareInfo } from '../modelManager/hardware'

export function registerModelHandlers(agent: Agent): void {
  ipcMain.handle('model:mgrStatus', () => getOllamaStatus())

  ipcMain.handle('model:mgrList', () => listModels())

  ipcMain.handle('model:mgrSearch', () => searchCatalog())

  ipcMain.handle('model:mgrHardware', () => getHardwareInfo())

  ipcMain.handle('model:mgrPull', (_event, model: string) => pullModel(model))

  ipcMain.handle('model:mgrRemove', (_event, model: string) => removeModel(model))

  ipcMain.handle('model:mgrUse', (_event, model: string) => {
    agent.configureProvider('ollama', 'ollama', model)
    return { success: true, model }
  })
}
