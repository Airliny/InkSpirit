import { IAIClient } from '../brain/ai/types'

/**
 * Identity Intent Layer — 身份理解层。
 *
 * 原则：AI 是理解层，不是审核员。
 * 命名是高语义、低频的行为，不能用关键词规则猜测用户意图——
 * 规则只能理解句式，不能理解意图，还会产生"系统在检查你"的感觉。
 *
 * 流程（与 decideMode 同构：轻量节流 → LLM 语义判断）：
 *   用户输入
 *     ↓
 *   关键词节流（不是判断结果，只是省成本）
 *     ↓
 *   LLM 意图判断（理解层）
 *     ↓
 *   仅 assign_name + 高置信 → identity event（source 永远是 user）
 *   discuss_name / none → 不产生任何事件，继续普通聊天
 */

export type IdentityIntentKind = 'assign_name' | 'discuss_name' | 'none'

export interface IdentityIntent {
  intent: IdentityIntentKind
  /** 候选名字（discuss/none 也可能提到名字，但绝不写入身份） */
  name: string | null
  /** 0-1 */
  confidence: number
}

/**
 * 关键词节流：只有疑似身份变化的句子才进入 LLM 意图判断。
 * 注意：这里是省成本的筛选器，不是判断结果——命中不代表要改名。
 */
export const IDENTITY_KEYWORDS = ['叫', '名字', '称呼', '昵称', '以后', '改成', '改名', '起名']

export function needsIdentityAnalysis(text: string): boolean {
  return IDENTITY_KEYWORDS.some((w) => text.includes(w))
}

/** 只有明确决定 + 高置信才执行改名；拿不准时绝不改名 */
export const IDENTITY_ASSIGN_CONFIDENCE = 0.75

const IDENTITY_INTENT_SYSTEM = `你是身份意图识别层。判断用户这条消息是否在为砚灵（桌面 AI 伙伴）赋予新名字或新称呼。
只回复一个 JSON 对象，不要任何其他文字：
{"intent":"assign_name"或"discuss_name"或"none","name":"名字或null","confidence":0到1的小数}

规则：
- assign_name：用户明确决定给砚灵起名、改名或换称呼。例如"以后叫你墨墨吧"、"我想叫你墨墨"、"从今天起你叫墨墨"、"你叫墨墨吧"、"我觉得你叫墨墨会更适合一点"。name 填新名字。
- discuss_name：用户只是讨论、提议或征求意见，并没有决定。例如"墨墨这个名字怎么样？"、"你觉得墨墨适合我吗？"、"要不叫你墨墨？"、"突然觉得墨墨这个名字挺适合你的"。name 填提到的名字。
- none：与给砚灵命名无关。例如"我朋友家的猫叫墨墨"、"我叫你起床"、"以后再说"。name 填 null。

拿不准时优先 none，其次 discuss_name，绝不把讨论误判为 assign_name。`

/** LLM 语义判断（理解层）。失败或解析不了 → 按 none 处理，不打断聊天 */
export async function analyzeIdentityIntent(client: IAIClient, text: string): Promise<IdentityIntent> {
  try {
    const res = await client.chat([
      { role: 'system', content: IDENTITY_INTENT_SYSTEM },
      { role: 'user', content: text.slice(0, 300) }
    ])
    return parseIdentityIntent(res.content)
  } catch {
    return { intent: 'none', name: null, confidence: 0 }
  }
}

/** 解析 LLM 输出为结构化意图；任何异常都退化为 none（绝不误改名） */
export function parseIdentityIntent(raw: string): IdentityIntent {
  const json = extractJsonObject(raw)
  if (!json) return { intent: 'none', name: null, confidence: 0 }
  try {
    const obj = JSON.parse(json) as { intent?: unknown; name?: unknown; confidence?: unknown }
    const intent = obj.intent === 'assign_name' || obj.intent === 'discuss_name' ? obj.intent : 'none'
    const confidence = typeof obj.confidence === 'number' ? Math.min(1, Math.max(0, obj.confidence)) : 0
    const name = typeof obj.name === 'string'
      ? obj.name.trim().slice(0, 8) || null
      : null
    // 低置信的 assign_name 一律降级：理解层可以不确定，但不能乱改身份
    if (intent === 'assign_name' && confidence < IDENTITY_ASSIGN_CONFIDENCE) {
      return { intent: 'none', name, confidence }
    }
    return { intent, name, confidence }
  } catch {
    return { intent: 'none', name: null, confidence: 0 }
  }
}

/** 提取 JSON 对象（容忍 ```json 围栏或前后多余文字） */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
