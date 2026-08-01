import { useEffect, useRef } from 'react'
import type { AnimationState } from './modelTypes'

interface SpriteAnimCanvasProps {
  url: string
  size: number
  state: AnimationState
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
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float wave = sin(uv.y * 9.0 + uTime * uSpeed) * uAmp;
  vec2 shifted = vec2(uv.x + wave, uv.y);
  gl_FragColor = texture2D(uTex, shifted);
}
`

/**
 * WebGL "paper ripple" renderer for static sprites: the image breathes like
 * a living paper doll (Live2D-style feel). GPU-only, negligible cost.
 * Falls back gracefully (renders nothing) when WebGL is unavailable.
 */
export function SpriteAnimCanvas({ url, size, state }: SpriteAnimCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paramsRef = useRef(STATE_PARAMS[state] ?? STATE_PARAMS.idle)
  paramsRef.current = STATE_PARAMS[state] ?? STATE_PARAMS.idle

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return

    let raf = 0
    let disposed = false
    let started = false
    let visible = true
    let contextLost = false
    let program: WebGLProgram | null = null
    let texture: WebGLTexture | null = null
    let uTime: WebGLUniformLocation | null = null
    let uAmp: WebGLUniformLocation | null = null
    let uSpeed: WebGLUniformLocation | null = null
    let uRes: WebGLUniformLocation | null = null

    // Pause rendering when the canvas is hidden (e.g. settings panel open)
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true
    })
    observer.observe(canvas)

    // Stop cleanly if the GPU context is lost (driver reset, sleep/wake)
    const onContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      cancelAnimationFrame(raf)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)

    const img = new Image()

    function start() {
      if (started || disposed) return
      started = true
      const c = canvas!
      const g = gl!
      const w = img.naturalWidth || 1
      const h = img.naturalHeight || 1
      const scale = Math.min(size / w, size / h)
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))
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
        if (disposed || contextLost) return
        // Hidden (display:none / off-screen): skip drawing but keep polling cheaply
        if (!visible) {
          raf = requestAnimationFrame(loop)
          return
        }
        const p = paramsRef.current
        const time = (t - startTime) / 1000
        g.useProgram(program)
        g.uniform1f(uTime, time)
        g.uniform1f(uAmp, p.amp)
        g.uniform1f(uSpeed, p.speed)
        g.uniform2f(uRes, cw, ch)
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    img.src = url
    if (img.complete) start()
    else img.onload = () => { if (!disposed) start() }

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      if (texture) gl.deleteTexture(texture)
      if (program) gl.deleteProgram(program)
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
