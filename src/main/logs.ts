import { app } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Category-scoped logs under %APPDATA%/InkSpirit/logs/.
 *
 *   startup.log   启动检查点（01 app ready → 06 renderer ready）
 *   renderer.log  渲染进程崩溃 / JS 错误
 *   avatar.log    身体加载失败（Sprite/Live2D/VRM → 回退链）
 *   brain.log     大脑初始化/聊天/连接失败（不含聊天内容与密钥）
 *   updater.log   更新服务事件
 *
 * 原则：只记录崩溃/失败/关键事件，绝不记录聊天内容、记忆、API Key。
 * 日志写入失败绝不抛异常——日志不能破坏启动。
 */
export type LogCategory = 'startup' | 'renderer' | 'avatar' | 'brain' | 'updater'

const dirCache = new Map<LogCategory, string>()

export function logTo(category: LogCategory, message: string): void {
  try {
    let dir = dirCache.get(category)
    if (!dir) {
      dir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(dir, { recursive: true })
      dirCache.set(category, dir)
    }
    fs.appendFileSync(
      path.join(dir, `${category}.log`),
      `${new Date().toISOString()} ${message}\n`
    )
  } catch {
    // ignore — logging must never break the app
  }
}

/** Diagnostic page + support: expose where logs live */
export function logsDirectory(): string {
  return path.join(app.getPath('userData'), 'logs')
}
