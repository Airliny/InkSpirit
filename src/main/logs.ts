import { app } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Category-scoped logs under %APPDATA%/InkSpirit/logs/.
 *
 *   startup.log   启动检查点（01 app ready → 06 renderer ready）+ 结果标记
 *   renderer.log  渲染进程崩溃 / JS 错误
 *   avatar.log    身体加载失败（Sprite/Live2D/VRM → 回退链）
 *   brain.log     大脑初始化/聊天/连接失败（不含聊天内容与密钥）
 *   updater.log   更新服务事件
 *
 * 原则：只记录崩溃/失败/关键事件，绝不记录聊天内容、记忆、API Key。
 * 日志写入失败绝不抛异常——日志不能破坏启动。
 *
 * 隐私：所有写盘前经过 sanitizeLog() —— 过滤密钥/token/用户目录路径，
 * 即使调用方误传敏感信息，日志里也不会出现。
 */
export type LogCategory = 'startup' | 'renderer' | 'avatar' | 'brain' | 'updater'

const dirCache = new Map<LogCategory, string>()

/**
 * 统一脱敏：调用方写什么都可以，但落盘前过滤敏感信息。
 *   - key= / api_key= / token= / secret= / password= / apikey= 的值
 *   - Bearer <token>、sk-<token>
 *   - Windows/Linux/macOS 用户目录（C:\Users\xxx、/home/xxx、/Users/xxx）
 */
export function sanitizeLog(raw: string): string {
  let s = raw
  // Bearer <token> 整段过滤（先于通用键值规则，避免把 "Bearer" 也吞掉）
  s = s.replace(/(bearer\s+)(sk-[a-zA-Z0-9_.-]{6,})/gi, '$1<redacted>')
  // 密钥类键值对：key= / api_key= / token= / secret= / password= 的值
  s = s.replace(/\b(key|api[_-]?key|token|secret|password|access[_-]?key)\s*[=:]\s*[^\s,&'"；;]+/gi, '$1=<redacted>')
  // 裸 sk-/pk- 令牌
  s = s.replace(/\b(?:sk|pk)-[a-zA-Z0-9]{16,}\b/g, '<redacted-token>')
  // 用户目录（Windows / Linux / macOS）
  s = s.replace(/([A-Za-z]:\\Users\\)[^\\/\\"']+/g, '$1<redacted>')
  s = s.replace(/\/home\/[^/\\"'\s]+/g, '/home/<redacted>')
  s = s.replace(/\/Users\/[^/\\"'\s]+/g, '/Users/<redacted>')
  return s
}

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
      `${new Date().toISOString()} ${sanitizeLog(message)}\n`
    )
  } catch {
    // ignore — logging must never break the app
  }
}

/** Diagnostic page + support: expose where logs live */
export function logsDirectory(): string {
  return path.join(app.getPath('userData'), 'logs')
}
