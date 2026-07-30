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

export type ModelSource =
  | { type: 'builtin' }
  | { type: 'sprites'; sprites: SpriteSource }
  | { type: 'live2d'; live2d: Live2DSource }

export function resolveSpriteUrl(source: ModelSource, state: AnimationState): string | null {
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
