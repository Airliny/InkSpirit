import type { BodyModifiers, BodyState } from './types'

/**
 * 情绪/活动/状态 → 身体参数。
 * 这是「活体感」的核心：情绪不是切换贴图，而是改变身体的呼吸、
 * 摆动、视线频率与活力——动画自然变化。
 * temperament（长期气质）与 world（生活环境）以乘性调制叠加。
 */

export interface BodyStateInput {
  expression: string   // neutral/happy/sad/surprised/curious/tired/love
  activity: string     // idle/listening/thinking/afterSpeak/error
  mood: string         // 心情（sleepy 等）
  state: string        // 当前动画状态（sleep 时身体不该摆动）
  look: { x: number; y: number }
  /** Body Memory：0-1，摸得越多越"期待"你靠近（0.5+ 后视线更勤） */
  touchComfort?: number
  /** 长期气质（关系/人格 → 身体基线） */
  temperament?: BodyModifiers
  /** 生活环境（疲劳/晚睡/作息偏差 → 身体） */
  world?: BodyModifiers
  /** 心境调制（今天的心情，小时~天尺度） */
  moodModifiers?: BodyModifiers
}

type BodyParams = Pick<BodyState, 'energy' | 'movementSpeed' | 'breathSpeed' | 'lookFrequency' | 'sway'>

const EXPRESSION_BODY: Record<string, BodyParams> = {
  neutral: { energy: 0.5, movementSpeed: 1.0, breathSpeed: 1.0, lookFrequency: 0.35, sway: 1.0 },
  happy: { energy: 0.65, movementSpeed: 1.15, breathSpeed: 1.2, lookFrequency: 0.55, sway: 1.15 },
  sad: { energy: 0.3, movementSpeed: 0.7, breathSpeed: 0.85, lookFrequency: 0.2, sway: 0.6 },
  surprised: { energy: 0.8, movementSpeed: 1.2, breathSpeed: 1.35, lookFrequency: 0.6, sway: 0.35 },
  curious: { energy: 0.55, movementSpeed: 0.95, breathSpeed: 1.05, lookFrequency: 0.7, sway: 0.95 },
  tired: { energy: 0.25, movementSpeed: 0.7, breathSpeed: 0.75, lookFrequency: 0.15, sway: 0.5 },
  love: { energy: 0.55, movementSpeed: 0.9, breathSpeed: 1.1, lookFrequency: 0.65, sway: 1.0 }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v))
}

export function computeBodyState(input: BodyStateInput): BodyState {
  const base = EXPRESSION_BODY[input.expression] ?? EXPRESSION_BODY.neutral
  let { energy, movementSpeed, breathSpeed, lookFrequency, sway } = base

  // 对话中：注意力在用户身上，动作安静下来
  if (input.activity === 'thinking') {
    movementSpeed *= 0.5
    lookFrequency = Math.max(lookFrequency, 0.9)
  } else if (input.activity === 'listening') {
    movementSpeed *= 0.6
    lookFrequency = Math.max(lookFrequency, 0.75)
  } else if (input.activity === 'error') {
    energy *= 0.7
    movementSpeed *= 0.6
    lookFrequency *= 0.5
  }

  // 睡觉/熬夜：不摆、慢呼吸
  if (input.state === 'sleep' || input.mood === 'sleepy') {
    sway = 0
    breathSpeed *= 0.7
    movementSpeed *= 0.5
  }

  // Body Memory：被摸得越多，鼠标靠近时越"期待"（视线更勤）
  const comfort = clamp01(input.touchComfort ?? 0)
  if (comfort > 0) {
    lookFrequency = clamp01(lookFrequency + comfort * 0.25)
    if (comfort > 0.5) energy = clamp01(energy + 0.05)
  }

  // 表达层：心境 + 长期气质 + 生活环境（乘性调制，缺层不参与）
  const m = input.moodModifiers
  const t = input.temperament
  const w = input.world
  energy = clamp01(energy * (m?.energyScale ?? 1) * (t?.energyScale ?? 1) * (w?.energyScale ?? 1))
  movementSpeed = clamp(0.2, 2, movementSpeed * (m?.movementScale ?? 1) * (t?.movementScale ?? 1) * (w?.movementScale ?? 1))
  breathSpeed = clamp(0.4, 2, breathSpeed * (m?.breathScale ?? 1) * (t?.breathScale ?? 1) * (w?.breathScale ?? 1))
  sway = Math.max(0, sway * (m?.swayScale ?? 1) * (t?.swayScale ?? 1) * (w?.swayScale ?? 1))
  lookFrequency = clamp01(lookFrequency * (m?.lookScale ?? 1) * (t?.lookScale ?? 1) * (w?.lookScale ?? 1))

  return {
    energy: clamp01(energy),
    movementSpeed: clamp(0.2, 2, movementSpeed),
    breathSpeed: clamp(0.4, 2, breathSpeed),
    lookFrequency: clamp01(lookFrequency),
    sway: Math.max(0, sway),
    lookX: clamp(-1, 1, input.look.x),
    lookY: clamp(-1, 1, input.look.y)
  }
}
