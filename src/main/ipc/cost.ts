import { ipcMain } from 'electron'
import { getUsageSummary, setMonthlyBudget, getMonthlyBudget } from '../../core/cost/usage'
import { clearCache, getCacheSize } from '../../core/cost/cache'
import { getRouterSettings } from '../../core/cost/router'
import { getConfig, setConfig } from '../../core/config'

export function registerCostHandlers(): void {
  ipcMain.handle('cost:getSummary', () => getUsageSummary())

  ipcMain.handle('cost:setBudget', (_event, usd: number) => {
    setMonthlyBudget(Number(usd) || 0)
    return getUsageSummary()
  })

  ipcMain.handle('cost:getBudget', () => getMonthlyBudget())

  ipcMain.handle('cost:setRouter', (_event, enabled: boolean) => {
    setConfig('cost_router_enabled', enabled ? 'true' : 'false')
    return getRouterSettings()
  })

  ipcMain.handle('cost:getRouter', () => getRouterSettings())

  ipcMain.handle('cost:clearCache', () => {
    clearCache()
    return getCacheSize()
  })

  ipcMain.handle('cost:getCacheSize', () => getCacheSize())
}
