import { describe, it, expect } from 'vitest'
import { sanitizeLog } from './logs'

/**
 * 日志脱敏 —— 落盘前统一过滤密钥/token/用户目录。
 * 即使调用方误传敏感信息，日志里也不允许出现：
 *   - API Key / token / secret / password 值
 *   - Bearer / sk- 令牌
 *   - Windows 用户目录（C:\Users\xxx）与 Linux/macOS 用户目录
 */

describe('sanitizeLog', () => {
  it('过滤 key= 值', () => {
    expect(sanitizeLog('config key=sk-abc123xyz456 bad')).toBe('config key=<redacted> bad')
  })

  it('过滤 api_key / token / secret / password 值（大小写不敏感）', () => {
    expect(sanitizeLog('api_key=deadbeef123')).toBe('api_key=<redacted>')
    expect(sanitizeLog('API_KEY=deadbeef123')).toBe('API_KEY=<redacted>')
    expect(sanitizeLog('token=abc')).toBe('token=<redacted>')
    expect(sanitizeLog('secret=xyz')).toBe('secret=<redacted>')
    expect(sanitizeLog('password=hunter2')).toBe('password=<redacted>')
    expect(sanitizeLog('apikey=qwerty123456')).toBe('apikey=<redacted>')
  })

  it('过滤 Bearer 与裸 sk- 令牌', () => {
    expect(sanitizeLog('Authorization: Bearer sk-proj-1234567890abcdef')).toBe('Authorization: Bearer <redacted>')
    expect(sanitizeLog('got sk-abcdefghijklmnopqrstuvwx123456 in body')).toBe('got <redacted-token> in body')
  })

  it('过滤 Windows 用户目录', () => {
    expect(sanitizeLog('C:\\Users\\张三\\AppData\\Roaming\\InkSpirit')).toBe('C:\\Users\\<redacted>\\AppData\\Roaming\\InkSpirit')
  })

  it('过滤 Linux / macOS 用户目录', () => {
    expect(sanitizeLog('/home/zhang/.config/inkspirit')).toBe('/home/<redacted>/.config/inkspirit')
    expect(sanitizeLog('/Users/zhang/Library/Application Support')).toBe('/Users/<redacted>/Library/Application Support')
  })

  it('保留正常日志内容（不误伤）', () => {
    const msg = 'renderer crash (did-fail-load:-3) — reload #1'
    expect(sanitizeLog(msg)).toBe(msg)
  })
})
