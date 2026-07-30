import { useEffect, useRef, useState } from 'react'
import { Application, type IDestroyOptions } from 'pixi.js'

let appInstance: Application | null = null
let appRefCount = 0

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
  width?: number
  height?: number
  onClick?: () => void
}

export function Live2DView({ modelPath, width = 200, height = 200, onClick }: Live2DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !modelPath) return

    let destroyed = false

    async function load() {
      try {
        const { Live2DModel } = await import('pixi-live2d-display')
        const app = getSharedApp(canvasRef.current!, width, height)

        const model = await Live2DModel.from(modelPath)
        if (destroyed) { releaseSharedApp(); return }

        // Center and scale
        const bounds = model.getBounds()
        const scaleX = (width * 0.75) / bounds.width
        const scaleY = (height * 0.85) / bounds.height
        const scale = Math.min(scaleX, scaleY, 0.5)
        model.scale.set(scale)
        model.x = width / 2
        model.y = height * 0.7

        // Try to play idle motion
        try {
          if (typeof (model as any).motion === 'function') {
            (model as any).motion('idle', 0, 3)
          } else if (model.internalModel) {
            const motions = Object.keys(model.internalModel.motions ?? {})
            if (motions.length > 0) {
              model.motion(motions[0])
            }
          }
        } catch {
          // Model might not have motions, that's fine
        }

        app.stage.addChild(model)
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
      <canvas ref={canvasRef} width={width} height={height} />
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          fontSize: 10,
          color: '#ff6b6b',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          模型加载失败
        </div>
      )}
    </div>
  )
}
