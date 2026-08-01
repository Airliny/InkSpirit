import { safeStorage } from 'electron'
import { getConfig, setConfig } from './config'

const PREFIX = 'enc:v1:'

/** Whether OS-level encryption is available (Windows DPAPI / macOS Keychain / Linux safeStorage backend) */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/** Encrypt a plaintext value for storage. Falls back to plaintext if encryption is unavailable. */
export function encryptValue(plaintext: string): string {
  if (!plaintext) return plaintext
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return PREFIX + safeStorage.encryptString(plaintext).toString('base64')
    }
  } catch {
    // fall through to plaintext
  }
  return plaintext
}

/** Decrypt a stored value. Returns null if it was encrypted but cannot be decrypted. */
export function decryptValue(stored: string): string | null {
  if (!stored) return stored
  if (stored.startsWith(PREFIX)) {
    try {
      const buf = Buffer.from(stored.slice(PREFIX.length), 'base64')
      return safeStorage.decryptString(buf)
    } catch {
      return null // cannot decrypt (e.g. data migrated to another machine)
    }
  }
  return stored // legacy plaintext
}

/** Store a sensitive value encrypted (config key prefixed with sec_) */
export function setSecureConfig(key: string, value: string): void {
  setConfig(`sec_${key}`, encryptValue(value))
}

/** Read and decrypt a sensitive value. Returns null when undecryptable. */
export function getSecureConfig(key: string): string | null {
  const stored = getConfig(`sec_${key}`)
  if (stored === null) return null
  return decryptValue(stored)
}

/** Migrate a legacy plaintext config key into the secure store. */
export function migrateToSecure(key: string): void {
  if (getSecureConfig(key) !== null) return
  const legacy = getConfig(key)
  if (legacy) {
    setSecureConfig(key, legacy)
    setConfig(key, '') // clear plaintext copy
  }
}
