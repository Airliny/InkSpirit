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
  const url = resolveSpriteUrl({ type: 'sprites', sprites }, state)

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
      {url ? (
        <img
          src={url}
          alt="pet"
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
            background: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(43,42,38,0.2)'
          }}
        >
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: size * 0.22,
            color: 'var(--paper)',
            opacity: 0.85
          }}>
            砚
          </span>
        </div>
      )}
    </div>
  )
}
