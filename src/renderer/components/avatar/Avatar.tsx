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
            pointerEvents: 'none',
            imageRendering: 'pixelated'
          }}
          draggable={false}
        />
      ) : (
        <div style={{
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: '50%',
          background: 'rgba(100,100,200,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.15,
          color: 'rgba(255,255,255,0.3)'
        }}>
          ?
        </div>
      )}
    </div>
  )
}
