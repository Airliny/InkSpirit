import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDatabase } from '../../core/database'
import { setConfig, getConfig } from '../../core/config'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getMainWindow } from '../windowManager'

export function registerDataHandlers(): void {
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
    return getConfig('live2d_path') !== null || getConfig('sprite_idle') !== null
  })

  // Get model type
  ipcMain.handle('model:getType', () => {
    return getConfig('model_type') || 'sprites'
  })

  // Get Live2D path
  ipcMain.handle('model:getLive2DPath', () => {
    return getConfig('live2d_path')
  })

  // Data export: dump all tables to a JSON file
  ipcMain.handle('data:export', async () => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'InkSpirit Data', extensions: ['inkdata'] }]
    })
    if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

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
    try {
      fs.writeFileSync(result.filePath, JSON.stringify({ app: 'inkspirit', version: 1, data: dump }), 'utf8')
      return { success: true, filePath: result.filePath }
    } catch (e: any) {
      return { success: false, error: e?.message || '写入失败' }
    }
  })

  // Data import: read a JSON dump and replace table contents
  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'InkSpirit Data', extensions: ['inkdata'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' }

    const filePath = result.filePaths[0]
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
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
      return { success: true, filePath }
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
