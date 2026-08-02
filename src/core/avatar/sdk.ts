import type { AvatarCapabilities, AvatarDescriptor, AvatarType, AvatarSource } from './types'

/**
 * Avatar SDK —— 身体上传契约（v0.7 冻结）。
 *
 * 冻结格式：sprite / live2d / vrm 三种，不再增加（Spine/MMD/FBX/Unity Avatar
 * 都不入）。新增身体只需按本契约提供描述符 + 资产文件，砚灵自动适配——
 * 行为导演/情绪/设置页零改动。
 *
 * 详见 docs/AVATAR_SDK.md。
 */

/** 已冻结的身体格式（新增格式需要经过架构评审，不是加一行代码） */
export const FROZEN_AVATAR_TYPES: AvatarType[] = ['builtin', 'sprite', 'live2d', 'vrm']

/** capability 白名单（SDK 契约的一部分，防止自定义键悄悄膨胀） */
const CAPABILITY_KEYS: (keyof AvatarCapabilities)[] = [
  'look', 'blink', 'sway', 'breath', 'motion', 'expression',
  'tail', 'hand', 'face', 'skeleton'
]

export interface SdkValidation {
  ok: boolean
  errors: string[]
}

/** 校验一个身体描述符是否符合 Avatar SDK 契约 */
export function validateAvatarDescriptor(desc: unknown): SdkValidation {
  const errors: string[] = []
  if (!desc || typeof desc !== 'object') {
    return { ok: false, errors: ['描述符必须是对象'] }
  }
  const d = desc as Record<string, unknown>

  if (typeof d.id !== 'string' || d.id.length === 0) errors.push('id 必须是非空字符串')
  if (typeof d.name !== 'string' || d.name.length === 0) errors.push('name 必须是非空字符串')
  if (typeof d.type !== 'string') {
    errors.push('type 必须是字符串')
  } else if (!FROZEN_AVATAR_TYPES.includes(d.type as AvatarType)) {
    errors.push(`type 必须是已冻结格式之一：${FROZEN_AVATAR_TYPES.join(', ')}（当前 ${d.type} 未冻结）`)
  }

  if (!d.capabilities || typeof d.capabilities !== 'object') {
    errors.push('capabilities 必须是对象')
  } else {
    const caps = d.capabilities as Record<string, unknown>
    for (const key of Object.keys(caps)) {
      if (!CAPABILITY_KEYS.includes(key as keyof AvatarCapabilities)) {
        errors.push(`capabilities 含未注册键：${key}（能力词汇表已冻结）`)
      }
    }
    for (const key of CAPABILITY_KEYS) {
      if (key in caps && typeof caps[key] !== 'boolean') {
        errors.push(`capabilities.${key} 必须是布尔值`)
      }
    }
  }

  if (!d.source || typeof d.source !== 'object') {
    errors.push('source 必须是对象')
  } else {
    const src = d.source as Record<string, unknown>
    if (typeof src.kind !== 'string') {
      errors.push('source.kind 必须存在')
    } else if (!['builtin', 'sprites', 'live2d', 'vrm'].includes(src.kind)) {
      errors.push(`source.kind 未冻结：${src.kind}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

/** 主进程构建的身体描述符必须是 SDK 合法的（自检 + 测试锁定） */
export function assertSdkValid(desc: AvatarDescriptor): AvatarDescriptor {
  const v = validateAvatarDescriptor(desc)
  if (!v.ok) {
    throw new Error(`Avatar SDK 校验失败: ${v.errors.join('; ')}`)
  }
  return desc
}

/** 描述符 → SDK 契约要点（文档生成/诊断用） */
export function sdkSummary(desc: AvatarDescriptor): string {
  const caps = CAPABILITY_KEYS.filter((k) => desc.capabilities[k]).join('/')
  const src = sourceLabel(desc.source)
  return `${desc.name}（${desc.type} · ${src}）能力: ${caps}`
}

function sourceLabel(source: AvatarSource): string {
  switch (source.kind) {
    case 'builtin': return '内置'
    case 'sprites': return '精灵图'
    case 'live2d': return 'Live2D'
    case 'vrm': return '3D(VRM)'
    default: return '未知'
  }
}
