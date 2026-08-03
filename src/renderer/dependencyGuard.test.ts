import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * 渲染进程依赖隔离守卫 —— 防止原生模块/主进程代码进入渲染包。
 *
 * 历史事故：PetView 导入 core/soul/mood、SettingsView 导入 core/soul/lifeTimeline，
 * 这两者顶层 import core/database → better-sqlite3（原生模块）+ fs + electron。
 * 打包时被 vite 打进渲染 bundle，浏览器环境下执行到 better-sqlite3 的
 * `promisify is not a function`，整个渲染进程白屏——桌宠不显示、设置打不开。
 *
 * 守卫：静态遍历 src/renderer 的模块依赖图，断言永远不会到达：
 *   - src/core/database.ts（及其原生依赖 better-sqlite3）
 *   - 任何 electron 主进程模块（src/main/**）
 */
describe('renderer dependency isolation', () => {
  const ROOT = path.resolve(__dirname, '..', '..')
  const RENDERER_DIR = path.join(ROOT, 'src', 'renderer')
  const DB_MODULES = new Set([path.join(ROOT, 'src', 'core', 'database.ts')])
  const MAIN_DIR = path.join(ROOT, 'src', 'main')

  function resolveImport(fromFile: string, spec: string): string | null {
    if (!spec.startsWith('.')) return null
    const abs = path.resolve(path.dirname(fromFile), spec)
    for (const ext of ['.ts', '.tsx']) {
      if (fs.existsSync(abs + ext)) return abs + ext
    }
    for (const ext of ['.ts', '.tsx']) {
      if (fs.existsSync(path.join(abs, 'index' + ext))) return path.join(abs, 'index' + ext)
    }
    return null
  }

  function importsOf(file: string): string[] {
    const src = fs.readFileSync(file, 'utf8')
    const imports: string[] = []
    for (const m of src.matchAll(/^import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/gm)) {
      imports.push(m[1])
    }
    for (const m of src.matchAll(/^import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
      imports.push(m[1])
    }
    return imports
  }

  it('renderer dependency graph never reaches core/database.ts or main/', () => {
    const visited = new Set<string>()
    const queue: string[] = []
    for (const f of fs.readdirSync(RENDERER_DIR)) {
      if (/\.(ts|tsx)$/.test(f)) queue.push(path.join(RENDERER_DIR, f))
    }
    // 递归扫描目录（views/components/avatar/stores/design/hooks）
    const scan = (dir: string): void => {
      for (const e of fs.readdirSync(dir)) {
        const full = path.join(dir, e)
        if (fs.statSync(full).isDirectory()) scan(full)
        else if (/\.(ts|tsx)$/.test(e)) queue.push(full)
      }
    }
    scan(RENDERER_DIR)

    const forbidden: string[] = []
    while (queue.length > 0) {
      const file = queue.pop()!
      if (visited.has(file)) continue
      visited.add(file)
      for (const spec of importsOf(file)) {
        const target = resolveImport(file, spec)
        if (!target) continue
        if (DB_MODULES.has(target)) {
          forbidden.push(`${file} → ${target}`)
          continue
        }
        if (target.startsWith(MAIN_DIR)) {
          forbidden.push(`${file} → ${target}`)
          continue
        }
        if (!visited.has(target)) queue.push(target)
      }
    }

    expect(forbidden).toEqual([])
  })
})
