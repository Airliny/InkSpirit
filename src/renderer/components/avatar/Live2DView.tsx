import { useEffect, useRef, useState } from 'react'
import { Application, type IDestroyOptions } from 'pixi.js'
import type { AnimationState } from './modelTypes'

let appInstance: Application | null = null
let appRefCount = 0

const MOTION_MAP: Record<string, string> = {
  idle: 'idle', walk: 'walk', sit: 'sit', sleep: 'sleep', stretch: 'stretch',
  yawn: 'yawn', surprised: 'surprised', happy: 'happy', sad: 'sad', love: 'love', blink: 'idle'
}

function getSharedApp(canvas: HTMLCanvasElement, width: number, height: number): Application {
  if (appInstance) {
    appRefCount++
    return appInstance
  }
  const app = new Application({
    view: canvas,
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    resolution: 2,
    autoDensity: true,
  })
  appInstance = app
  appRefCount = 1
  return app
}

function releaseSharedApp(): void {
  appRefCount--
  if (appRefCount <= 0 && appInstance) {
    appInstance.destroy(true)
    appInstance = null
  }
}

interface Live2DViewProps {
  modelPath: string
  state?: AnimationState
  width?: number
  height?: number
  onClick?: () => void
}

export function Live2DView({ modelPath, state = 'idle', width = 200, height = 200, onClick }: Live2DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Switch motion when animation state changes
  useEffect(() => {
    const model = modelRef.current
    if (!model) return
    try {
      const motion = MOTION_MAP[state]
      if (motion && typeof model.motion === 'function') {
        model.motion(motion)
      }
    } catch {
      // model may not have that motion
    }
  }, [state])

  useEffect(() => {
    if (!canvasRef.current || !modelPath) return

    let destroyed = false

    async function load() {
      try {
        const { Live2DModel } = await import('pixi-live2d-display')
        const app = getSharedApp(canvasRef.current!, width, height)

        const model = await Live2DModel.from(modelPath)
        if (destroyed) { releaseSharedApp(); return }

        // Center and scale (getBounds can be unreliable before first render)
        const rawBounds = model.getBounds()
        const boundsW = rawBounds.width > 0 ? rawBounds.width : width
        const boundsH = rawBounds.height > 0 ? rawBounds.height : height
        const scaleX = (width * 0.75) / boundsW
        const scaleY = (height * 0.85) / boundsH
        const scale = Math.min(scaleX, scaleY, 0.5)
        model.scale.set(scale)
        model.x = width / 2
        model.y = height * 0.7

        // Try to play idle motion
        try {
          if (typeof (model as any).motion === 'function') {
            (model as any).motion('idle', 0, 3)
          } else if (model.internalModel) {
            const motions = Object.keys((model.internalModel as any).motions ?? {})
            if (motions.length > 0) {
              model.motion(motions[0])
            }
          }
        } catch {
          // Model might not have motions, that's fine
        }

        app.stage.addChild(model)
        modelRef.current = model
      } catch (e: any) {
        if (!destroyed) {
          setError(e.message)
          releaseSharedApp()
        }
      }
    }

    load()

    return () => {
      destroyed = true
      modelRef.current = null
      releaseSharedApp()
    }
  }, [modelPath, width, height])

  return (
    <div
      onClick={onClick}
      style={{
        width, height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative'
      }}
    >
      <canvas ref={canvasRef} width={width} height={height} style={{ display: error ? 'none' : 'block' }} />
      {error && (
        <div style={{
          width: Math.min(72, width * 0.6),
          height: Math.min(72, height * 0.6),
          borderRadius: '50%',
          background: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 2px 10px rgba(43,42,38,0.2)'
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: Math.min(24, width * 0.22), color: 'var(--paper)', opacity: 0.85 }}>
            砚
          </span>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 2,
          width: '100%',
          fontSize: 9,
          color: 'var(--cinnabar)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          模型加载失败
        </div>
      )}
    </div>
  )
}
