import { createHash } from 'crypto'

interface CacheEntry {
  reply: string
  expiresAt: number
}

const TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ENTRIES = 50

const store = new Map<string, CacheEntry>()

export function cacheKey(provider: string, model: string, message: string): string {
  return createHash('sha256').update(`${provider}|${model}|${message}`).digest('hex')
}

export function getCachedReply(key: string): string | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.reply
}

export function setCachedReply(key: string, reply: string): void {
  if (!reply) return
  // Evict oldest entry when over capacity
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value
    if (oldestKey) store.delete(oldestKey)
  }
  store.set(key, { reply, expiresAt: Date.now() + TTL_MS })
}

export function clearCache(): void {
  store.clear()
}

export function getCacheSize(): number {
  return store.size
}
