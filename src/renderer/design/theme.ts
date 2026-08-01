/**
 * 主题管理 — 浅色 / 深色 / 跟随系统
 * 持久化到本地配置（theme），并用 localStorage 做启动时无闪烁恢复。
 */
export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ink_theme'

function matchSystemDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** 将偏好映射为实际 data-theme 属性（system → light/dark） */
export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return matchSystemDark() ? 'dark' : 'light'
  return pref
}

export function applyTheme(pref: ThemePreference): void {
  const resolved = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', pref === 'system' ? 'system' : resolved)
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {}
}

/** 启动时同步恢复上次主题（避免深色用户闪白） */
export function initThemeSync(): void {
  let pref: ThemePreference = 'light'
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved
  } catch {}
  applyTheme(pref)
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await window.inkAPI.getConfig('theme')
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {}
  return 'light'
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  applyTheme(pref)
  try {
    await window.inkAPI.setConfig('theme', pref)
  } catch {}
}

/** 跟随系统时监听系统主题变化 */
export function watchSystemTheme(cb: (dark: boolean) => void): () => void {
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!mql) return () => {}
  const handler = () => cb(mql.matches)
  mql.addEventListener?.('change', handler)
  return () => mql.removeEventListener?.('change', handler)
}
