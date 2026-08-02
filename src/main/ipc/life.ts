import { ipcMain } from 'electron'
import { app } from 'electron'
import { getLifeEvents, getTodayLifeEvents, hasLifeEvent, recordLifeEvent } from '../../core/soul/lifeTimeline'
import { getOrCreateSoulManifest, getSoulManifest, computeLiveContinuityHash, formatSoulBirthday } from '../../core/soul/manifest'
import { getCurrentMood } from '../../core/soul/mood'

/**
 * Life Timeline IPC —— 成长经历（砚灵日志）+ Soul Manifest（哲学身份）。
 * 不是开发日志：是"它经历过的日子"。
 */
export function registerLifeHandlers(): void {
  ipcMain.handle('life:getEvents', (_event, limit = 100) => getLifeEvents(limit))

  ipcMain.handle('life:getToday', () => getTodayLifeEvents())

  // Soul Manifest：我是谁（soul_id 首次访问时生成）
  ipcMain.handle('life:getSoulManifest', () => {
    const manifest = getOrCreateSoulManifest(app.getVersion())
    return {
      ...manifest,
      continuityOk: computeLiveContinuityHash(manifest.soulId) !== null,
      birthday: formatSoulBirthday(manifest.createdAt)
    }
  })

  // 当前心境（生命状态主页用）
  ipcMain.handle('life:getMoodState', () => getCurrentMood())

  // 首次对话里程碑（由 chat 流程调用，这里提供幂等检查）
  ipcMain.handle('life:recordFirstChat', (_event, snippet: string) => {
    if (hasLifeEvent('first_chat')) return false
    const short = snippet.length > 40 ? snippet.slice(0, 40) + '…' : snippet
    recordLifeEvent('first_chat', '第一次对话', `你对它说了：「${short}」`)
    return true
  })

  // 第一次记住重要的事（记忆语义化提取里程碑）
  ipcMain.handle('life:recordMemoryKept', (_event, snippet: string) => {
    if (hasLifeEvent('memory_kept')) return false
    recordLifeEvent('memory_kept', '第一次记住重要的事', `它记住了：「${snippet}」`)
    return true
  })
}
