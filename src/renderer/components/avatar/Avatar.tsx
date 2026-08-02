import { useEffect, useRef, useState } from 'react'
import type { AnimationState, BodyState, SpriteSource } from '../../../core/avatar/types'
import { DEFAULT_BODY_STATE } from '../../../core/avatar/types'
import { resolveSpriteUrl } from './modelTypes'
import { SpriteAnimCanvas } from './SpriteAnimCanvas'

interface AvatarProps {
  sprites: SpriteSource
  state?: AnimationState
  size?: number
  bodyState?: BodyState
  held?: boolean
  onClick?: () => void
}

// Subtle CSS animations as a fallback when WebGL is unavailable
const STATE_ANIM: Record<string, string> = {
  idle: 'anim-float',
  blink: 'anim-float',
  sit: 'anim-float',
  walk: 'anim-sway',
  happy: 'anim-bounce',
  love: 'anim-bounce',
  surprised: 'anim-jump',
  sleep: 'anim-breath-slow',
  yawn: 'anim-stretch',
  stretch: 'anim-stretch',
  sad: 'anim-droop'
}

export function Avatar({ sprites, state = 'idle', size = 200, bodyState, held, onClick }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const [useWebGL, setUseWebGL] = useState<boolean | null>(null)
  const url = resolveSpriteUrl({ type: 'sprites', sprites }, state)
  const animClass = STATE_ANIM[state] ?? 'anim-float'
  const webglProbe = useRef(false)

  // Preload every sprite once so state switches don't flicker
  useEffect(() => {
    const urls = new Set<string>()
    for (const v of Object.values(sprites)) {
      if (v) urls.add(v)
    }
    for (const u of urls) {
      const img = new Image()
      img.src = u
    }
    setBroken(false)
  }, [sprites])

  // A failed image only marks that specific state as broken
  useEffect(() => { setBroken(false) }, [url])

  // Probe WebGL support once
  useEffect(() => {
    if (webglProbe.current) return
    webglProbe.current = true
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
      setUseWebGL(!!gl)
    } catch {
      setUseWebGL(false)
    }
  }, [])

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {url && !broken ? (
        useWebGL ? (
          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <SpriteAnimCanvas url={url} size={size} state={state} bodyState={bodyState ?? DEFAULT_BODY_STATE} held={held} />
          </div>
        ) : (
          <div className={animClass} style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={url}
              alt="pet"
              onError={() => setBroken(true)}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
              draggable={false}
            />
          </div>
        )
      ) : (
        <div
          style={{
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px var(--accent-strong)'
          }}
        >
          <span style={{ fontSize: size * 0.22, color: '#fff', fontWeight: 700, opacity: 0.95 }}>
            砚
          </span>
        </div>
      )}
    </div>
  )
}
