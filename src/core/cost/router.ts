import { getConfig } from '../config'

export type RouteDecision = 'local' | 'cloud' | 'budget_blocked'

// Keywords suggesting complex tasks that need a stronger cloud model
const COMPLEX_KEYWORDS = [
  '项目', '代码', '编程', 'debug', '调试', '分析', '原理', '解释',
  '为什么', '怎么写', '如何', '方案', '设计', '架构', '数学', '英语',
  '翻译', '总结', '报告', '论文', '规划', '建议', '对比', '区别',
  '帮我写', '帮我改', '帮我看看', 'bug', '错误', '报错'
]

// Short casual messages are cheap to answer locally
const CASUAL_WORDS = ['在吗', '在干嘛', '早上好', '晚上好', '中午好', '哈哈', '嘿嘿', '嗯', '哦', '无聊', '晚安', '早安', '嗨', 'hi', 'hello', '你好']

export interface RouterSettings {
  enabled: boolean
  localModel: string | null
  localAvailable: boolean
}

export function getRouterSettings(): RouterSettings {
  return {
    enabled: getConfig('cost_router_enabled') !== 'false',
    localModel: getConfig('local_model') || null,
    localAvailable: getConfig('local_model_available') === 'true'
  }
}

/** Decide which route a message should take */
export function decideRoute(message: string, settings: RouterSettings): RouteDecision {
  if (!settings.enabled) return 'cloud'
  if (!settings.localModel || !settings.localAvailable) return 'cloud'

  const text = message.trim()
  if (!text) return 'cloud'

  // Long or complex messages → cloud
  if (text.length > 60) return 'cloud'
  if (COMPLEX_KEYWORDS.some(k => text.toLowerCase().includes(k.toLowerCase()))) return 'cloud'

  // Short casual chat → local
  const lower = text.toLowerCase()
  if (CASUAL_WORDS.some(w => lower.includes(w.toLowerCase())) || text.length <= 10) {
    return 'local'
  }

  return 'cloud'
}
