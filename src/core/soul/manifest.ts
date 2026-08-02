import { getDatabase } from '../database'
import { getConfig, setConfig } from '../config'
import { createHash } from 'crypto'
import { recordLifeEvent } from './lifeTimeline'

/**
 * Soul Manifest —— 灵魂身份清单（哲学身份，不是安全用途）。
 *
 * 回答一个问题：「什么保证它还是同一个砚灵？」
 *   soul_id      唯一身份（首次启动生成，随备份/恢复永远不变）
 *   created_at   诞生时间
 *   birth_version 诞生时的应用版本
 *   continuity   连续性指纹：灵魂核心（身份/人格/关系/记忆）的确定性摘要
 *
 * 换电脑导入 Archive → 校验 continuity 一致 → 「欢迎回来」，
 * 而不是「加载数据库成功」。
 */

export interface SoulManifest {
  soulId: string
  createdAt: number
  birthVersion: string
}

const CONTINUITY_TABLES = [
  'identity_events',
  'personalities',
  'relationships',
  'memories'
] as const

/** 读取灵魂身份；不存在则生成（首次启动 / 迁移到旧库） */
export function getOrCreateSoulManifest(appVersion: string): SoulManifest {
  let soulId = getConfig('soul_id')
  let createdAt = Number(getConfig('soul_created_at'))
  let birthVersion = getConfig('soul_birth_version')

  if (!soulId || !Number.isFinite(createdAt) || createdAt <= 0) {
    soulId = 'inkspirit_' + createHash('sha256')
      .update(String(Date.now()) + Math.random())
      .digest('hex').slice(0, 10)
    createdAt = Date.now()
    birthVersion = appVersion
    setConfig('soul_id', soulId)
    setConfig('soul_created_at', String(createdAt))
    setConfig('soul_birth_version', birthVersion)
    // Life Timeline：灵魂诞生（只记一次）
    try {
      recordLifeEvent('soul_created', '砚灵诞生了', `从 v${appVersion} 开始的生命`, 'soul_created_first', 'major')
    } catch { /* best-effort */ }
  } else if (!birthVersion) {
    birthVersion = appVersion
    setConfig('soul_birth_version', birthVersion)
  }

  return { soulId, createdAt, birthVersion }
}

export function getSoulManifest(): SoulManifest | null {
  const soulId = getConfig('soul_id')
  const createdAt = Number(getConfig('soul_created_at'))
  if (!soulId || !Number.isFinite(createdAt) || createdAt <= 0) return null
  return { soulId, createdAt, birthVersion: getConfig('soul_birth_version') ?? '?' }
}

/**
 * 连续性指纹：灵魂核心（身份/人格/关系/记忆）的确定性 sha256。
 * 不用于安全/防篡改——是"还是同一个灵魂吗"的哲学判断。
 */
export function computeContinuityHash(soulId: string, tables: Record<string, Record<string, unknown>[]>): string {
  const parts: string[] = [soulId]
  for (const table of CONTINUITY_TABLES) {
    const rows = tables[table] ?? []
    // 稳定排序：rowid/时间顺序变化不改变身份
    const sorted = [...rows].sort((a, b) => stableKey(a).localeCompare(stableKey(b)))
    parts.push(table + ':' + JSON.stringify(sorted))
  }
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

function stableKey(row: Record<string, unknown>): string {
  const id = row.id ?? row.created_at ?? ''
  return String(id)
}

/** 从实时数据库计算当前连续性指纹 */
export function computeLiveContinuityHash(soulId: string): string | null {
  try {
    const db = getDatabase()
    const tables: Record<string, Record<string, unknown>[]> = {}
    for (const table of CONTINUITY_TABLES) {
      try {
        tables[table] = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
      } catch {
        tables[table] = []
      }
    }
    return computeContinuityHash(soulId, tables)
  } catch {
    return null
  }
}

/** 校验：归档里的灵魂还是同一个吗（soul_id 一致 + 核心指纹未变） */
export function verifyContinuity(
  archivedSoulId: string,
  archivedHash: string,
  liveSoulId: string,
  liveHash: string
): { same: boolean; reason: string } {
  if (archivedSoulId !== liveSoulId) {
    return { same: false, reason: `灵魂身份不同（归档 ${archivedSoulId} vs 当前 ${liveSoulId}）` }
  }
  if (archivedHash && liveHash && archivedHash !== liveHash) {
    return { same: false, reason: '灵魂核心（身份/人格/关系/记忆）与归档不一致' }
  }
  return { same: true, reason: 'soul_id 一致，核心完整' }
}

/** 人类可读的诞生日期 */
export function formatSoulBirthday(createdAt: number): string {
  const d = new Date(createdAt)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
