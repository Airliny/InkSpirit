import { useEffect, useRef, useState } from 'react'
import type { AnimationState } from './modelTypes'
import { resolveSpriteUrl } from './modelTypes'
import type { SpriteSource } from './modelTypes'

interface AvatarProps {
  sprites: SpriteSource
  state?: AnimationState
  size?: number
  onClick?: () => void
}

// Wave amplitude per state (px). Sleep barely moves to save power.
function waveAmp(state: string): number {
  switch (state) {
    case 'walk': return 3.2
    case 'happy': case 'love': return 3
    case 'surprised': return 4
    case 'yawn': case 'stretch': return 2
    case 'sad': return 1.2
    case 'sleep': return 0.6
    case 'idle': case 'blink': case 'sit': default: return 1.6
  }
}

export function Avatar({ sprites, state = 'idle', size = 200, onClick }: AvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [broken, setBroken] = useState(false)
  const url = resolveSpriteUrl({ type: 'sprites', sprites }, state)

  // Slice-wave animation: the image is drawn as vertical strips, each offset
  // by a travelling sine wave. Very cheap (~24 drawImage calls per frame),
  // runs at ~30fps, and stops when unmounted (pet panel closed).
  useEffect(() => {
    if (!url || broken) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    let raf = 0
    let running = true

    img.onerror = () => setBroken(true)
    img.onload = () => {
      const N = 24
      const canvasW = canvas.width
      const canvasH = canvas.height
      const scale = Math.min(canvasW / img.width, canvasH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      const dx = (canvasW - dw) / 2
      const dy = (canvasH - dh) / 2
      const amp = waveAmp(state)
      const sliceSrcW = img.width / N
      const sliceDstW = dw / N

      let start = performance.now()
      let last = 0
      const STEP = 1000 / 30 // 30fps cap — smooth but gentle on CPU

      const frame = (now: number) => {
        if (!running) return
        if (now - last >= STEP) {
          last = now
          const t = (now - start) / 1000

          ctx.clearRect(0, 0, canvasW, canvasH)
          // Gentle breathing scale
          const breath = 1 + 0.012 * Math.sin(t * 1.1)
          const cx = canvasW / 2
          const cy = canvasH / 2
          ctx.save()
          ctx.translate(cx, cy)
          ctx.scale(breath, breath)
          ctx.translate(-cx, -cy)

          for (let i = 0; i < N; i++) {
            const wave = amp * Math.sin(t * 1.6 + i * 0.65)
            ctx.drawImage(
              img,
              (i / N) * img.width, 0, sliceSrcW, img.height,
              dx + i * sliceDstW, dy + wave, sliceDstW + 0.5, dh
            )
          }
          ctx.restore()
        }
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    }
    img.src = url

    return () => {
      running = false
      cancelAnimationFrame(raf)
    }
  }, [url, broken, state])

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
        <canvas
          ref={canvasRef}
          width={Math.max(1, Math.round(size * 2))}
          height={Math.max(1, Math.round(size * 2))}
          style={{ width: size, height: size }}
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
