import { useEffect, useRef, useState } from 'react'
import type { Application as PixiApplication } from 'pixi.js'
import type { AnimationState } from './modelTypes'

let appInstance: PixiApplication | null = null
let appRefCount = 0

const MOTION_MAP: Record<string, string> = {
  idle: 'idle', walk: 'walk', sit: 'sit', sleep: 'sleep', stretch: 'stretch',
  yawn: 'yawn', surprised: 'surprised', happy: 'happy', sad: 'sad', love: 'love', blink: 'idle'
}

/** Try loading the Cubism core runtimes (served via cubism:// from resources).
 *  Failure is graceful — Live2D is simply unavailable and we fall back. */
async function tryLoadCubism(): Promise<boolean> {
  const w = window as unknown as Record<string, unknown>
  if (w.Live2DCubismCore && w.Live2D) return true
  for (const file of ['live2dcubismcore.min.js', 'live2d.min.js']) {
    const loaded = await loadScript(`cubism://${file}`)
    if (!loaded) continue
  }
  return !!(w.Live2DCubismCore || w.Live2D)
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

/** Convert an absolute filesystem path to a local:// URL the renderer can fetch */
export function toLocalUrl(absPath: string): string {
  return 'local://' + absPath.replace(/\\/g, '/')
}

async function getSharedApp(canvas: HTMLCanvasElement, width: number, height: number): Promise<PixiApplication> {
  if (appInstance) {
    appRefCount++
    return appInstance
  }
  // Dynamic import: pixi.js (~1MB) is only loaded when a Live2D model is used
  const { Application } = await import('pixi.js')
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
  /** 视线方向（-1..1），模型支持时驱动 focus（偶尔偷看） */
  look?: { x: number; y: number }
  onClick?: () => void
  /** Called when Live2D is unavailable — lets the parent fall back to sprites */
  onLoadError?: (reason: string) => void
}

export function Live2DView({ modelPath, state = 'idle', width = 200, height = 200, look, onClick, onLoadError }: Live2DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped to re-run the load pipeline after a context restore
  const [gen, setGen] = useState(0)

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

  // Sprite 活体化：视线跟随（偶尔偷看）→ 模型 focus（不支持时静默忽略）
  useEffect(() => {
    const model = modelRef.current
    if (!model || !look) return
    try {
      if (typeof model.focus === 'function') {
        model.focus(look.x, look.y)
      }
    } catch {
      // model may not support focus
    }
  }, [look?.x, look?.y])

  useEffect(() => {
    if (!canvasRef.current || !modelPath) return

    let destroyed = false
    let acquired = false
    setError(null)

    // H2: unify the WebGL context lifecycle. lost → release our renderer
    // resources; restored → re-run the load pipeline (the body reconnects,
    // AI/behavior/emotion/position are untouched).
    const canvas = canvasRef.current
    const onContextLost = (e: Event) => {
      e.preventDefault()
      releaseOnce()
    }
    const onContextRestored = () => {
      if (!destroyed) setGen((g) => g + 1)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    // Release the shared Pixi app exactly once per acquisition, so an
    // unmount racing with a slow model load can't destroy an app that
    // another Live2DView is still rendering with.
    function releaseOnce() {
      if (!acquired) return
      acquired = false
      releaseSharedApp()
    }

    async function load() {
      try {
        // Cubism core must be loaded BEFORE the library (it hard-throws otherwise)
        const coreOk = await tryLoadCubism()
        if (!coreOk) {
          const reason = 'Live2D 核心不可用'
          if (!destroyed) {
            setError(reason)
            onLoadError?.(reason)
          }
          return
        }

        const { Live2DModel } = await import('pixi-live2d-display')
        const app = await getSharedApp(canvas, width, height)
        acquired = true

        // The library loads via XHR — must be a fetchable URL, not a raw path
        const model = await Live2DModel.from(toLocalUrl(modelPath))
        if (destroyed) { releaseOnce(); return }

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
        releaseOnce()
        if (!destroyed) {
          const reason = e?.message ?? '模型加载失败'
          setError(reason)
          onLoadError?.(reason)
        }
      }
    }

    load()

    return () => {
      destroyed = true
      modelRef.current = null
      releaseOnce()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [modelPath, width, height, gen])

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
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 4px 16px var(--accent-strong)'
        }}>
          <span style={{ fontSize: Math.min(24, width * 0.22), color: '#fff', fontWeight: 700, opacity: 0.95 }}>
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
          color: 'var(--red)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          模型加载失败
        </div>
      )}
    </div>
  )
}
