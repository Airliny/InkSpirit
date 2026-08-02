import { useEffect, useRef } from 'react'
import type { AnimationState, BodyState } from '../../../core/avatar/types'
import { DEFAULT_BODY_STATE } from '../../../core/avatar/types'
import { toLocalUrl } from './Live2DView'

interface VRMViewProps {
  modelPath: string
  state?: AnimationState
  bodyState?: BodyState
  size?: number
  held?: boolean
  /** 加载失败 → 父级落到内置身体（绝不隐形） */
  onLoadError?: (reason: string) => void
}

/**
 * 3D 身体（VRM）渲染器。
 * Adapter 只负责 BodyState → BlendShape/骨骼 → three-vrm，自身没有任何灵魂逻辑：
 * 表情来自状态映射（happy→happy preset）、呼吸/摆动/视线来自 BodyState 参数。
 */

// 状态 → VRM 表情预设（无状态 → 全部归零回 neutral）
const STATE_TO_EXPRESSION: Record<string, string> = {
  happy: 'happy',
  love: 'happy',
  sad: 'sad',
  surprised: 'surprised',
  yawn: 'relaxed',
  stretch: 'relaxed',
  idle: 'neutral',
  sit: 'neutral',
  walk: 'neutral',
  blink: 'neutral',
  sleep: 'relaxed'
}

export function VRMView({ modelPath, state = 'idle', bodyState, size = 200, held, onLoadError }: VRMViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bodyRef = useRef(bodyState ?? DEFAULT_BODY_STATE)
  bodyRef.current = bodyState ?? DEFAULT_BODY_STATE
  const stateRef = useRef(state)
  stateRef.current = state
  const heldRef = useRef(!!held)
  heldRef.current = !!held

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let destroyed = false
    let disposed = false
    let raf = 0
    let renderer: any = null
    let scene: any = null
    let camera: any = null
    let vrm: any = null
    let leanSpring = { lean: 0, vel: 0 }
    let lastExpression: string | null = null

    const onContextLost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
    }
    const onContextRestored = () => {
      if (!destroyed) start()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    function release() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      try { renderer?.dispose() } catch { /* dead context */ }
      renderer = null
      scene = null
      camera = null
      vrm = null
    }

    function setExpression(name: string | null) {
      if (!vrm?.expressionManager) return
      try {
        if (lastExpression && lastExpression !== name) vrm.expressionManager.setValue(lastExpression, 0)
        if (name) vrm.expressionManager.setValue(name, 1)
        lastExpression = name
      } catch { /* expression set is best-effort */ }
    }

    /** 每帧：BodyState → 骨骼/表情（呼吸、摆动、视线、被抓后仰） */
    function applyBody(t: number) {
      if (!vrm) return
      const b = bodyRef.current
      const st = stateRef.current

      // 表情（状态映射，受情绪驱动的 state 触发）
      setExpression(STATE_TO_EXPRESSION[st] ?? 'neutral')

      const humanoid = vrm.humanoid
      if (!humanoid) return
      const chest = humanoid.getNormalizedBoneNode?.('chest') ?? humanoid.getNormalizedBoneNode?.('spine')
      const head = humanoid.getNormalizedBoneNode?.('head')
      const hips = humanoid.getNormalizedBoneNode?.('hips')

      // 呼吸：胸骨轻微起伏（速度受情绪与世界状态调制）
      if (chest) {
        const breathe = Math.sin(t * b.breathSpeed * 1.6) * 0.012 * (0.5 + b.energy * 0.5)
        chest.position.y = breathe
        chest.rotation.x = breathe * 1.5
      }

      // 重心摆动：整体左右微摆（sleep/关闭时 0）
      if (hips && b.sway > 0) {
        const sway = Math.sin(t * 0.8) * 0.02 * b.sway
        hips.rotation.z = sway
      }

      // 视线跟随：头部转向（偶尔偷看，方向由 BodyState 传入）
      if (head) {
        head.rotation.x = -b.lookY * 0.18
        head.rotation.y = b.lookX * 0.3
      }

      // 身体惯性：被抓 → 后仰，放下 → 弹性晃动恢复
      if (hips) {
        const target = heldRef.current ? 0.12 : 0
        leanSpring.vel += (target - leanSpring.lean) * 0.09
        leanSpring.vel *= 0.86
        leanSpring.lean += leanSpring.vel
        hips.rotation.x = leanSpring.lean * -0.8
      }

      // 眨眼（自适应，约 3-6 秒一次）+ 睡觉闭眼
      const blinkMgr = vrm.expressionManager
      if (blinkMgr) {
        if (st === 'sleep') {
          blinkMgr.setValue('blink', 1)
        } else if (st === 'blink') {
          blinkMgr.setValue('blink', 1)
        } else {
          const cycle = (t + 2.7) % 4.5
          const blink = cycle > 4.05 ? (cycle - 4.05) / 0.45 : 0
          blinkMgr.setValue('blink', blink)
        }
      }
    }

    async function start() {
      if (disposed || destroyed) return
      try {
        const [{ WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, DirectionalLight, Color, Box3, Vector3 }, { GLTFLoader }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/GLTFLoader.js')
        ])
        if (disposed || destroyed) return

        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const c = canvasRef.current
        if (!c) return
        c.width = Math.round(size * dpr)
        c.height = Math.round(size * dpr)
        c.style.width = `${size}px`
        c.style.height = `${size}px`

        const r = new WebGLRenderer({ canvas: c, alpha: true, antialias: true, premultipliedAlpha: true })
        r.setPixelRatio(dpr)
        r.setSize(size, size)
        renderer = r

        const s = new Scene()
        s.background = null
        scene = s

        const cam = new PerspectiveCamera(30, 1, 0.1, 20)
        cam.position.set(0, 1.15, 1.6)
        camera = cam

        s.add(new AmbientLight(0xffffff, 0.7))
        const dir = new DirectionalLight(0xffffff, 1.1)
        dir.position.set(1, 2, 1.5)
        s.add(dir)

        const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm')
        if (disposed || destroyed) return

        const loader = new GLTFLoader()
        loader.register((parser: unknown) => new VRMLoaderPlugin(parser as never))
        const gltf = await loader.loadAsync(toLocalUrl(modelPath))
        if (disposed || destroyed) { release(); return }

        const loadedVrm = gltf.userData.vrm
        VRMUtils.rotateVRM0(loadedVrm)
        loadedVrm.scene.traverse((obj: { frustumCulled?: boolean; castShadow?: boolean }) => {
          obj.frustumCulled = false
        })
        s.add(loadedVrm.scene)

        // 适配相机：把人形装进视野
        const box = new Box3().setFromObject(loadedVrm.scene)
        const boxSize = box.getSize(new Vector3())
        const fit = 1.6 / (Math.max(boxSize.y, 0.6) || 1.6)
        loadedVrm.scene.scale.setScalar(fit)
        // 缩放后重新取包围盒中心，对齐到底部偏上（脚在地面，脸在视野中央）
        const scaledBox = new Box3().setFromObject(loadedVrm.scene)
        const scaledCenter = scaledBox.getCenter(new Vector3())
        loadedVrm.scene.position.x = -scaledCenter.x
        loadedVrm.scene.position.z = -scaledCenter.z
        loadedVrm.scene.position.y = -scaledCenter.y * 0.8

        vrm = loadedVrm

        const startTime = performance.now()
        const loop = (t: number) => {
          if (disposed || destroyed || !vrm) return
          const time = (t - startTime) / 1000
          applyBody(time)
          vrm.update(time)
          renderer?.render(scene, camera)
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (e: any) {
        release()
        if (!destroyed) {
          onLoadError?.(e?.message ?? '3D 身体加载失败')
        }
      }
    }

    start()

    return () => {
      destroyed = true
      release()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [modelPath, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ pointerEvents: 'none', display: 'block', width: size, height: size }}
    />
  )
}
