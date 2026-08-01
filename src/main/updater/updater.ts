import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getMainWindow } from '../windowManager'
import { getDatabase } from '../../core/database'
import { buildBackup } from '../../core/backup'
import { getActivePersonality } from '../../core/soul/personality'
import { parseManifest, validateManifest, compareVersions, type UpdateManifest } from '../../core/updaterManifest'
import { LATEST_SCHEMA_VERSION } from '../../core/migrations'
import path from 'path'
import fs from 'fs'

const OWNER = 'Airliny'
const REPO = 'InkSpirit'
const RELEASE_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`

let initialized = false
let lastManifest: UpdateManifest | null = null

function send(channel: string, data?: unknown): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

/**
 * Fetch the release manifest (never parse the release page directly).
 * Returns null when unavailable (network / no manifest asset / dev mode).
 */
async function fetchManifest(): Promise<UpdateManifest | null> {
  try {
    const res = await fetch(RELEASE_API, { headers: { 'User-Agent': 'InkSpirit-Updater' } })
    if (!res.ok) return null
    const release = (await res.json()) as { assets?: { name: string; browser_download_url: string }[] }
    const asset = release.assets?.find((a) => a.name === 'manifest.json')
    if (!asset) return null
    const mRes = await fetch(asset.browser_download_url)
    if (!mRes.ok) return null
    const manifest = parseManifest(await mRes.text())
    if (!manifest) return null
    if (validateManifest(manifest, { currentVersion: app.getVersion(), currentSchemaVersion: LATEST_SCHEMA_VERSION }).ok === false) {
      return null
    }
    return manifest
  } catch {
    return null
  }
}

/**
 * Update safety net: snapshot the soul (memories/personality/relationship/
 * evolution logs) before touching the program. The program may be replaced;
 * the soul must never be at risk. Keeps the 3 most recent snapshots.
 */
export function backupSoulBeforeUpdate(): string | null {
  try {
    const dir = path.join(app.getPath('userData'), 'update-backups')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `pre-update-${app.getVersion()}-${Date.now()}.json`)
    const backup = buildBackup(getDatabase(), {
      appVersion: app.getVersion(),
      soulVersion: getActivePersonality().version
    })
    fs.writeFileSync(file, JSON.stringify(backup))
    // Keep only the newest snapshots
    const existing = fs.readdirSync(dir).filter((f) => f.startsWith('pre-update-')).sort().reverse()
    for (const old of existing.slice(3)) {
      fs.rmSync(path.join(dir, old), { force: true })
    }
    return file
  } catch (err) {
    console.error(`[updater] soul backup failed: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

export function initUpdater(): void {
  if (!app.isPackaged || initialized) return
  initialized = true

  autoUpdater.autoDownload = false
  // Quitting from the tray must never hijack into an install (product
  // principle: the user owns the decision to restart-and-install)
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    send('update:status', { state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send('update:status', { state: 'available', version: info.version, notes: lastManifest?.notes ?? null })
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

/**
 * Check: electron-updater (version + sha512-verified download info) fused
 * with the release manifest (notes / minimum version / database version).
 */
export async function checkForUpdates(manual = false): Promise<{ state: string; version?: string; notes?: string[] | null; message?: string }> {
  if (!app.isPackaged) {
    return { state: 'not-available', message: '开发模式不检查更新' }
  }
  try {
    const manifest = await fetchManifest()
    lastManifest = manifest
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    if (info && info.version !== app.getVersion() && compareVersions(info.version, app.getVersion()) > 0) {
      return { state: 'available', version: info.version, notes: manifest?.notes ?? null }
    }
    return { state: 'not-available' }
  } catch (e: any) {
    return { state: 'error', message: e?.message || String(e) }
  } finally {
    if (manual) {
      // explicit user-triggered check — nothing extra
    }
  }
}

/**
 * Download: soul snapshot first (update must never endanger the soul),
 * then electron-updater downloads with its own sha512 verification.
 */
export function downloadUpdate(): void {
  if (!app.isPackaged) return
  const backupPath = backupSoulBeforeUpdate()
  if (backupPath) {
    console.log(`[updater] soul backed up before update: ${backupPath}`)
  }
  autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}
