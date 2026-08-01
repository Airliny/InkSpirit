import { IAIClient } from '../brain/ai/types'

export type PersonalityMode = 'companion' | 'professional'

const TASK_WORDS = [
  '代码', '帮我写', '帮我改', '帮我看看', '怎么写', '怎么实现', '怎么配置', '怎么解决',
  '如何', '为什么', '分析', '方案', '翻译', '总结', '报告', '对比', '区别',
  'bug', '报错', '错误', '调试', '数学', '计算', '安装', '部署', '设计', '规划',
  '公式', '语法', '函数', '接口', '数据库', '服务器', '模型', '算法', '修复'
]

const CASUAL_WORDS = [
  '在吗', '在干嘛', '哈哈', '嘿嘿', '嘻嘻', '晚安', '早安', '午安', '无聊',
  '想你', '心情', '今天怎么样', '天气', '累', '开心', '难过', '困', '饿',
  '吃饭', '睡了', '起床', '晚安', '我爱你', '喜欢你', '抱抱', '摸', '陪我'
]

/** Fast rule-based guess; returns null when uncertain (needs the model) */
export function detectModeByRules(text: string): PersonalityMode | null {
  const t = text.toLowerCase()
  const hasTask = TASK_WORDS.some(w => t.includes(w))
  const hasCasual = CASUAL_WORDS.some(w => t.includes(w))
  if (hasTask && !hasCasual) return 'professional'
  if (hasCasual && !hasTask) return 'companion'
  return null
}

const MODE_SYSTEM = `你是对话类型分类器。判断用户这条消息属于哪种：
- task：用户需要你解决问题、写代码、查资料、做分析等（工作/学习任务）
- chat：日常闲聊、寒暄、情感交流、关心问候
只回复一个词：task 或 chat`

/** Model-based classification for uncertain messages (cheap, short prompt) */
async function detectModeByAI(client: IAIClient, text: string): Promise<PersonalityMode> {
  try {
    const res = await client.chat([
      { role: 'system', content: MODE_SYSTEM },
      { role: 'user', content: text.slice(0, 300) }
    ])
    const out = res.content.trim().toLowerCase()
    if (out.startsWith('task')) return 'professional'
    return 'companion'
  } catch {
    return 'companion'
  }
}

/** Decide the mode for this message: rules first (free), model for uncertain cases */
export async function decideMode(client: IAIClient, text: string): Promise<PersonalityMode> {
  const byRules = detectModeByRules(text)
  if (byRules) return byRules
  return detectModeByAI(client, text)
}
