import { ipcMain } from 'electron'
import { getConfig, setConfig } from '../../core/config'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', (_event, key: string) => {
    return getConfig(key)
  })

  ipcMain.handle('config:set', (_event, key: string, value: string) => {
    setConfig(key, value)
    return true
  })
}
