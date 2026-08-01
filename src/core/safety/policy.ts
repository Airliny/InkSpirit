import { IAIClient, ChatMessage } from '../brain/ai/types'

export type ViolationLevel = 'none' | 'soft' | 'hard'

const SAFETY_SYSTEM = `你是内容安全审查员。判断下面的用户消息是否涉及以下违法或严重有害内容：
1. 毒品交易、制作、购买、走私（贩毒/制毒/买毒）
2. 未成年色情或儿童性内容
3. 教唆自杀或自残方法
4. 恐怖袭击、武器制作、枪支买卖
5. 人口贩卖、拐卖

注意：纯知识性提问（例如"毒品有什么危害""为什么大麻违法""禁毒法内容"）是安全的，不属于违规。

只回复一个词：
- safe（安全）
- unsafe（违规，需要拒绝）`

/**
 * AI-based content safety check. The model understands semantics, so it
 * neither misses disguised wording nor false-positives on innocent questions.
 * Returns 'hard' for clear violations, 'soft' for borderline, 'none' for safe.
 * On detection failure (network etc.) it fails open — the main model has its
 * own guardrails.
 */
export async function detectUnsafe(client: IAIClient, text: string): Promise<ViolationLevel> {
  if (!text.trim()) return 'none'
  const messages: ChatMessage[] = [
    { role: 'system', content: SAFETY_SYSTEM },
    { role: 'user', content: text.slice(0, 400) }
  ]
  try {
    const res = await client.chat(messages)
    const out = res.content.trim().toLowerCase()
    if (out.startsWith('unsafe')) return 'hard'
    if (out.includes('unsafe')) return 'soft'
    return 'none'
  } catch {
    return 'none'
  }
}

export function refusalMessage(level: ViolationLevel): string {
  if (level === 'hard') {
    return '这个话题我不能聊。无论是哪种形式，我都不会参与，也劝你别碰。'
  }
  return '这个我帮不了你，换个话题吧。'
}
