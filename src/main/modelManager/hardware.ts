import { app } from 'electron'
import os from 'os'

export interface HardwareInfo {
  totalRamGB: number
  vramGB: number | null
  gpuName: string
  detected: boolean
}

export async function getHardwareInfo(): Promise<HardwareInfo> {
  const totalRamGB = os.totalmem() / 1024 ** 3
  let vramGB: number | null = null
  let gpuName = ''

  try {
    const info = await app.getGPUInfo('complete')
    const devices = (info as any)?.info?.devices ?? []
    const dedicated = Math.max(0, ...devices.map((d: any) => d.dedicatedMemoryKB ?? 0))
    if (devices.length > 0) {
      gpuName = devices.map((d: any) => d.deviceName ?? '').filter(Boolean).join(' / ')
    }
    // dedicatedMemoryKB 有效（>0）时才认定有独立显存
    if (dedicated > 0) {
      vramGB = dedicated / 1024 / 1024
    }
  } catch {
    // 检测失败时 vramGB 保持 null
  }

  try {
    if (!gpuName) {
      const basic = await app.getGPUInfo('basic')
      gpuName = (basic as any)?.auxAttributes?.glRenderer ?? ''
    }
  } catch {
    // ignore
  }

  return {
    totalRamGB: Math.round(totalRamGB * 10) / 10,
    vramGB: vramGB === null ? null : Math.round(vramGB * 10) / 10,
    gpuName,
    detected: vramGB !== null || totalRamGB > 0
  }
}

export interface ModelRequirement {
  minVramGB: number
  minRamGB: number
}

export interface HardwareCheck {
  ok: boolean
  reason: string
}

/**
 * 校验模型在当前硬件上是否可运行。
 * - 检测到独立显存且不足 → 禁止（模型装不进去，会卡死/损坏体验）
 * - 检测不到显存（核显/远程桌面）→ 视为共享内存，用内存判定
 * - 内存不足 → 禁止
 */
export function checkModelFeasible(
  req: ModelRequirement,
  hw: HardwareInfo
): HardwareCheck {
  const vramOk = hw.vramGB === null || hw.vramGB >= req.minVramGB
  const ramOk = hw.totalRamGB >= req.minRamGB

  if (!vramOk) {
    return {
      ok: false,
      reason: `显存 ${hw.vramGB}GB 低于最低要求 ${req.minVramGB}GB，禁止安装本地模型`
    }
  }
  if (!ramOk) {
    return {
      ok: false,
      reason: `内存 ${hw.totalRamGB}GB 低于最低要求 ${req.minRamGB}GB，禁止安装本地模型`
    }
  }
  return { ok: true, reason: '' }
}
