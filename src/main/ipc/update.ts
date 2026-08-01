import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, quitAndInstall } from '../updater/updater'

export function registerUpdateHandlers(): void {
  ipcMain.handle('update:check', (_event, manual: boolean) => {
    return checkForUpdates(manual)
  })

  ipcMain.handle('update:download', () => {
    downloadUpdate()
    return true
  })

  ipcMain.handle('update:install', () => {
    quitAndInstall()
    return true
  })
}
