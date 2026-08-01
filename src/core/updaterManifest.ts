/**
 * Update manifest — the single source of truth for a release.
 * The client never parses GitHub release pages; it only reads this file.
 * Pure logic: no electron, fully testable.
 */

export type UpdateChannel = 'stable' | 'beta' | 'nightly'

export interface UpdateManifest {
  version: string
  /** versions below this must update before continuing */
  minimumVersion?: string
  releaseDate?: string
  download?: string
  sha256?: string
  /** schema version of the bundled database migrations */
  databaseVersion?: number
  /** personality/identity format version of the release */
  soulVersion?: number
  notes?: string[]
  channel?: UpdateChannel
}

export interface ManifestValidation {
  ok: boolean
  reason?: 'invalid-version' | 'same-version' | 'downgrade-schema' | 'older-release' | 'required-update'
}

/** Parse and structurally validate a manifest JSON string */
export function parseManifest(json: string): UpdateManifest | null {
  try {
    const raw = JSON.parse(json) as UpdateManifest
    if (!raw || typeof raw.version !== 'string' || !/^\d+\.\d+\.\d+/.test(raw.version)) return null
    return raw
  } catch {
    return null
  }
}

/** Semver-ish compare: a < b → -1, equal → 0, a > b → 1 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da < db ? -1 : 1
  }
  return 0
}

/**
 * Validate a manifest against the running app.
 * - same version / older release → not an update
 * - release with older schema than the running DB → refuse (data safety)
 * - current version below minimumVersion → mandatory update
 */
export function validateManifest(
  manifest: UpdateManifest,
  ctx: { currentVersion: string; currentSchemaVersion: number }
): ManifestValidation {
  if (manifest.version === ctx.currentVersion) return { ok: false, reason: 'same-version' }
  if (compareVersions(manifest.version, ctx.currentVersion) < 0) return { ok: false, reason: 'older-release' }
  if (manifest.databaseVersion !== undefined && manifest.databaseVersion < ctx.currentSchemaVersion) {
    return { ok: false, reason: 'downgrade-schema' }
  }
  if (manifest.minimumVersion && compareVersions(ctx.currentVersion, manifest.minimumVersion) < 0) {
    return { ok: true, reason: 'required-update' }
  }
  return { ok: true }
}

export function isUpdateAvailable(manifest: UpdateManifest, currentVersion: string): boolean {
  return compareVersions(manifest.version, currentVersion) > 0
}
