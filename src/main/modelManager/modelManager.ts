import fetch from 'node-fetch'
import { getMainWindow } from '../windowManager'
import { getHardwareInfo, checkModelFeasible, type HardwareInfo, type ModelRequirement } from './hardware'

const OLLAMA_HOST = 'http://127.0.0.1:11434'

export interface OllamaModel {
  name: string
  model: string
  size: number
  modified_at: string
  digest: string
  details?: {
    parameter_size?: string
    quantization_level?: string
    family?: string
  }
}

export interface CatalogModel extends ModelRequirement {
  name: string
  tag: string
  size: string
  parameterSize: string
  description: string
  minVramGB: number
  minRamGB: number
}

// 内置常用模型目录（tag 即 ollama pull 的名字）
// minVramGB: 独立显存最低要求；minRamGB: 系统内存最低要求（核显/无显存时用内存）
const MODEL_CATALOG: CatalogModel[] = [
  { name: 'Qwen2.5', tag: 'qwen2.5:7b', size: '约 4.7GB', parameterSize: '7B', description: '通义千问 2.5，中文对话，通用助手', minVramGB: 6, minRamGB: 8 },
  { name: 'Qwen2.5 Coder', tag: 'qwen2.5-coder:7b', size: '约 4.7GB', parameterSize: '7B', description: '代码生成与理解', minVramGB: 6, minRamGB: 8 },
  { name: 'Qwen2.5', tag: 'qwen2.5:3b', size: '约 1.9GB', parameterSize: '3B', description: '轻量中文对话，低配可用', minVramGB: 3, minRamGB: 4 },
  { name: 'DeepSeek R1', tag: 'deepseek-r1:8b', size: '约 4.9GB', parameterSize: '8B', description: '深度推理模型', minVramGB: 7, minRamGB: 8 },
  { name: 'DeepSeek R1', tag: 'deepseek-r1:1.5b', size: '约 1.1GB', parameterSize: '1.5B', description: '轻量推理，低配可用', minVramGB: 2, minRamGB: 4 },
  { name: 'Llama 3.2', tag: 'llama3.2:3b', size: '约 2.0GB', parameterSize: '3B', description: 'Meta 多语言对话', minVramGB: 3, minRamGB: 8 },
  { name: 'Llama 3.2', tag: 'llama3.2:1b', size: '约 1.3GB', parameterSize: '1B', description: '超轻量，低配可用', minVramGB: 2, minRamGB: 4 },
  { name: 'Gemma 2', tag: 'gemma2:9b', size: '约 5.5GB', parameterSize: '9B', description: 'Google 通用模型', minVramGB: 8, minRamGB: 16 },
  { name: 'Mistral', tag: 'mistral:7b', size: '约 4.1GB', parameterSize: '7B', description: '英文通用对话', minVramGB: 6, minRamGB: 8 },
  { name: 'Qwen2.5', tag: 'qwen2.5:14b', size: '约 9.0GB', parameterSize: '14B', description: '中大型中文对话（需 16GB+ 内存）', minVramGB: 12, minRamGB: 16 }
]

async function api(path: string, init?: { method?: string; body?: string }): Promise<Response> {
  return fetch(OLLAMA_HOST + path, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body,
    signal: AbortSignal.timeout(15000)
  })
}

function send(channel: string, data: unknown): void {
  const win = getMainWindow()
  if (win) win.webContents.send(channel, data)
}

/** Ollama 是否安装并运行 */
export async function getOllamaStatus(): Promise<{ running: boolean; version?: string; error?: string }> {
  try {
    const res = await api('/api/version')
    if (!res.ok) return { running: false }
    const data = (await res.json()) as { version: string }
    return { running: true, version: data.version }
  } catch (e: any) {
    return { running: false, error: e?.message || '无法连接 Ollama' }
  }
}

/** 已安装模型列表 */
export async function listModels(): Promise<OllamaModel[]> {
  try {
    const res = await api('/api/tags')
    if (!res.ok) return []
    const data = (await res.json()) as { models?: OllamaModel[] }
    return data.models ?? []
  } catch {
    return []
  }
}

/**
 * 搜索可用模型：内置目录 + 已安装标记 + 硬件可行性 + 推荐
 * 返回 { models, hardware }
 */
export async function searchCatalog(): Promise<{
  models: (CatalogModel & {
    installed: boolean
    installedSize?: number
    feasible: boolean
    reason: string
    recommended: boolean
  })[]
  hardware: HardwareInfo
}> {
  const [installed, hardware] = await Promise.all([listModels(), getHardwareInfo()])

  // 推荐：在"可运行"的模型里，按参数量降序，选显存档位最匹配的 1-2 个
  const feasibleModels = MODEL_CATALOG.filter(m => checkModelFeasible(m, hardware).ok)
  const recommendedTags = new Set<string>()
  if (feasibleModels.length > 0) {
    // 优先推荐参数量最大但不超过显存上限两倍的模型，最多推荐 2 个
    const sorted = [...feasibleModels].sort((a, b) => parseInt(b.parameterSize) - parseInt(a.parameterSize))
    for (const m of sorted.slice(0, 2)) {
      recommendedTags.add(m.tag)
    }
    // 若推荐里没有轻量模型且用户显存很小，把最小的也标上
    if (hardware.vramGB !== null && hardware.vramGB < 6) {
      const lightest = [...feasibleModels].sort((a, b) => parseInt(a.parameterSize) - parseInt(b.parameterSize))[0]
      if (lightest) recommendedTags.add(lightest.tag)
    }
  }

  const models = MODEL_CATALOG.map(m => {
    const match = installed.find(i => i.name === m.tag)
    const check = checkModelFeasible(m, hardware)
    return {
      ...m,
      installed: !!match,
      installedSize: match?.size,
      feasible: check.ok,
      reason: check.reason,
      recommended: recommendedTags.has(m.tag)
    }
  })

  return { models, hardware }
}

/** 下载模型，流式推送进度（主进程强制硬件校验） */
export async function pullModel(model: string): Promise<{ success: boolean; error?: string }> {
  const catalogModel = MODEL_CATALOG.find(m => m.tag === model)
  if (catalogModel) {
    const hardware = await getHardwareInfo()
    const check = checkModelFeasible(catalogModel, hardware)
    if (!check.ok) {
      return { success: false, error: check.reason }
    }
  }

  try {
    const res = await fetch(OLLAMA_HOST + '/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true })
    })
    if (!res.ok || !res.body) {
      return { success: false, error: `拉取失败 (${res.status})` }
    }

    const reader = res.body as unknown as AsyncIterable<Uint8Array>
    let buffer = ''
    let lastPercent = -1
    for await (const chunk of reader) {
      buffer += new TextDecoder().decode(chunk)
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line) as { status: string; completed?: number; total?: number; error?: string }
          if (data.error) return { success: false, error: data.error }
          if (data.total) {
            const percent = Math.floor((data.completed! / data.total) * 100)
            if (percent !== lastPercent) {
              lastPercent = percent
              send('model:pullProgress', { model, percent, status: data.status })
            }
          } else {
            send('model:pullProgress', { model, percent: 100, status: data.status })
          }
        } catch {
          // ignore partial lines
        }
      }
    }
    send('model:pullProgress', { model, percent: 100, status: 'done' })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || '下载失败' }
  }
}

/** 删除模型 */
export async function removeModel(model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await api('/api/delete', { method: 'DELETE', body: JSON.stringify({ name: model }) })
    if (!res.ok) return { success: false, error: `删除失败 (${res.status})` }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || '删除失败' }
  }
}
