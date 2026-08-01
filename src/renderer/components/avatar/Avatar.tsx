import { useEffect, useState } from 'react'
import type { AnimationState } from './modelTypes'
import { resolveSpriteUrl } from './modelTypes'
import type { SpriteSource } from './modelTypes'

interface AvatarProps {
  sprites: SpriteSource
  state?: AnimationState
  size?: number
  onClick?: () => void
}

export function Avatar({ sprites, state = 'idle', size = 200, onClick }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const url = resolveSpriteUrl({ type: 'sprites', sprites }, state)

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
          <span style={{
            fontSize: size * 0.22,
            color: '#fff',
            fontWeight: 700,
            opacity: 0.95
          }}>
            砚
          </span>
        </div>
      )}
    </div>
  )
}
