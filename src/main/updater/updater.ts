import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getMainWindow } from '../windowManager'

let initialized = false

function send(channel: string, data?: unknown): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

export function initUpdater(): void {
  if (!app.isPackaged || initialized) return
  initialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    send('update:status', { state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send('update:status', { state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    send('update:status', { state: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    send('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send('update:status', { state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    send('update:status', { state: 'error', message: err.message })
  })
}

export async function checkForUpdates(manual = false): Promise<{ state: string; version?: string; message?: string }> {
  if (!app.isPackaged) {
    return { state: 'not-available', message: '开发模式不检查更新' }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    if (info && info.version !== app.getVersion()) {
      return { state: 'available', version: info.version }
    }
    return { state: 'not-available' }
  } catch (e: any) {
    return { state: 'error', message: e?.message || String(e) }
  } finally {
    if (manual) {
      // nothing
    }
  }
}

export function downloadUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}
