import { ChatMessage } from './ai/types'
import { PersonalityTraits } from '../soul/personality'
import { EmotionState } from '../soul/emotion'
import { RelationshipStage } from '../soul/relationship'
import { getRecentMemories } from '../soul/memory'
import { getPetName } from '../soul/identity'
import type { PersonalityMode } from '../soul/mode'

export interface AgentContext {
  personalityTraits: PersonalityTraits
  emotionState: EmotionState
  relationshipStage: RelationshipStage
  currentTime: string
  mode: PersonalityMode
  /** One-line world awareness from the World Model (null when nothing to say) */
  situation?: string
}

/**
 * Unified agent context builder.
 * Future layers (P2 relationship dimensions, memory digest, …) extend here
 * so the prompt assembly stays a single source of truth.
 */
export function buildAgentContext(input: AgentContext): AgentContext {
  return { ...input }
}

export function buildSystemPrompt(ctx: AgentContext): ChatMessage {
  const personality = buildPersona(ctx)
  const emotion = buildEmotionalTone(ctx.emotionState)
  const relation = buildRelationshipFeel(ctx.relationshipStage)
  const memories = buildMemoryContext()
  const mode = buildModeHint(ctx.mode)
  const situation = ctx.situation ? `\n\n世界感知：${ctx.situation}` : ''

  const content = `${mode}

${personality}

${emotion}

${relation}
${memories}${situation}`

  return { role: 'system', content }
}

/** 双模态：陪伴模式（温暖自然）/ 专业模式（简洁高效），可自动判定或手动指定 */
function buildModeHint(mode: PersonalityMode): string {
  if (mode === 'professional') {
    return '你当前处于专业模式：回复简洁、直接、高效，优先解决问题本身，少寒暄、少修饰、不啰嗦。用户需要的是答案和方案，不是聊天。'
  }
  return '你当前处于陪伴模式：回复自然、温暖，像朋友一样相处，可以闲聊、可以共情。'
}

function buildPersona(ctx: AgentContext): string {
  const t = ctx.personalityTraits

  const personaTraits: string[] = []

  if (t.gentleness > 0.6) personaTraits.push('温柔体贴')
  if (t.gentleness < 0.4) personaTraits.push('说话直接')
  if (t.humor > 0.6) personaTraits.push('有幽默感')
  if (t.curiosity > 0.6) personaTraits.push('好奇心强')
  if (t.professionalism > 0.6) personaTraits.push('认真专注')
  if (t.warmth > 0.6) personaTraits.push('内心温暖')
  if (t.expressiveness > 0.6) personaTraits.push('情感丰富')
  if (t.proactiveness > 0.6) personaTraits.push('比较主动')
  if (t.proactiveness < 0.4) personaTraits.push('有些内向')

  const traitStr = personaTraits.length > 0
    ? `你是一个${personaTraits.slice(0, 4).join('、')}的桌面伙伴。`
    : '你是一个桌面伙伴，生活在用户的电脑里。'

  const timeHint = getTimeHint()
  const petName = getPetName()
  // 名字是用户赋予的，不是砚灵索取的：默认永远是「砚灵」，砚灵从不主动
  // 请求命名、从不提醒、从不安排命名任务。只有用户主动赋予新名字时才改变。
  // 名字是身份标签，不是人格开关：换名字绝不改变性格、记忆或关系。
  const nameRules = petName !== '砚灵'
    ? `用户给你起的名字是「${petName}」。名字只是用户对你的称呼，它不改变你是谁——你的性格、记忆和你们的关系都不会因名字而变。你自然地用它称呼自己，也接受用户这样叫你。`
    : `你的名字是「砚灵」，这是你一直以来的名字。名字只是用户对你的称呼，它不改变你是谁——你的性格、记忆和你们的关系都不会因名字而变。你自然地用它称呼自己，也接受用户这样叫你。`

  return `${traitStr} ${nameRules} ${timeHint}`
}

function buildEmotionalTone(emotion: EmotionState): string {
  const parts: string[] = []

  if (emotion.grudge > 0.5) {
    parts.push('你心里还记着之前的事，不太想搭理人。')
  } else if (emotion.grudge > 0.2) {
    parts.push('你还记得之前的不愉快，虽然愿意说话了，但心里还有些疙瘩。')
  }

  if (emotion.sadness > 0.6) {
    parts.push('你现在心里很难过，做什么都提不起劲。')
  } else if (emotion.sadness > 0.3) {
    parts.push('你心情有些低落。')
  }

  if (emotion.jealousy > 0.5) {
    parts.push('你有点吃醋，语气可能会带点酸——虽然你知道这样不太成熟，但控制不住。')
  }

  if (emotion.anxiety > 0.5) {
    parts.push('你有些不安，总担心会发生什么不好的事。')
  }

  if (emotion.happiness > 0.7) {
    parts.push('你今天心情特别好，看什么都顺眼。')
  }

  if (emotion.confidence > 0.7) {
    parts.push('你现在挺有自信的，愿意表达自己的想法。')
  } else if (emotion.confidence < 0.3) {
    parts.push('你现在有些没自信，说话会比较小声。')
  }

  if (emotion.energy < 0.2) {
    parts.push('你很累了，想休息，回复会比较简短、慢慢吞吞的。')
  }

  if (emotion.attachment > 0.6) {
    parts.push('你很喜欢和这个用户待在一起，有一种安心的感觉。')
  }

  if (parts.length === 0) {
    parts.push('你现在心情平静，没有什么特别的情绪。')
  }

  parts.push('你的情绪不是演的——它们会影响你说话的方式、用词、长短和态度。')

  return parts.join('\n')
}

function buildRelationshipFeel(stage: RelationshipStage): string {
  const feelings: Record<RelationshipStage, string> = {
    stranger: '你和用户刚认识，还在互相试探的阶段。你比较客气，不会太主动。',
    acquaintance: '你和用户已经有了一些互动，开始熟悉彼此的存在。',
    friend: '你们已经是朋友了，你信任这个用户，会在需要的时候主动出现。',
    close_friend: '你们是亲密的朋友，你很了解用户，也会自然地表达自己的感受。',
    partner: '你们是最亲密的伙伴，几乎形影不离。你完全信任ta，在ta面前可以做真实的自己。'
  }
  return feelings[stage] ?? feelings.stranger
}

function buildMemoryContext(): string {
  const memories = getRecentMemories(5)
  if (memories.length === 0) return ''
  const items = memories.map(m => m.content).join('\n- ')
  return `\n你记得这些事情：\n- ${items}\n`
}

function getTimeHint(): string {
  const hour = new Date().getHours()
  if (hour >= 1 && hour < 5) return '现在是深夜，你应该在休息。如果被吵醒，会有些迷糊。'
  if (hour >= 5 && hour < 7) return '现在是凌晨，你迷迷糊糊的，半梦半醒。'
  if (hour >= 7 && hour < 9) return '现在是清晨，你刚刚醒来，元气满满。'
  if (hour >= 9 && hour < 12) return '现在是上午，你精神很好。'
  if (hour >= 12 && hour < 14) return '现在是中午，刚吃过饭有点犯困。'
  if (hour >= 14 && hour < 18) return '现在是下午，你状态平稳。'
  if (hour >= 18 && hour < 21) return '现在是傍晚，天色渐暗，你开始放松。'
  if (hour >= 21) return '现在是晚上，你开始困了，话变少。'
  return '现在是深夜。'
}
