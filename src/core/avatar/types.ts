/**
 * Avatar Engine — 共享类型（主进程/渲染进程/行为系统共用）
 *
 * 核心思想：身体只是渲染载体。UI 不知道这是 Live2D 还是 Sprite 还是 VRM，
 * 它只知道「这是一个身体」。换身体只改身体指向，不碰灵魂。
 */

/** 身体动画状态（渲染器语言，行为导演输出到这里） */
export type AnimationState =
  | 'idle' | 'walk' | 'sleep' | 'sit' | 'stretch'
  | 'yawn' | 'surprised' | 'happy' | 'sad' | 'love' | 'blink'

export interface SpriteSource {
  idle?: string; walk?: string; sleep?: string; sit?: string
  stretch?: string; yawn?: string; surprised?: string
  happy?: string; sad?: string; love?: string
}

export interface Live2DSource {
  type: 'live2d' | 'spine'
  modelPath: string
}

/** 兼容旧接口（新代码请用 AvatarDescriptor） */
export type ModelSource =
  | { type: 'builtin' }
  | { type: 'sprites'; sprites: SpriteSource }
  | { type: 'live2d'; live2d: Live2DSource }

export type AvatarType = 'builtin' | 'sprite' | 'live2d' | 'spine' | 'vrm'

/**
 * 身体表达能力（Body Personality）——行为导演按能力选动作：
 * 「摇尾巴」只发给有 tail 的身体，机器人身体永远不会收到。
 */
export interface AvatarCapabilities {
  look: boolean        // 视线跟随（偶尔偷看）
  blink: boolean       // 眨眼
  sway: boolean        // 重心摆动
  breath: boolean      // 呼吸
  motion: boolean      // 动作（走/坐/睡/伸懒腰/打哈欠）
  expression: boolean  // 情绪表情
  tail?: boolean       // 尾巴
  hand?: boolean       // 手
  face?: boolean       // 脸
  skeleton?: boolean   // 骨骼
}

export type AvatarSource =
  | { kind: 'builtin' }
  | { kind: 'sprites'; sprites: SpriteSource }
  | { kind: 'live2d'; modelPath: string }
  | { kind: 'vrm'; modelPath: string }

export interface AvatarDescriptor {
  id: string
  name: string
  type: AvatarType
  source: AvatarSource
  capabilities: AvatarCapabilities
  metadata?: { format?: string; note?: string }
}

/**
 * 情绪驱动的身体参数——不是机械的「emotion=sad 播放 sad.png」，
 * 而是 energy/movementSpeed/breathSpeed/lookFrequency 的自然变化。
 */
export interface BodyState {
  energy: number         // 0-1 活力
  movementSpeed: number  // 动作速度倍率
  breathSpeed: number    // 呼吸速度倍率
  lookFrequency: number  // 0-1 看你的频率（偶尔偷看）
  sway: number           // 重心摆动幅度倍率
  lookX: number          // -1..1 视线水平
  lookY: number          // -1..1 视线垂直
}

export const DEFAULT_BODY_STATE: BodyState = {
  energy: 0.5,
  movementSpeed: 1,
  breathSpeed: 1,
  lookFrequency: 0.35,
  sway: 1,
  lookX: 0,
  lookY: 0
}

/** 身体调制系数——气质/世界状态以乘性方式作用到 BodyState 基线 */
export interface BodyModifiers {
  energyScale: number
  movementScale: number
  breathScale: number
  swayScale: number
  lookScale: number
}

export const DEFAULT_BODY_MODIFIERS: BodyModifiers = {
  energyScale: 1,
  movementScale: 1,
  breathScale: 1,
  swayScale: 1,
  lookScale: 1
}
