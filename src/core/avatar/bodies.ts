import type { AvatarCapabilities, AvatarDescriptor, SpriteSource } from './types'

/**
 * 身体描述符工厂 + 身体切换边界。
 *
 * 边界铁律：换身体（setCurrentBody）只写身体指向（current_avatar_id /
 * model_type），绝不允许触碰 identity / memory / relationship / personality。
 * bodySwitchConfigKeys() 供测试锁定这条契约。
 */

export const BUILTIN_BODY_ID = 'builtin_ink'
export const SPRITE_BODY_ID = 'sprite_kit'
export const LIVE2D_BODY_ID = 'live2d_custom'
export const VRM_BODY_ID = 'vrm_3d'

export const BUILTIN_CAPABILITIES: AvatarCapabilities = {
  look: false, blink: false, sway: true, breath: false, motion: false, expression: false
}

export const SPRITE_CAPABILITIES: AvatarCapabilities = {
  look: true, blink: false, sway: true, breath: true, motion: true, expression: true
}

export const LIVE2D_CAPABILITIES: AvatarCapabilities = {
  look: true, blink: true, sway: false, breath: true, motion: true, expression: true
}

/** 3D 身体（VRM）：骨骼完整，全部能力可用 */
export const VRM_CAPABILITIES: AvatarCapabilities = {
  look: true, blink: true, sway: true, breath: true, motion: true, expression: true,
  skeleton: true
}

/** 换身体允许触碰的配置键——测试断言灵魂键不在这里 */
export function bodySwitchConfigKeys(): string[] {
  return ['current_avatar_id', 'model_type']
}

/** 内置身体 —— 任何情况下都不允许消失的最后退路（渲染层无需 IPC 即可构造） */
export const BUILTIN_BODY_DESCRIPTOR: AvatarDescriptor = {
  id: BUILTIN_BODY_ID,
  name: '默认砚灵',
  type: 'builtin',
  source: { kind: 'builtin' },
  capabilities: BUILTIN_CAPABILITIES,
  metadata: { format: '内置', note: '任何时候都不会消失的身体' }
}

export function buildBodyDescriptors(sprites: SpriteSource, live2dPath: string | null, vrmPath: string | null): AvatarDescriptor[] {
  const bodies: AvatarDescriptor[] = [BUILTIN_BODY_DESCRIPTOR]

  const hasSprite = Object.values(sprites).some(Boolean)
  if (hasSprite) {
    bodies.push({
      id: SPRITE_BODY_ID,
      name: '精灵图',
      type: 'sprite',
      source: { kind: 'sprites', sprites },
      capabilities: SPRITE_CAPABILITIES,
      metadata: { format: 'PNG/GIF', note: '单张图也能呼吸、摆动、看向你' }
    })
  }

  if (live2dPath) {
    bodies.push({
      id: LIVE2D_BODY_ID,
      name: 'Live2D',
      type: 'live2d',
      source: { kind: 'live2d', modelPath: live2dPath },
      capabilities: LIVE2D_CAPABILITIES,
      metadata: { format: '.model3.json', note: '自带呼吸/眨眼/动作' }
    })
  }

  if (vrmPath) {
    bodies.push({
      id: VRM_BODY_ID,
      name: '3D 身体',
      type: 'vrm',
      source: { kind: 'vrm', modelPath: vrmPath },
      capabilities: VRM_CAPABILITIES,
      metadata: { format: '.vrm', note: '三维身体：骨骼/表情/动作完整' }
    })
  }

  return bodies
}

/**
 * 当前身体解析：显式选择优先，否则按旧配置（model_type + 已有资产）推导，
 * 保证老用户升级后身体不丢。
 */
export function resolveCurrentBodyId(
  currentId: string | null,
  modelType: string,
  bodies: AvatarDescriptor[]
): string {
  if (currentId && bodies.some((b) => b.id === currentId)) return currentId
  if (modelType === 'live2d' && bodies.some((b) => b.type === 'live2d')) return LIVE2D_BODY_ID
  if (modelType === 'vrm' && bodies.some((b) => b.type === 'vrm')) return VRM_BODY_ID
  if (bodies.some((b) => b.type === 'sprite')) return SPRITE_BODY_ID
  return BUILTIN_BODY_ID
}
