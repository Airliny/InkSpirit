import { useEffect, useRef } from 'react'
import { createRendererLifecycle } from '../../../core/rendererLifecycle'
import type { AnimationState, BodyState } from '../../../core/avatar/types'
import { DEFAULT_BODY_STATE } from '../../../core/avatar/types'

interface SpriteAnimCanvasProps {
  url: string
  size: number
  state: AnimationState
  bodyState?: BodyState
  /** 身体惯性：被抓住（拖拽）时身体后仰，放下后弹性晃动恢复 */
  held?: boolean
}

// Per-state wave parameters: amplitude (px-ish) and speed
const STATE_PARAMS: Record<string, { amp: number; speed: number }> = {
  idle: { amp: 0.004, speed: 1.6 },
  blink: { amp: 0.004, speed: 1.6 },
  sit: { amp: 0.003, speed: 1.2 },
  walk: { amp: 0.007, speed: 3.2 },
  happy: { amp: 0.006, speed: 3.0 },
  love: { amp: 0.006, speed: 2.6 },
  surprised: { amp: 0.01, speed: 6.0 },
  sleep: { amp: 0.002, speed: 0.7 },
  yawn: { amp: 0.005, speed: 2.4 },
  stretch: { amp: 0.005, speed: 2.2 },
  sad: { amp: 0.002, speed: 1.0 }
}

const VERT_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
uniform float uBreath;      // 呼吸速度倍率（情绪驱动）
uniform float uSwayAmp;     // 重心摆动幅度倍率
uniform float uLookX;       // 视线水平 -1..1
uniform float uLookY;       // 视线垂直 -1..1
uniform float uLean;        // 身体惯性：被抓时后仰 / 放下后弹性晃动
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  // 呼吸：竖直波浪（纸涟漪）
  float wave = sin(uv.y * 9.0 + uTime * uSpeed * uBreath) * uAmp;
  // 重心摆动：缓慢水平摇摆（情绪驱动幅度），sleep 时 uSwayAmp=0 停摆
  float sway = sin(uTime * 0.8) * 0.02 * uSwayAmp;
  // 视线跟随：身体轻微转向游标方向（偶尔偷看）
  float lookX = uLookX * 0.04;
  float lookY = uLookY * 0.02;
  // 身体惯性：垂直剪切（拖拽后仰 / 放下晃动），中心线不动
  float lean = uLean * (uv.y - 0.5) * 1.6;
  vec2 shifted = vec2(uv.x + wave + sway + lookX + lean, uv.y + lookY);
  gl_FragColor = texture2D(uTex, shifted);
}
`

/**
 * WebGL "paper ripple" renderer for static sprites: the image breathes like
 * a living paper doll (Live2D-style feel). GPU-only, negligible cost.
 * Sprite 活体化：呼吸速度/重心摆动/视线跟随由 BodyState（情绪驱动）调制。
 * Falls back gracefully (renders nothing) when WebGL is unavailable.
 */
export function SpriteAnimCanvas({ url, size, state, bodyState, held }: SpriteAnimCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paramsRef = useRef(STATE_PARAMS[state] ?? STATE_PARAMS.idle)
  paramsRef.current = STATE_PARAMS[state] ?? STATE_PARAMS.idle
  const bodyRef = useRef(bodyState ?? DEFAULT_BODY_STATE)
  bodyRef.current = bodyState ?? DEFAULT_BODY_STATE
  // 身体惯性：lean 弹簧（被抓住→后仰，放下→弹性晃动恢复）
  const heldRef = useRef(!!held)
  heldRef.current = !!held
  const leanRef = useRef({ lean: 0, vel: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let raf = 0
    let disposed = false
    let visible = true
    let gl: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    let texture: WebGLTexture | null = null
    let uTime: WebGLUniformLocation | null = null
    let uAmp: WebGLUniformLocation | null = null
    let uSpeed: WebGLUniformLocation | null = null
    let uBreath: WebGLUniformLocation | null = null
    let uSwayAmp: WebGLUniformLocation | null = null
    let uLookX: WebGLUniformLocation | null = null
    let uLookY: WebGLUniformLocation | null = null
    let uLean: WebGLUniformLocation | null = null
    let uRes: WebGLUniformLocation | null = null
    let img: HTMLImageElement | null = null

    // Pause rendering when the canvas is hidden (e.g. settings panel open)
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true
    })
    observer.observe(canvas)

    function cleanupGL() {
      cancelAnimationFrame(raf)
      raf = 0
      if (gl) {
        try {
          gl.deleteTexture(texture)
          gl.deleteProgram(program)
        } catch { /* dead context — nothing to clean */ }
      }
      gl = null
      program = null
      texture = null
    }

    /** Re-entrant: builds (or rebuilds after context restore) all GL resources */
    function buildGL() {
      if (disposed) return
      cleanupGL() // stale resources from the lost context
      gl = (canvasRef.current!.getContext('webgl', { alpha: true, premultipliedAlpha: true }) ||
        canvasRef.current!.getContext('experimental-webgl')) as WebGLRenderingContext | null
      if (!gl || !img) return

      const g = gl
      const w = img.naturalWidth || 1
      const h = img.naturalHeight || 1
      const scale = Math.min(size / w, size / h)
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))
      const c = canvasRef.current!
      c.width = cw
      c.height = ch
      c.style.width = `${cw}px`
      c.style.height = `${ch}px`

      const buf = g.createBuffer()
      g.bindBuffer(g.ARRAY_BUFFER, buf)
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)

      program = compile(g, VERT_SRC, FRAG_SRC)
      if (!program) return

      const aPos = g.getAttribLocation(program, 'aPos')
      g.bindBuffer(g.ARRAY_BUFFER, buf)
      g.enableVertexAttribArray(aPos)
      g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0)

      uTime = g.getUniformLocation(program, 'uTime')
      uAmp = g.getUniformLocation(program, 'uAmp')
      uSpeed = g.getUniformLocation(program, 'uSpeed')
      uBreath = g.getUniformLocation(program, 'uBreath')
      uSwayAmp = g.getUniformLocation(program, 'uSwayAmp')
      uLookX = g.getUniformLocation(program, 'uLookX')
      uLookY = g.getUniformLocation(program, 'uLookY')
      uLean = g.getUniformLocation(program, 'uLean')
      uRes = g.getUniformLocation(program, 'uRes')

      texture = g.createTexture()
      g.bindTexture(g.TEXTURE_2D, texture)
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 1)
      // Premultiply on upload so LINEAR filtering never blends junk RGB from
      // transparent texels into sprite edges (the classic "green fringe")
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)

      const startTime = performance.now()
      const loop = (t: number) => {
        if (disposed || !gl || !program || !texture) return
        // Hidden (display:none / off-screen): skip drawing but keep polling cheaply
        if (!visible) {
          raf = requestAnimationFrame(loop)
          return
        }
        const p = paramsRef.current
        const b = bodyRef.current
        const time = (t - startTime) / 1000
        // 身体惯性弹簧：被抓 → 后仰 0.12；放下 → 阻尼摆动恢复到 0
        const spring = leanRef.current
        const target = heldRef.current ? 0.12 : 0
        spring.vel += (target - spring.lean) * 0.09
        spring.vel *= 0.86
        spring.lean += spring.vel
        g.useProgram(program)
        g.uniform1f(uTime, time)
        g.uniform1f(uAmp, p.amp)
        g.uniform1f(uSpeed, p.speed)
        g.uniform1f(uBreath, b.breathSpeed)
        g.uniform1f(uSwayAmp, b.sway)
        g.uniform1f(uLookX, b.lookX)
        g.uniform1f(uLookY, b.lookY)
        g.uniform1f(uLean, spring.lean)
        g.uniform2f(uRes, cw, ch)
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    // H2: context lifecycle — lost suspends rendering, restored rebuilds
    // everything. AI/behavior/emotion state and window position are untouched.
    const lifecycle = createRendererLifecycle({
      init: buildGL,
      suspend: () => {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    const onContextLost = (e: Event) => {
      e.preventDefault()
      lifecycle.handleContextLost()
    }
    const onContextRestored = () => lifecycle.handleContextRestored()
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    img = new Image()
    img.onload = () => {
      if (!disposed) lifecycle.init()
    }
    img.src = url
    if (img.complete) lifecycle.init()

    return () => {
      disposed = true
      cleanupGL()
      lifecycle.dispose()
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [url, size])

  return <canvas ref={canvasRef} style={{ pointerEvents: 'none', maxWidth: '100%', maxHeight: '100%' }} />
}

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(v, vs)
  gl.compileShader(v)
  if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) return null

  const f = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(f, fs)
  gl.compileShader(f)
  if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) return null

  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null
  return p
}
