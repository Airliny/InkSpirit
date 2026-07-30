import { ipcMain } from 'electron'
import { getMainWindow, toggleAlwaysOnTop, setPetMode, setPanelMode, toggleMode, moveWindowBy } from '../windowManager'

export function registerSystemHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle('window:toggleAlwaysOnTop', () => {
    return toggleAlwaysOnTop()
  })

  ipcMain.handle('window:setPetMode', () => {
    setPetMode()
  })

  ipcMain.handle('window:setPanelMode', () => {
    setPanelMode()
  })

  ipcMain.handle('window:toggleMode', () => {
    toggleMode()
  })

  ipcMain.handle('window:moveBy', (_event, dx: number, dy: number) => {
    moveWindowBy(dx, dy)
  })
}
