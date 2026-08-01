import { describe, it, expect } from 'vitest'
import { parseManifest, validateManifest, isUpdateAvailable, compareVersions } from './updaterManifest'

const GOOD_MANIFEST = JSON.stringify({
  version: '0.5.0',
  minimumVersion: '0.4.2',
  releaseDate: '2026-08-01',
  download: 'InkSpirit-Setup-0.5.0.exe',
  sha256: 'abc123',
  databaseVersion: 5,
  soulVersion: 7,
  notes: ['Live2D 修复', '记忆系统优化']
})

describe('parseManifest', () => {
  it('解析合法 manifest', () => {
    const m = parseManifest(GOOD_MANIFEST)
    expect(m?.version).toBe('0.5.0')
    expect(m?.notes).toEqual(['Live2D 修复', '记忆系统优化'])
    expect(m?.databaseVersion).toBe(5)
  })

  it('拒绝畸形 JSON / 缺版本', () => {
    expect(parseManifest('not json')).toBeNull()
    expect(parseManifest('{"releaseDate":"x"}')).toBeNull()
    expect(parseManifest('{"version":"v1.2"}')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('基础比较', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('0.2.3', '0.2.3')).toBe(0)
    expect(compareVersions('0.2.3', '0.5.0')).toBe(-1)
  })
})

describe('validateManifest', () => {
  const ctx = { currentVersion: '0.4.2', currentSchemaVersion: 5 }

  it('正常新版本 → 可更新', () => {
    const m = parseManifest(GOOD_MANIFEST)!
    expect(validateManifest(m, ctx)).toEqual({ ok: true })
    expect(isUpdateAvailable(m, '0.4.2')).toBe(true)
  })

  it('同版本 → 不是更新', () => {
    const m = parseManifest(GOOD_MANIFEST)!
    expect(validateManifest(m, { ...ctx, currentVersion: '0.5.0' })).toEqual({ ok: false, reason: 'same-version' })
  })

  it('旧版本 release → 拒绝', () => {
    const m = { ...parseManifest(GOOD_MANIFEST)!, version: '0.3.0' }
    expect(validateManifest(m, ctx).reason).toBe('older-release')
  })

  it('降级 schema（databaseVersion < 当前）→ 拒绝（数据安全）', () => {
    const m = { ...parseManifest(GOOD_MANIFEST)!, databaseVersion: 4 }
    expect(validateManifest(m, ctx)).toEqual({ ok: false, reason: 'downgrade-schema' })
  })

  it('当前版本低于 minimumVersion → 强制更新语义', () => {
    const m = parseManifest(GOOD_MANIFEST)!
    const v = validateManifest(m, { ...ctx, currentVersion: '0.4.0' })
    expect(v).toEqual({ ok: true, reason: 'required-update' })
  })
})
