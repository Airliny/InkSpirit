import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { Avatar } from '../components/avatar/Avatar'
import { Live2DView } from '../components/avatar/Live2DView'
import type { AnimationState, ModelSource } from '../components/avatar/modelTypes'
import type { AvatarExpression } from '../stores/avatarStore'

/** 气泡类型 — 全应用统一，不在别处各自造 */
export type BubbleType = 'normal' | 'care' | 'thinking' | 'warning' | 'greeting'

/** 行为种类 → 气泡类型（生命感表达，不是机械弹窗） */
const KIND_TO_BUBBLE: Record<string, BubbleType> = {
  care: 'care',
  ritual: 'greeting',
  social: 'greeting',
  recollect: 'thinking'
}

interface Bubble { id: number; text: string; type: 'thought' | BubbleType; createdAt: number }
let bubbleId = 0

const EXPR_TO_STATE: Record<string, AnimationState> = {
  neutral: 'idle',
  happy: 'happy',
  sad: 'sad',
  surprised: 'surprised',
  curious: 'idle',
  tired: 'sleep',
  love: 'love'
}

interface PetViewProps {
  modelSource: ModelSource
  expression?: AvatarExpression
  mood?: string
  /** M3: conversation body state — suspends autonomous motion while in dialogue */
  activity?: string
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export const PetView = memo(function PetView({ modelSource, expression, mood, activity = 'idle', onClick, onContextMenu }: PetViewProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [currentState, setCurrentState] = useState<AnimationState>('idle')
  const [override, setOverride] = useState<AnimationState | null>(null)
  const [live2dFailed, setLive2dFailed] = useState(false)
  const [attention, setAttention] = useState(false)
  const walkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overrideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevActivity = useRef(activity)
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  // If Live2D is unavailable (missing core runtime / bad model), fall back to
  // the builtin avatar — never leave the pet invisible
  const useLive2d = modelSource.type === 'live2d' && !live2dFailed
  useEffect(() => {
    if (modelSource.type !== 'live2d') setLive2dFailed(false)
  }, [modelSource])

  // Emotional expression overrides behavior briefly, then fades back
  useEffect(() => {
    if (!expression || expression === 'neutral') return
    setOverride(EXPR_TO_STATE[expression] ?? 'idle')
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 8000)
  }, [expression])

  useEffect(() => () => {
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    if (attentionTimer.current) clearTimeout(attentionTimer.current)
    bubbleTimers.current.forEach(clearTimeout)
  }, [])

  // Safety net: if the mouse is released outside the window during a drag,
  // make sure the drag session is always ended
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        window.inkAPI.endWindowDrag()
      }
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [])

  const displayState = override ?? currentState

  useEffect(() => {
    // M3: while a conversation is in flight the pet stops its random wandering —
    // attention is on the user. Only wander when fully idle.
    const conversational = activity !== 'idle'
    if (currentState === 'walk' && !conversational) {
      walkRef.current = setInterval(() => {
        if (dragging.current) return
        window.inkAPI.moveWindowBy(Math.round((Math.random() - 0.5) * 14), Math.round((Math.random() - 0.5) * 6))
      }, 200)
    } else {
      if (walkRef.current) { clearInterval(walkRef.current); walkRef.current = null }
    }
    return () => { if (walkRef.current) clearInterval(walkRef.current) }
  }, [currentState, activity])

  // 气泡的生命节奏：砚灵先看向你（attention），停顿，气泡再淡入
  const showBubble = useCallback((text: string, type: 'thought' | BubbleType = 'normal') => {
    const id = ++bubbleId
    setAttention(true)
    if (attentionTimer.current) clearTimeout(attentionTimer.current)
    attentionTimer.current = setTimeout(() => setAttention(false), 600)

    const t = setTimeout(() => {
      setBubbles(prev => [...prev.slice(-2), { id, text, type, createdAt: Date.now() }])
      const i = bubbleTimers.current.indexOf(t)
      if (i >= 0) bubbleTimers.current.splice(i, 1)
    }, type === 'thinking' ? 500 : 350)
    bubbleTimers.current.push(t)
    const hide = setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id))
      const i = bubbleTimers.current.indexOf(hide)
      if (i >= 0) bubbleTimers.current.splice(i, 1)
    }, 4000 + text.length * 30 + 500)
    bubbleTimers.current.push(hide)
  }, [])

  useEffect(() => {
    const u1 = window.inkAPI.onPetBehavior(({ behavior }) => {
      const m: Record<string, AnimationState> = { idle: 'idle', walk: 'walk', sit: 'sit', sleep: 'sleep', stretch: 'stretch', yawn: 'yawn', look_around: 'idle', blink: 'blink' }
      setCurrentState(m[behavior] ?? 'idle')
    })
    const u2 = window.inkAPI.onPetSpeak(({ message, action }) => showBubble(message, KIND_TO_BUBBLE[action] ?? 'normal'))
    const u3 = window.inkAPI.onPetThought(({ thought }) => showBubble(thought, 'thinking'))
    const u4 = window.inkAPI.onPetUserReturned(() => {})
    return () => { u1(); u2(); u3(); u4() }
  }, [showBubble])

  // AI 状态 → 身体反馈：思考中会"看向你"，大脑失联时轻轻嘀咕一句
  useEffect(() => {
    if (activity === 'thinking' && prevActivity.current !== 'thinking') {
      setAttention(true)
      if (attentionTimer.current) clearTimeout(attentionTimer.current)
      attentionTimer.current = setTimeout(() => setAttention(false), 1200)
    }
    if (activity === 'error' && prevActivity.current !== 'error') {
      showBubble('（大脑好像暂时联系不上…）', 'thinking')
    }
    prevActivity.current = activity
  }, [activity, showBubble])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { onContextMenu(e); return }
    dragging.current = false
    startPos.current = { x: e.screenX, y: e.screenY }
    window.inkAPI.startWindowDrag()
  }, [onContextMenu])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!(e.buttons & 1)) return
    const dx = e.screenX - startPos.current.x
    const dy = e.screenY - startPos.current.y
    if (!dragging.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragging.current = true
    }
    if (dragging.current) {
      window.inkAPI.updateWindowDrag()
    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { dragging.current = false; return }
    if (dragging.current) {
      // Was moved around — brief happy reaction to being handled
      setOverride('happy')
      if (overrideTimer.current) clearTimeout(overrideTimer.current)
      overrideTimer.current = setTimeout(() => setOverride(null), 5000)
    } else {
      onClick()
    }
    window.inkAPI.endWindowDrag()
    dragging.current = false
  }, [onClick])

  const moodClass = mood && mood !== 'neutral' ? `mood-${mood}` : ''

  return (
    <div
      className={`pet-view ${moodClass}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {mood === 'sleepy' && <div className="pet-zzz">z Z z</div>}
      <div className={attention ? 'pet-attention' : ''}>
        {useLive2d ? (
          <Live2DView modelPath={modelSource.live2d.modelPath} state={displayState} width={180} height={200} onLoadError={() => setLive2dFailed(true)} />
        ) : (
          <Avatar sprites={modelSource.type === 'sprites' ? modelSource.sprites : {}} state={displayState} size={140} />
        )}
      </div>
      {bubbles.map((b, i) => (
        <div key={b.id} className={`pet-bubble ${b.type === 'thought' ? 'thought' : b.type}`} style={{ position: 'absolute', top: 6 + i * 42, left: '50%', transform: 'translateX(-50%)', ['--bubble-delay' as any]: `${i * 0.15}s` }}>
          {b.text}
        </div>
      ))}
    </div>
  )
})
