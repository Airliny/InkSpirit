import { ipcMain, app } from 'electron'
import { getMainWindow, toggleAlwaysOnTop, setPetMode, setPanelMode, toggleMode, moveWindowBy, moveWindowTo, startWindowDrag, updateWindowDrag, endWindowDrag } from '../windowManager'
import { showPetContextMenu } from '../trayManager'
import { logTo, logsDirectory, type LogCategory } from '../logs'
import { getDatabaseState } from '../../core/database'
import { getOrCreateSoulManifest } from '../../core/soul/manifest'
import { getConfig } from '../../core/config'
import { getSecureConfig } from '../../core/secureStore'
import fs from 'fs'
import path from 'path'

const LOG_CATEGORIES: LogCategory[] = ['startup', 'renderer', 'avatar', 'brain', 'updater']

export function registerSystemHandlers(): void {
  // Renderer-side structured logs (avatar load failures, etc.) — never chat
  // content, memories or secrets; the renderer only sends category + reason.
  ipcMain.handle('log:event', (_event, category: string, message: string) => {
    if (LOG_CATEGORIES.includes(category as LogCategory) && typeof message === 'string') {
      logTo(category as LogCategory, `renderer: ${message.slice(0, 500)}`)
    }
  })

  /** 诊断页：一次拿全系统状态，用户反馈问题时可一键查看 */
  ipcMain.handle('diagnostics:get', () => {
    const db = getDatabaseState()
    let soulId: string | null = null
    try {
      soulId = getOrCreateSoulManifest(app.getVersion()).soulId
    } catch {
      soulId = null
    }
    const provider = getConfig('provider') || 'openai'
    const model = getConfig(`${provider}_model`) || null
    const currentBodyId = getConfig('current_avatar_id') || null
    const modelType = getConfig('model_type') || 'sprites'
    let gpu = {}
    try {
      gpu = app.getGPUFeatureStatus()
    } catch {
      gpu = {}
    }
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      uptimeSec: Math.round(process.uptime()),
      logsDir: logsDirectory(),
      db: { status: db.status, lastError: db.lastError },
      soul: { soulId },
      brain: { provider, model, configured: !!getSecureConfig(`${provider}_api_key`) },
      body: { currentBodyId, modelType },
      gpu,
      updater: { enabled: app.isPackaged }
    }
  })

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

  ipcMain.handle('data:storageInfo', () => {
    try {
      const userData = app.getPath('userData')
      const dbSize = fs.existsSync(path.join(userData, 'inkspirit.db'))
        ? fs.statSync(path.join(userData, 'inkspirit.db')).size
        : 0
      const avatarsSize = dirSize(path.join(userData, 'avatars'))
      return {
        dbMB: Math.round((dbSize / 1024 / 1024) * 100) / 100,
        avatarsMB: Math.round((avatarsSize / 1024 / 1024) * 100) / 100,
        totalMB: Math.round(((dbSize + avatarsSize) / 1024 / 1024) * 100) / 100
      }
    } catch {
      return { dbMB: 0, avatarsMB: 0, totalMB: 0 }
    }
  })
}

function dirSize(dir: string): number {
  let total = 0
  try {
    if (!fs.existsSync(dir)) return 0
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        total += dirSize(full)
      } else if (entry.isFile()) {
        total += fs.statSync(full).size
      }
    }
  } catch {
    // ignore unreadable entries
  }
  return total
}
