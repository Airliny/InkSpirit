import { consolidateMemories, addMemory } from '../soul/memory'
import { applyEmotionDecay } from '../soul/emotion'
import { tryEvolvePersonality } from '../soul/personality'

export async function reflect(): Promise<{
  memoriesConsolidated: number
  memoriesDecayed: number
}> {
  const consolidated = consolidateMemories()
  applyEmotionDecay()
  return {
    memoriesConsolidated: consolidated,
    memoriesDecayed: 0
  }
}

export async function analyzeConversationForMemories(
  userMessage: string,
  assistantResponse: string,
  conversationId: string
): Promise<void> {
  const keywords = extractKeywords(userMessage)

  if (keywords.length > 0) {
    addMemory(userMessage, {
      type: 'episodic',
      importance: estimateImportance(userMessage, assistantResponse),
      emotionalValence: estimateValence(userMessage),
      emotionalIntensity: estimateIntensity(userMessage),
      tags: keywords.slice(0, 5),
      sourceConversationId: conversationId
    })
  }

  // Personality evolution is rate-limited (6h cooldown) — traits shift slowly across weeks
  detectAndEvolvePersonality(userMessage, assistantResponse)
}

function detectAndEvolvePersonality(userMsg: string, assistantMsg: string): void {
  const combined = userMsg + assistantMsg
  const adjustments: Partial<Record<string, number>> = {}

  if (/哈哈|笑死|好搞笑|逗/.test(combined)) adjustments.humor = 0.65
  if (/温柔|体贴|暖心|照顾/.test(combined)) adjustments.gentleness = 0.7
  if (/专业|技术|代码|分析|原理/.test(combined)) adjustments.professionalism = 0.7
  if (/八卦|随便|轻松|随意/.test(combined)) adjustments.formality = 0.3
  if (/直说|别绕|直接点/.test(combined)) adjustments.formality = 0.2

  if (Object.keys(adjustments).length > 0) {
    tryEvolvePersonality(adjustments as any)
  }
}

function extractKeywords(text: string): string[] {
  const timePatterns = [
    '熬夜', '通宵', '失眠', '睡觉', '早起',
    '咖啡', '茶', '喝', '吃',
    '项目', '工作', '加班', '开会', '代码',
    '音乐', '歌', '电影', '游戏',
    '压力', '累', '焦虑', '开心', '难过',
    '朋友', '家人', '同事',
    '喜欢', '讨厌', '最爱', '生日', '名字', '宠物', '猫', '狗',
    '老板', '考试', '面试', '旅行', '周末', '计划', '梦想',
    '猫', '狗', '跑步', '健身', '运动', '读书', '学习'
  ]
  return timePatterns.filter((kw) => text.includes(kw))
}

function estimateImportance(userMsg: string, assistantMsg: string): number {
  const combined = userMsg + assistantMsg
  let score = 0.3

  const highImportance = ['记住', '重要的', '秘密', '密码', '生日', '名字', '喜欢']
  for (const kw of highImportance) {
    if (combined.includes(kw)) score += 0.15
  }

  const emotions = ['开心', '难过', '生气', '焦虑', '压力', '爱']
  for (const kw of emotions) {
    if (userMsg.includes(kw)) score += 0.1
  }

  if (userMsg.length > 100) score += 0.1

  return Math.min(1, score)
}

function estimateValence(text: string): number {
  const positive = ['开心', '高兴', '喜欢', '爱', '好', '棒', '妙']
  const negative = ['难过', '悲伤', '生气', '烦', '讨厌', '糟', '坏']

  let score = 0
  for (const kw of positive) {
    if (text.includes(kw)) score += 0.2
  }
  for (const kw of negative) {
    if (text.includes(kw)) score -= 0.2
  }
  return Math.max(-1, Math.min(1, score))
}

function estimateIntensity(text: string): number {
  const intense = ['非常', '特别', '很', '太', '极', '超级', '！！', '!!!', '??', '！！！']
  let score = 0.3
  for (const kw of intense) {
    if (text.includes(kw)) score += 0.1
  }
  return Math.min(1, score)
}
