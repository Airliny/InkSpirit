import { ipcMain } from 'electron'
import { Agent } from '../../core/agent'
import { getOllamaStatus, listModels, searchCatalog, pullModel, removeModel } from '../modelManager/modelManager'
import { getHardwareInfo } from '../modelManager/hardware'
import { getConfig, setConfig } from '../../core/config'

export function registerModelHandlers(agent: Agent): void {
  ipcMain.handle('model:mgrStatus', async () => {
    const s = await getOllamaStatus()
    // Track local availability for the smart router
    setConfig('local_model_available', s.running ? 'true' : 'false')
    return s
  })

  ipcMain.handle('model:mgrList', () => listModels())

  ipcMain.handle('model:mgrSearch', async () => {
    const s = await getOllamaStatus()
    setConfig('local_model_available', s.running ? 'true' : 'false')
    return searchCatalog()
  })

  ipcMain.handle('model:mgrHardware', () => getHardwareInfo())

  ipcMain.handle('model:mgrPull', (_event, model: string) => pullModel(model))

  ipcMain.handle('model:mgrRemove', async (_event, model: string) => {
    const r = await removeModel(model)
    // If the removed model was the routed local model, clear it
    if (r.success && getConfig('local_model') === model) {
      agent.configureLocalModel('')
    }
    return r
  })

  ipcMain.handle('model:mgrUse', (_event, model: string) => {
    // Set as the smart-router local model (does NOT override the cloud provider)
    agent.configureLocalModel(model)
    setConfig('local_model_available', 'true')
    return { success: true, model }
  })
}
