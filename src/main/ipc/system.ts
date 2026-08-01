import { ipcMain, app } from 'electron'
import { getMainWindow, toggleAlwaysOnTop, setPetMode, setPanelMode, toggleMode, moveWindowBy, moveWindowTo, startWindowDrag, updateWindowDrag, endWindowDrag } from '../windowManager'
import { showPetContextMenu } from '../trayManager'

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

  ipcMain.handle('window:moveTo', (_event, x: number, y: number) => {
    moveWindowTo(x, y)
  })

  ipcMain.handle('window:getPosition', () => {
    const win = getMainWindow()
    return win ? win.getPosition() as [number, number] : [0, 0]
  })

  ipcMain.handle('window:startDrag', () => {
    startWindowDrag()
  })

  ipcMain.handle('window:updateDrag', () => {
    updateWindowDrag()
  })

  ipcMain.handle('window:endDrag', () => {
    endWindowDrag()
  })

  ipcMain.handle('window:setAutoLaunch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled })
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('window:getAutoLaunch', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('window:showPetMenu', () => {
    showPetContextMenu()
  })
}
