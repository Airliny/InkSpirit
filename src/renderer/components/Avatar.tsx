import { useEffect, useRef } from 'react'
import {
  Application,
  Graphics,
  Container,
  Text
} from 'pixi.js'

export type Expression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'curious'
  | 'tired'
  | 'love'

interface AvatarProps {
  expression?: Expression
  size?: 'normal' | 'small'
}

export function Avatar({ expression = 'neutral', size = 'normal' }: AvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const faceRef = useRef<Container | null>(null)
  const eyesRef = useRef<{ left: Graphics; right: Graphics } | null>(null)
  const mouthRef = useRef<Graphics | null>(null)
  const blushLeftRef = useRef<Graphics | null>(null)
  const blushRightRef = useRef<Graphics | null>(null)
  const blinkTimerRef = useRef<number>(0)

  const canvasSize = size === 'small' ? 36 : 280
  const scale = canvasSize / 280

  useEffect(() => {
    if (!containerRef.current) return

    const app = new Application()
    appRef.current = app

    async function init() {
      await app.init({
        width: canvasSize,
        height: canvasSize,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 2,
      })

      containerRef.current!.appendChild(app.canvas as HTMLCanvasElement)

      const face = new Container()
      face.scale.set(scale)
      faceRef.current = face

      // Body shadow
      const body = new Graphics()
      body.fill({ color: 0x3a3d54, alpha: 1 })
      body.ellipse(140, 210, 80, 60)
      body.fill({ color: 0x4a4d66, alpha: 1 })
      body.ellipse(140, 260, 100, 70)
      body.fill({ color: 0x3a3d54, alpha: 1 })
      body.roundRect(80, 180, 120, 50, 20)
      face.addChild(body)

      // Ears
      const leftEar = new Graphics()
      leftEar.fill({ color: 0x5c5f7a, alpha: 1 })
      leftEar.ellipse(58, 108, 18, 22)
      leftEar.fill({ color: 0x4a4d66, alpha: 1 })
      leftEar.ellipse(58, 108, 10, 14)
      face.addChild(leftEar)

      const rightEar = new Graphics()
      rightEar.fill({ color: 0x5c5f7a, alpha: 1 })
      rightEar.ellipse(222, 108, 18, 22)
      rightEar.fill({ color: 0x4a4d66, alpha: 1 })
      rightEar.ellipse(222, 108, 10, 14)
      face.addChild(rightEar)

      // Head
      const head = new Graphics()
      head.fill({ color: 0x5c5f7a, alpha: 1 })
      head.circle(140, 120, 70)
      face.addChild(head)

      // Hair
      const hair = new Graphics()
      hair.fill({ color: 0x2c2e3d, alpha: 1 })
      hair.ellipse(140, 78, 75, 40)
      hair.fill({ color: 0x2c2e3d, alpha: 1 })
      hair.ellipse(88, 70, 20, 30)
      hair.ellipse(192, 70, 20, 30)
      face.addChild(hair)

      // Eyes
      const leftEye = new Graphics()
      const rightEye = new Graphics()
      eyesRef.current = { left: leftEye, right: rightEye }

      // Eye whites
      leftEye.fill({ color: 0xffffff, alpha: 1 })
      leftEye.ellipse(115, 118, 18, 20)
      rightEye.fill({ color: 0xffffff, alpha: 1 })
      rightEye.ellipse(165, 118, 18, 20)

      // Pupils
      leftEye.fill({ color: 0x1a1a2e, alpha: 1 })
      leftEye.circle(115, 120, 8)
      leftEye.fill({ color: 0xffffff, alpha: 1 })
      leftEye.circle(113, 117, 3)

      rightEye.fill({ color: 0x1a1a2e, alpha: 1 })
      rightEye.circle(165, 120, 8)
      rightEye.fill({ color: 0xffffff, alpha: 1 })
      rightEye.circle(163, 117, 3)

      face.addChild(leftEye)
      face.addChild(rightEye)

      // Blush
      const blushLeft = new Graphics()
      blushLeft.fill({ color: 0xe8a0a0, alpha: 0.3 })
      blushLeft.ellipse(90, 135, 16, 10)
      blushLeftRef.current = blushLeft
      face.addChild(blushLeft)

      const blushRight = new Graphics()
      blushRight.fill({ color: 0xe8a0a0, alpha: 0.3 })
      blushRight.ellipse(190, 135, 16, 10)
      blushRightRef.current = blushRight
      face.addChild(blushRight)

      // Mouth
      const mouth = new Graphics()
      mouthRef.current = mouth
      drawMouth(mouth, 'neutral')
      face.addChild(mouth)

      // Collarbone / neck area
      const collar = new Graphics()
      collar.fill({ color: 0x4a4d66, alpha: 1 })
      collar.roundRect(110, 180, 60, 30, 10)
      face.addChild(collar)

      app.stage.addChild(face)

      // Idle breathing animation
      let breathTime = 0
      app.ticker.add((ticker) => {
        breathTime += ticker.deltaTime * 0.02
        const breathScale = 1 + Math.sin(breathTime) * 0.01
        face.scale.set(scale * breathScale)

        // Blink every 3-5 seconds
        blinkTimerRef.current += ticker.deltaTime
        if (blinkTimerRef.current > 180 + Math.random() * 120) {
          blinkTimerRef.current = 0
          blinkEyes(face, leftEye, rightEye)
        }
      })
    }

    init()

    return () => {
      app.destroy(true)
    }
  }, [size])

  useEffect(() => {
    if (!mouthRef.current || !eyesRef.current || !blushLeftRef.current || !blushRightRef.current) return
    drawMouth(mouthRef.current, expression)
    updateExpressionAppearance(expression, blushLeftRef.current, blushRightRef.current)
  }, [expression])

  return (
    <div
      ref={containerRef}
      style={{
        width: canvasSize,
        height: canvasSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    />
  )
}

function drawMouth(g: Graphics, expression: Expression) {
  g.clear()
  g.fill({ color: 0x3a3d54, alpha: 1 })

  switch (expression) {
    case 'happy':
      g.moveTo(120, 152)
      g.quadraticCurveTo(140, 172, 160, 152)
      g.stroke({ color: 0x3a3d54, width: 3, alpha: 1 })
      break
    case 'sad':
      g.moveTo(120, 158)
      g.quadraticCurveTo(140, 145, 160, 158)
      g.stroke({ color: 0x3a3d54, width: 3, alpha: 1 })
      break
    case 'surprised':
      g.circle(140, 158, 10)
      break
    case 'curious':
      g.moveTo(120, 155)
      g.quadraticCurveTo(130, 162, 140, 155)
      g.quadraticCurveTo(150, 162, 160, 155)
      g.stroke({ color: 0x3a3d54, width: 2.5, alpha: 1 })
      break
    case 'tired':
      g.moveTo(125, 154)
      g.quadraticCurveTo(140, 148, 155, 154)
      g.stroke({ color: 0x3a3d54, width: 2, alpha: 1 })
      break
    case 'love':
      g.moveTo(125, 155)
      g.quadraticCurveTo(140, 168, 155, 155)
      g.stroke({ color: 0xe88080, width: 3, alpha: 1 })
      break
    default:
      g.moveTo(125, 156)
      g.lineTo(155, 156)
      g.stroke({ color: 0x3a3d54, width: 2.5, alpha: 1 })
  }
}

function updateExpressionAppearance(
  expression: Expression,
  blushLeft: Graphics,
  blushRight: Graphics
) {
  const blushes = expression === 'happy' || expression === 'love' ? 0.5 : 0.2
  blushLeft.clear()
  blushLeft.fill({ color: 0xe8a0a0, alpha: blushes })
  blushLeft.ellipse(90, 135, 16, 10)

  blushRight.clear()
  blushRight.fill({ color: 0xe8a0a0, alpha: blushes })
  blushRight.ellipse(190, 135, 16, 10)

  if (expression === 'love') {
    // Heart particles would go here in future
  }
}

function blinkEyes(face: Container, leftEye: Graphics, rightEye: Graphics) {
  const blinkContainer = new Container()

  const lidLeft = new Graphics()
  lidLeft.fill({ color: 0x5c5f7a, alpha: 1 })
  lidLeft.rect(95, 98, 40, 40)

  const lidRight = new Graphics()
  lidRight.fill({ color: 0x5c5f7a, alpha: 1 })
  lidRight.rect(145, 98, 40, 40)

  blinkContainer.addChild(lidLeft)
  blinkContainer.addChild(lidRight)
  face.addChild(blinkContainer)

  setTimeout(() => {
    face.removeChild(blinkContainer)
  }, 100)
}
