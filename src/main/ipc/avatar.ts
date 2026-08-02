import { ipcMain, dialog, BrowserWindow } from 'electron'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { getConfig, setConfig } from '../../core/config'
import {
  buildBodyDescriptors,
  resolveCurrentBodyId,
  bodySwitchConfigKeys
} from '../../core/avatar/bodies'
import { parseBodyPreferences, serializeBodyPreferences } from '../../core/avatar/preferences'
import { applyInteraction } from '../../core/avatar/touchQuality'
import type { InteractionKind } from '../../core/avatar/touchQuality'
import { hasLifeEvent, recordLifeEvent } from '../../core/soul/lifeTimeline'
import type { SpriteSource } from '../../core/avatar/types'
import { getMainWindow } from '../windowManager'
import { logTo } from '../logs'

const SPRITE_KEYS = ['idle', 'walk', 'sleep', 'sit', 'stretch', 'yawn', 'surprised', 'happy', 'sad', 'love']

function getSpriteSource(): SpriteSource {
  const sprites: SpriteSource = {}
  for (const k of SPRITE_KEYS) {
    const v = getConfig(`sprite_${k}`)
    if (v) (sprites as Record<string, string>)[k] = v
  }
  return sprites
}

function listBodies() {
  const live2d = getConfig('live2d_path') || null
  const vrm = getConfig('vrm_path') || null
  return buildBodyDescriptors(getSpriteSource(), live2d, vrm)
}

/**
 * 换身体边界：只写 bodySwitchConfigKeys() 里的身体指向键，
 * identity/memory/relationship/personality 分毫不动（测试锁定）。
 */
export function registerAvatarHandlers(): void {
  ipcMain.handle('avatar:listBodies', () => listBodies())

  ipcMain.handle('avatar:getCurrent', () => {
    const bodies = listBodies()
    return resolveCurrentBodyId(getConfig('current_avatar_id'), getConfig('model_type') || 'sprites', bodies)
  })

  ipcMain.handle('avatar:setCurrent', (_event, id: string) => {
    const bodies = listBodies()
    const body = bodies.find((b) => b.id === id)
    if (!body) return { success: false, error: '身体不存在' }
    for (const key of bodySwitchConfigKeys()) {
      if (key === 'current_avatar_id') setConfig(key, body.id)
      else if (key === 'model_type') {
        setConfig(key, body.type === 'live2d' ? 'live2d' : body.type === 'vrm' ? 'vrm' : 'sprites')
      }
    }
    // Life Timeline：第一次换身体（换衣服不是换角色，但第一次值得记住）
    const prev = getConfig('current_avatar_id')
    if (!prev || prev !== body.id) {
      if (!hasLifeEvent('body_changed')) {
        recordLifeEvent('body_changed', '换上了新的身体', `换成了「${body.name}」（${body.type}）`, undefined, 'major')
      }
    }
    return { success: true, body }
  })

  // 导入 3D 身体（.vrm）—— 是"新的身体类型"，不是"支持 VRM 模型"
  ipcMain.handle('avatar:importVrm', async () => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win as BrowserWindow, {
      title: '选择 3D 身体 (.vrm)',
      filters: [{ name: 'VRM 模型', extensions: ['vrm'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const srcPath = result.filePaths[0]
    const avatarsDir = path.join(app.getPath('userData'), 'avatars')
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true })

    // 重新导入不累积旧文件
    const oldVrm = getConfig('vrm_path')
    if (oldVrm && oldVrm.startsWith(avatarsDir) && path.basename(oldVrm).startsWith('vrm_')) {
      try { fs.rmSync(oldVrm, { force: true }) } catch { /* best-effort */ }
    }

    const destPath = path.join(avatarsDir, `vrm_${Date.now()}.vrm`)
    try {
      fs.copyFileSync(srcPath, destPath)
    } catch (err) {
      logTo('avatar', `VRM import copy failed: ${err instanceof Error ? err.message : err}`)
      return { success: false, error: '模型文件复制失败，请检查权限' }
    }
    setConfig('vrm_path', destPath)
    setConfig('model_type', 'vrm')
    return { success: true, path: destPath }
  })

  // 身体偏好（唯一持久化的身体数据——瞬时状态永不落盘）
  ipcMain.handle('avatar:getPrefs', () => parseBodyPreferences(getConfig('body_preferences')))

  ipcMain.handle('avatar:setPrefs', (_event, prefs: unknown) => {
    const parsed = parseBodyPreferences(prefs === null || prefs === undefined ? null : JSON.stringify(prefs))
    setConfig('body_preferences', serializeBodyPreferences(parsed))
    return { success: true, prefs: parsed }
  })

  // Body Memory：交互质量（config 键，不进灵魂表；不是点击次数养成游戏）
  ipcMain.handle('avatar:getTouchQuality', () => {
    const raw = getConfig('body_touch_quality')
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  })

  ipcMain.handle('avatar:addInteraction', (_event, kind: InteractionKind) => {
    const raw = getConfig('body_touch_quality')
    const current = Number.isFinite(Number(raw)) ? Number(raw) : 0
    const next = applyInteraction(current, kind)
    setConfig('body_touch_quality', String(next))
    return next
  })
}
