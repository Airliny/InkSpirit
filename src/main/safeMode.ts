/**
 * Safe mode — 主进程侧持久标志。
 *
 * 渲染进程第二次崩溃后进入 safe mode：只渲染内置「砚」，不加载 Live2D/VRM/
 * three.js 重资产。标志存在主进程（不随 renderer reload 丢失），新渲染进程
 * 启动时通过 IPC 查询，保证 safe-mode reload 后依然处于安全模式。
 * 会话内保持；应用重启后复位（若再次连续崩溃会再次进入）。
 */

let active = false

export function enterSafeMode(): void {
  active = true
}

export function isSafeModeActive(): boolean {
  return active
}

/** 测试接缝 */
export function resetSafeModeForTest(): void {
  active = false
}
