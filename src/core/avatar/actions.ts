import type { AnimationState, AvatarCapabilities } from './types'

/**
 * BodyAction Registry —— 身体动作注册表。
 *
 * 行为导演不直接说「摇尾巴」，它说「表达开心」；身体能力过滤器决定
 * 哪个动作能在这个身体上执行：
 *
 *   emotion → candidate actions → capability filter → available action
 *
 * 猫：happy → tail_wave；机器人：happy → light_flash（无 tail 被过滤）。
 * 新增身体格式只需要声明 capabilities，动作自动匹配，行为系统零改动。
 */

export interface BodyAction {
  id: string
  label: string
  /** 这个动作需要身体具备哪些能力 */
  requires: (caps: AvatarCapabilities) => boolean
  /** 动作落到渲染层的状态 */
  state: AnimationState
  /** 同情绪下多个可用动作时按优先级选 */
  priority: number
}

export const ACTIONS: BodyAction[] = [
  // happy
  { id: 'happy_tail', label: '摇尾巴', requires: (c) => !!c.tail, state: 'happy', priority: 50 },
  { id: 'happy_bounce', label: '开心蹦跳', requires: (c) => c.sway || c.motion, state: 'happy', priority: 40 },
  { id: 'happy_smile', label: '开心微笑', requires: (c) => c.expression, state: 'happy', priority: 30 },
  // sad
  { id: 'sad_curl', label: '蜷缩起来', requires: (c) => c.sway, state: 'sad', priority: 40 },
  { id: 'sad_droop', label: '耷拉下来', requires: (c) => c.expression, state: 'sad', priority: 30 },
  // love
  { id: 'love_nuzzle', label: '蹭蹭', requires: (c) => !!c.tail || !!c.face, state: 'love', priority: 50 },
  { id: 'love_snuggle', label: '依偎', requires: (c) => c.sway, state: 'love', priority: 40 },
  { id: 'love_warm', label: '温暖', requires: (c) => c.expression, state: 'love', priority: 30 },
  // surprised
  { id: 'surprised_jump', label: '惊跳', requires: (c) => c.sway, state: 'surprised', priority: 40 },
  { id: 'surprised_face', label: '惊讶表情', requires: (c) => c.expression, state: 'surprised', priority: 30 },
  // tired
  { id: 'tired_yawn', label: '打哈欠', requires: (c) => c.motion, state: 'yawn', priority: 40 },
  { id: 'tired_doze', label: '犯困', requires: (c) => c.sway, state: 'idle', priority: 30 },
  // curious
  { id: 'curious_lean', label: '探头看', requires: (c) => c.look || c.motion, state: 'idle', priority: 40 },
  { id: 'curious_watch', label: '盯着看', requires: (c) => c.look, state: 'idle', priority: 30 }
]

/** 每个情绪 → 候选动作（按 priority 降序排列好，pick 时从前往后） */
const EXPRESSION_ACTION_POOL: Record<string, BodyAction[]> = {
  neutral: [],
  happy: sortByPriority(ACTIONS.filter((a) => a.state === 'happy')),
  sad: sortByPriority(ACTIONS.filter((a) => a.state === 'sad')),
  love: sortByPriority(ACTIONS.filter((a) => a.state === 'love')),
  surprised: sortByPriority(ACTIONS.filter((a) => a.state === 'surprised')),
  tired: sortByPriority(ACTIONS.filter((a) => a.id.startsWith('tired_'))),
  curious: sortByPriority(ACTIONS.filter((a) => a.id.startsWith('curious_')))
}

function sortByPriority(list: BodyAction[]): BodyAction[] {
  return [...list].sort((a, b) => b.priority - a.priority)
}

/**
 * 情绪 → 身体动作（能力过滤后）。没有可用动作时返回 null。
 * 这是「emotion → candidate → capability filter → action」的落地。
 */
export function pickBodyAction(
  expression: string,
  caps: AvatarCapabilities
): BodyAction | null {
  const pool = EXPRESSION_ACTION_POOL[expression] ?? []
  for (const action of pool) {
    if (action.requires(caps)) return action
  }
  return null
}

export function pickActionForExpression(
  expression: string,
  caps: AvatarCapabilities
): AnimationState {
  return pickBodyAction(expression, caps)?.state ?? 'idle'
}

/**
 * 行为导演输出（blink/walk/sit/sleep/…）→ 渲染状态，按身体能力降级：
 * 没有 motion 的身体不会收到 walk/sit/sleep；没有 blink 的不会收到 blink。
 * 机器人身体收到「摇尾巴」意图时，这里安静地变成 idle——导演不需要知道身体是谁。
 */
export function resolveBehaviorState(
  behavior: string,
  caps: AvatarCapabilities
): AnimationState {
  switch (behavior) {
    case 'idle': return 'idle'
    case 'blink': return caps.blink ? 'blink' : 'idle'
    case 'look_around': return caps.look ? 'idle' : 'idle'
    case 'walk': return caps.motion ? 'walk' : 'idle'
    case 'sit': return caps.motion ? 'sit' : 'idle'
    case 'sleep': return caps.motion ? 'sleep' : 'idle'
    case 'stretch': return caps.motion ? 'stretch' : 'idle'
    case 'yawn': return caps.motion ? 'yawn' : 'idle'
    default: return 'idle'
  }
}

/** 身体循环动画池按能力过滤（bodyLoop 的输出在渲染前再降级一次） */
export function filterBodyLoopAnimations(
  animations: readonly string[],
  caps: AvatarCapabilities
): string[] {
  const out: string[] = []
  for (const a of animations) {
    if (a === 'walk' || a === 'sit' || a === 'sleep' || a === 'stretch' || a === 'yawn') {
      if (caps.motion) out.push(a)
    } else if (a === 'blink') {
      if (caps.blink) out.push(a)
    } else {
      out.push(a) // idle / look_around 任何身体都安全
    }
  }
  return out
}
