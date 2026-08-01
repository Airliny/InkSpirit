import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDatabase } from '../../core/database'
import { setConfig, getConfig, clearConfigCache } from '../../core/config'
import { clearEmotionCache } from '../../core/soul/emotion'
import { clearRelationshipCache } from '../../core/soul/relationship'
import { clearPersonalityCache } from '../../core/soul/personality'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getMainWindow } from '../windowManager'
import { Agent } from '../../core/agent'

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
          const filePath = val.replace(/^file:\/\/\/?/, '')
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

  // Data export: dump all tables + avatar assets to a backup folder
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

      const db = getDatabase()
      const tables = [
        'config',
        'conversations',
        'emotion_snapshots',
        'personalities',
        'relationships',
        'memories',
        'behavior_logs'
      ]
      const dump: Record<string, unknown[]> = {}
      for (const table of tables) {
        try {
          const rows = db.prepare(`SELECT * FROM ${table}`).all()
          dump[table] = rows
        } catch {
          dump[table] = []
        }
      }
      fs.writeFileSync(path.join(base, 'backup.json'), JSON.stringify({ app: 'inkspirit', version: 2, data: dump }), 'utf8')

      // Include the avatar assets so sprites/Live2D survive a restore
      const avatarsDir = path.join(app.getPath('userData'), 'avatars')
      if (fs.existsSync(avatarsDir)) {
        copyFolderRecursive(avatarsDir, path.join(base, 'avatars'))
      }
      return { success: true, filePath: base }
    } catch (e: any) {
      return { success: false, error: e?.message || '写入失败' }
    }
  })

  // Data import: restore tables + avatar assets from a backup folder or legacy .inkdata file
  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择备份文件夹（或旧版 .inkdata 文件）',
      properties: ['openFile', 'openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' }

    const selected = result.filePaths[0]
    try {
      const stat = fs.statSync(selected)
      const isDir = stat.isDirectory()
      const jsonPath = isDir ? path.join(selected, 'backup.json') : selected
      if (!fs.existsSync(jsonPath)) {
        return { success: false, error: '该文件夹不是有效的备份（缺少 backup.json）' }
      }

      const raw = fs.readFileSync(jsonPath, 'utf8')
      const parsed = JSON.parse(raw) as { app?: string; version?: number; data: Record<string, unknown[]> }
      if (parsed.app !== 'inkspirit' || !parsed.data) {
        return { success: false, error: '无效的备份文件' }
      }

      const db = getDatabase()
      const tables: { name: string; columns: string[] }[] = [
        { name: 'config', columns: ['key', 'value', 'updated_at'] },
        { name: 'conversations', columns: ['id', 'messages_json', 'summary', 'created_at'] },
        { name: 'emotion_snapshots', columns: ['id', 'state_json', 'timestamp'] },
        { name: 'personalities', columns: ['id', 'version', 'is_active', 'traits_json', 'created_at'] },
        { name: 'relationships', columns: ['user_id', 'trust', 'familiarity', 'affection', 'interaction_count', 'stage', 'first_interaction_at', 'last_interaction_at'] },
        { name: 'memories', columns: ['id', 'type', 'tier', 'content', 'summary', 'importance', 'emotional_valence', 'emotional_intensity', 'access_count', 'last_accessed_at', 'created_at', 'retention_score', 'decay_rate', 'tags', 'related_memory_ids', 'source_conversation_id'] },
        { name: 'behavior_logs', columns: ['id', 'behavior_id', 'triggered_by', 'outcome', 'timestamp'] }
      ]

      db.exec('BEGIN TRANSACTION')
      try {
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table.name}`).run()
          const rows = (parsed.data[table.name] ?? []) as Record<string, unknown>[]
          const insert = db.prepare(
            `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`
          )
          for (const row of rows) {
            insert.run(...table.columns.map(c => row[c] ?? null))
          }
        }
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }

      // Restore avatar assets if the backup folder includes them
      if (isDir) {
        const srcAvatars = path.join(selected, 'avatars')
        const destAvatars = path.join(app.getPath('userData'), 'avatars')
        if (fs.existsSync(srcAvatars)) {
          fs.rmSync(destAvatars, { recursive: true, force: true })
          copyFolderRecursive(srcAvatars, destAvatars)
        }
      }

      // In-memory caches are now stale — drop them
      clearConfigCache()
      clearEmotionCache()
      clearRelationshipCache()
      clearPersonalityCache()
      agent.resetClients()
      return { success: true, filePath: selected }
    } catch (e: any) {
      return { success: false, error: e?.message || '导入失败' }
    }
  })
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
