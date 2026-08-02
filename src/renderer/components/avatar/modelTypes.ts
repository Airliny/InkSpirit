/** 兼容层：旧代码从这里导入类型；新代码请走 core/avatar（Avatar Engine） */
import type { AnimationState, SpriteSource } from '../../../core/avatar/types'
export type { AnimationState, SpriteSource, Live2DSource, ModelSource } from '../../../core/avatar/types'

export function resolveSpriteUrl(source: { type: 'sprites'; sprites: SpriteSource }, state: AnimationState): string | null {
  if (source.type === 'sprites') {
    const map: Record<string, string | undefined> = {
      idle: source.sprites.idle,
      walk: source.sprites.walk,
      sleep: source.sprites.sleep,
      sit: source.sprites.sit,
      stretch: source.sprites.stretch,
      yawn: source.sprites.yawn,
      surprised: source.sprites.surprised,
      happy: source.sprites.happy || source.sprites.idle,
      sad: source.sprites.sad || source.sprites.idle,
      love: source.sprites.love || source.sprites.happy || source.sprites.idle,
      blink: source.sprites.idle
    }
    return map[state] ?? source.sprites.idle ?? null
  }
  return null
}
