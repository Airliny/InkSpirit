import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDatabase, closeDatabase } from '../../core/database'
import { setConfig, getConfig } from '../../core/config'
import { getActivePersonality } from '../../core/soul/personality'
import { getOrCreateSoulManifest, computeContinuityHash, computeLiveContinuityHash } from '../../core/soul/manifest'
import { recordLifeEvent } from '../../core/soul/lifeTimeline'
import { uuidv4 } from '../../core/utils'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { getMainWindow } from '../windowManager'
import { Agent } from '../../core/agent'
import { runMigrations } from '../../core/migrations'
import {
  buildBackup,
  validateBackup,
  restoreInto,
  BACKUP_FORMAT,
  BACKUP_MANIFEST_FILE,
  BACKUP_SOUL_FILE,
  BACKUP_LEGACY_FILE,
  type BackupFile,
  type BackupManifest
} from '../../core/backup'

export function registerDataHandlers(agent: Agent): void {
  // Live2D model import: select the .model3.json and copy entire folder
  ipcMain.handle('model:importLive2D', async () => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win as BrowserWindow, {
      title: '选择 Live2D 模型文件 (.model3.json 或 .model.json)',
      filters: [{ name: 'Live2D Model', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const srcJsonPath = result.filePaths[0]
    const srcDir = path.dirname(srcJsonPath)
    const jsonFileName = path.basename(srcJsonPath)

    const avatarsDir = path.join(app.getPath('userData'), 'avatars')
    // Remove the previous Live2D model folder so re-imports don't accumulate
    const oldL2dPath = getConfig('live2d_path')
    if (oldL2dPath) {
      try {
        const oldDir = path.dirname(oldL2dPath)
        if (oldDir.startsWith(avatarsDir) && oldDir !== avatarsDir && path.basename(oldDir).startsWith('live2d_')) {
          fs.rmSync(oldDir, { recursive: true, force: true })
        }
      } catch {
        // ignore cleanup errors
      }
    }

    const l2dDir = path.join(avatarsDir, 'live2d_' + Date.now())
    if (!fs.existsSync(l2dDir)) fs.mkdirSync(l2dDir, { recursive: true })

    copyFolderRecursive(srcDir, l2dDir)

    const destJsonPath = path.join(l2dDir, jsonFileName)

    setConfig('model_type', 'live2d')
    setConfig('live2d_path', destJsonPath)

    return { success: true, path: destJsonPath }
  })

  // Model import: sprite
  ipcMain.handle('model:import', async (_event, spriteKey: string) => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win as BrowserWindow, {
      title: '选择角色图片',
      filters: [
        { name: '图片', extensions: ['png', 'gif', 'jpg', 'jpeg', 'webp'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const srcPath = result.filePaths[0]
    const avatarsDir = path.join(app.getPath('userData'), 'avatars')
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true })
    }

    // Remove the previous file for this sprite key so re-imports don't accumulate
    removeOldSprite(avatarsDir, spriteKey)

    const ext = path.extname(srcPath)
    const destName = `${spriteKey}_${Date.now()}${ext}`
    const destPath = path.join(avatarsDir, destName)
    fs.copyFileSync(srcPath, destPath)

    const fileUrl = `local://${encodeURIComponent(destPath)}`
    setConfig(`sprite_${spriteKey}`, fileUrl)
    setConfig('model_type', 'sprites')

    return { success: true, path: fileUrl }
  })

  // Model import by drag-drop path (renderer sends local file path)
  ipcMain.handle('model:importFromPath', async (_event, spriteKey: string, srcPath: string) => {
    if (!fs.existsSync(srcPath)) {
      return { success: false, error: 'File not found' }
    }

    const avatarsDir = path.join(app.getPath('userData'), 'avatars')
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true })
    }

    // Remove the previous file for this sprite key so re-imports don't accumulate
    removeOldSprite(avatarsDir, spriteKey)

    const ext = path.extname(srcPath)
    const destName = `${spriteKey}_${Date.now()}${ext}`
    const destPath = path.join(avatarsDir, destName)
    fs.copyFileSync(srcPath, destPath)

    const fileUrl = `local://${encodeURIComponent(destPath)}`
    setConfig(`sprite_${spriteKey}`, fileUrl)
    setConfig('model_type', 'sprites')

    return { success: true, path: fileUrl }
  })

  // Get all saved sprite paths
  ipcMain.handle('model:getSprites', () => {
    const keys = ['idle', 'walk', 'sleep', 'sit', 'stretch', 'yawn', 'surprised', 'happy', 'sad', 'love']
    const sprites: Record<string, string | null> = {}
    for (const key of keys) {
      const val = getConfig(`sprite_${key}`)
      if (val) {
        if (val.startsWith('file://')) {
          const filePath = path.normalize(val.replace(/^file:\/\/\/?/, ''))
          const normalized = `local://${encodeURIComponent(filePath)}`
          setConfig(`sprite_${key}`, normalized)
          sprites[key] = normalized
        } else {
          sprites[key] = val
        }
      } else {
        sprites[key] = null
      }
    }
    return sprites
  })

  // Check if any model is configured
  ipcMain.handle('model:hasModel', () => {
    if (getConfig('live2d_path')) return true
    const spriteKeys = ['idle', 'walk', 'sleep', 'sit', 'stretch', 'yawn', 'surprised', 'happy', 'sad', 'love']
    return spriteKeys.some(k => !!getConfig(`sprite_${k}`))
  })

  // Get model type
  ipcMain.handle('model:getType', () => {
    return getConfig('model_type') || 'sprites'
  })

  // Get Live2D path
  ipcMain.handle('model:getLive2DPath', () => {
    return getConfig('live2d_path')
  })

  // Data export: complete life-state snapshot (all soul tables + checksum)
  // + avatar assets in a folder. Secrets (sec_*) are never exported.
  ipcMain.handle('data:export', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择备份保存位置',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { success: false, error: 'Cancelled' }

    const dir = result.filePaths[0]
    const base = path.join(dir, `inkspirit-backup-${Date.now()}`)
    try {
      fs.mkdirSync(base, { recursive: true })

      // Soul Manifest：归档时嵌入哲学身份 + 连续性指纹（"还是同一个砚灵"的证明）
      const manifest = getOrCreateSoulManifest(app.getVersion())
      const continuityHash = computeLiveContinuityHash(manifest.soulId) ?? undefined

      const backup = buildBackup(getDatabase(), {
        appVersion: app.getVersion(),
        soulVersion: getActivePersonality().version,
        soulId: manifest.soulId,
        soulCreatedAt: manifest.createdAt,
        soulBirthVersion: manifest.birthVersion,
        continuityHash
      })
      // Directory format: manifest + soul + checksum, assets alongside
      fs.writeFileSync(path.join(base, BACKUP_MANIFEST_FILE), JSON.stringify(backup.manifest, null, 2), 'utf8')
      fs.writeFileSync(path.join(base, BACKUP_SOUL_FILE), JSON.stringify(backup.tables), 'utf8')

      // Include the avatar assets so sprites/Live2D/VRM survive a restore
      const avatarsDir = path.join(app.getPath('userData'), 'avatars')
      if (fs.existsSync(avatarsDir)) {
        copyFolderRecursive(avatarsDir, path.join(base, 'avatars'))
      }

      // Life Timeline：灵魂归档（每天去重）
      try {
        recordLifeEvent('soul_archived', '灵魂被完整归档', '导出了整个生命：身份/人格/记忆/关系/成长经历', `soul_archived_${new Date().toDateString()}`, 'normal')
      } catch { /* best-effort */ }

      return { success: true, filePath: base }
    } catch (e: any) {
      return { success: false, error: e?.message || '写入失败' }
    }
  })

  // Data import: atomic restore.
  // 1. validate manifest + checksum        → reject bad backups
  // 2. restore into a staging DB           → reject on any row error
  // 3. swap: rename live DB aside, staging in place → old data never lost
  // 4. write a restore report → restart — the new life state boots fresh
  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择备份文件夹（或旧版 backup.json）',
      properties: ['openFile', 'openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' }

    const selected = result.filePaths[0]
    let stagingPath: string | null = null
    try {
      const stat = fs.statSync(selected)
      const isDir = stat.isDirectory()
      const file = readBackupFile(selected, isDir)
      if (!file) return { success: false, error: '该位置没有有效的备份（manifest.json / backup.json）' }

      const error = validateBackup(file, { requireChecksum: !!file.manifest.checksum })
      if (error) return { success: false, error }

      // Secrets are machine-bound — preserve the live ones across the restore
      const db = getDatabase()
      const preserveConfig = db.prepare("SELECT key, value, updated_at FROM config WHERE key LIKE 'sec_%'").all() as { key: string; value: string; updated_at: number }[]

      // Stage 1: restore into a temp database
      stagingPath = path.join(app.getPath('userData'), `restore-staging-${Date.now()}.db`)
      const staging = new Database(stagingPath)
      runMigrations(staging)
      let report: RestoreReport
      try {
        const result = restoreInto(staging, file, { preserveConfig })
        report = buildRestoreReport(file, result)
        // The report survives the restart: it lives in the restored DB
        staging.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)').run(
          'restore_report',
          JSON.stringify(report),
          Date.now()
        )
        // Life Timeline：灵魂回来了（直接写进被恢复的库，跟着灵魂走，major 永久保留）
        try {
          staging.prepare('INSERT OR IGNORE INTO life_events (id, event_type, title, detail, created_at, level) VALUES (?, ?, ?, ?, ?, ?)')
            .run(uuidv4(), 'soul_restored', '灵魂回来了', '从备份中完整恢复', Date.now(), 'major')
        } catch { /* best-effort */ }
      } catch (e) {
        staging.close()
        fs.rmSync(stagingPath, { force: true })
        stagingPath = null
        throw e
      }
      staging.close()

      // Stage 2: atomic swap — old DB is renamed (recoverable), never deleted
      closeDatabase()
      const livePath = path.join(app.getPath('userData'), 'inkspirit.db')
      const stamp = Date.now()
      for (const suffix of ['', '-wal', '-shm']) {
        const p = livePath + suffix
        if (fs.existsSync(p)) fs.renameSync(p, `${p}.pre-restore-${stamp}`)
      }
      fs.renameSync(stagingPath, livePath)
      stagingPath = null

      // Stage 3: avatar assets (best-effort; DB is already safely swapped)
      let avatarError: string | null = null
      if (isDir) {
        const srcAvatars = path.join(selected, 'avatars')
        const destAvatars = path.join(app.getPath('userData'), 'avatars')
        if (fs.existsSync(srcAvatars)) {
          try {
            fs.rmSync(destAvatars, { recursive: true, force: true })
            copyFolderRecursive(srcAvatars, destAvatars)
          } catch (e: any) {
            avatarError = e?.message ?? '形象资源恢复失败'
          }
        }
      }

      // Stage 4: restart so every cached statement/prepared handle is fresh
      app.relaunch()
      app.exit(0)
      return { success: true, filePath: selected, report, warning: avatarError }
    } catch (e: any) {
      if (stagingPath) {
        try { fs.rmSync(stagingPath, { force: true }) } catch { /* ignore */ }
      }
      return { success: false, error: e?.message || '导入失败' }
    }
  })
}

export interface RestoreReport {
  personalities: number
  evolutionLogs: number
  relationships: number
  relationshipLogs: number
  memories: number
  dailyPatterns: number
  behaviorLogs: number
  conversations: number
  skippedUnknown: string[]
  /** Soul Manifest：归档里的灵魂身份 + 连续性校验结果（哲学身份） */
  soul?: {
    soulId: string
    createdAt?: number
    birthVersion?: string
    archiveConsistent: boolean
    isSameSoul: boolean
    welcomeLine: string
  }
}

function buildRestoreReport(file: BackupFile, result: { tables: Record<string, number>; skippedUnknown: string[] }): RestoreReport {
  const t = result.tables
  const report: RestoreReport = {
    personalities: t.personalities ?? 0,
    evolutionLogs: t.personality_evolution_log ?? 0,
    relationships: t.relationships ?? 0,
    relationshipLogs: t.relationship_change_log ?? 0,
    memories: t.memories ?? 0,
    dailyPatterns: t.daily_patterns ?? 0,
    behaviorLogs: t.behavior_logs ?? 0,
    conversations: t.conversations ?? 0,
    skippedUnknown: result.skippedUnknown
  }

  // Soul Manifest：归档内部一致 + 与当前灵魂是否同一个
  const m = file.manifest
  if (m.soulId) {
    const archivedHash = computeContinuityHash(m.soulId, file.tables)
    const archiveConsistent = !m.continuityHash || archivedHash === m.continuityHash
    const liveSoulId = getConfig('soul_id')
    const isSameSoul = !liveSoulId || liveSoulId === m.soulId
    report.soul = {
      soulId: m.soulId,
      createdAt: m.soulCreatedAt,
      birthVersion: m.soulBirthVersion,
      archiveConsistent,
      isSameSoul,
      welcomeLine: isSameSoul
        ? '欢迎回来。它的名字、记忆、关系、成长经历，都还在。'
        : '这是一份新的生命档案——不是同一个砚灵，但它完整地到来。'
    }
  }

  return report
}

/**
 * Read a backup from any supported shape:
 * - new directory: manifest.json + soul.json
 * - old directory / single file: backup.json (manifest inside)
 * - legacy: {app,version,data}
 */
function readBackupFile(selected: string, isDir: boolean): BackupFile | null {
  const manifestPath = isDir ? path.join(selected, BACKUP_MANIFEST_FILE) : ''
  if (isDir && fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest
      const soulPath = path.join(selected, BACKUP_SOUL_FILE)
      if (!fs.existsSync(soulPath)) return null
      const tables = JSON.parse(fs.readFileSync(soulPath, 'utf8')) as Record<string, Record<string, unknown>[]>
      return { manifest, tables }
    } catch {
      return null
    }
  }

  const jsonPath = isDir ? path.join(selected, BACKUP_LEGACY_FILE) : selected
  if (!fs.existsSync(jsonPath)) return null
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8')
    const parsed = JSON.parse(raw) as BackupFile | { app?: string; version?: number; data: Record<string, unknown[]> }
    if (parsed && typeof parsed === 'object' && 'manifest' in parsed && (parsed as BackupFile).manifest) {
      return parsed as BackupFile
    }
    if (parsed && 'data' in parsed) {
      return legacyToBackup(parsed)
    }
  } catch {
    return null
  }
  return null
}

/** Convert the legacy {app, version, data} folder backup into the new format */
function legacyToBackup(parsed: { app?: string; version?: number; data: Record<string, unknown[]> }): BackupFile {
  if (parsed.app !== 'inkspirit' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('无效的备份文件')
  }
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const [table, rows] of Object.entries(parsed.data)) {
    tables[table] = rows as Record<string, unknown>[]
  }
  return {
    manifest: {
      format: BACKUP_FORMAT,
      formatVersion: 1,
      appVersion: 'legacy',
      schemaVersion: 1,
      soulVersion: 1,
      createdAt: Date.now(),
      checksum: ''
    },
    tables
  }
}

function copyFolderRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (fs.statSync(srcPath).isDirectory()) {
      copyFolderRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/** Delete the previously imported file for a sprite key (keep avatars tidy) */
function removeOldSprite(avatarsDir: string, spriteKey: string): void {
  try {
    if (!fs.existsSync(avatarsDir)) return
    const entries = fs.readdirSync(avatarsDir)
    for (const entry of entries) {
      if (entry.startsWith(`${spriteKey}_`)) {
        fs.rmSync(path.join(avatarsDir, entry), { force: true })
      }
    }
  } catch {
    // ignore cleanup errors
  }
}
