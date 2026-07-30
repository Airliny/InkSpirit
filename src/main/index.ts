import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow, getMainWindow } from './windowManager'
import { createTray } from './trayManager'
import { registerIpcHandlers } from './ipcHandlers'
import { getDatabase, closeDatabase } from '../core/database'
import { Agent } from '../core/agent'

let agent: Agent

app.whenReady().then(() => {
  getDatabase()
  agent = new Agent()

  const win = createMainWindow()
  createTray(win)

  registerIpcHandlers(agent)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

export function getAgent(): Agent {
  return agent
}
