import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { Avatar } from '../components/avatar/Avatar'
import { Live2DView } from '../components/avatar/Live2DView'
import type { AnimationState, ModelSource } from '../components/avatar/modelTypes'
import type { AvatarExpression } from '../stores/avatarStore'

interface Bubble { id: number; text: string; type: 'speak' | 'thought'; createdAt: number }
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
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export const PetView = memo(function PetView({ modelSource, expression, mood, onClick, onContextMenu }: PetViewProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [currentState, setCurrentState] = useState<AnimationState>('idle')
  const [override, setOverride] = useState<AnimationState | null>(null)
  const walkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overrideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  // Emotional expression overrides behavior briefly, then fades back
  useEffect(() => {
    if (!expression || expression === 'neutral') return
    setOverride(EXPR_TO_STATE[expression] ?? 'idle')
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 8000)
  }, [expression])

  useEffect(() => () => {
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
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
    if (currentState === 'walk') {
      walkRef.current = setInterval(() => {
        if (dragging.current) return
        window.inkAPI.moveWindowBy(Math.round((Math.random() - 0.5) * 14), Math.round((Math.random() - 0.5) * 6))
      }, 200)
    } else {
      if (walkRef.current) { clearInterval(walkRef.current); walkRef.current = null }
    }
    return () => { if (walkRef.current) clearInterval(walkRef.current) }
  }, [currentState])

  const showBubble = useCallback((text: string, type: 'speak' | 'thought' = 'speak') => {
    const id = ++bubbleId
    setBubbles(prev => [...prev.slice(-2), { id, text, type, createdAt: Date.now() }])
    const t = setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id))
      const i = bubbleTimers.current.indexOf(t)
      if (i >= 0) bubbleTimers.current.splice(i, 1)
    }, 4000 + text.length * 30)
    bubbleTimers.current.push(t)
  }, [])

  useEffect(() => {
    const u1 = window.inkAPI.onPetBehavior(({ behavior }) => {
      const m: Record<string, AnimationState> = { idle: 'idle', walk: 'walk', sit: 'sit', sleep: 'sleep', stretch: 'stretch', yawn: 'yawn', look_around: 'idle', blink: 'blink' }
      setCurrentState(m[behavior] ?? 'idle')
    })
    const u2 = window.inkAPI.onPetSpeak(({ message }) => showBubble(message, 'speak'))
    const u3 = window.inkAPI.onPetThought(({ thought }) => showBubble(thought, 'thought'))
    const u4 = window.inkAPI.onPetUserReturned(() => {})
    return () => { u1(); u2(); u3(); u4() }
  }, [showBubble])

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
      {modelSource.type === 'live2d' ? (
        <Live2DView modelPath={modelSource.live2d.modelPath} state={displayState} width={180} height={200} />
      ) : (
        <Avatar sprites={modelSource.type === 'sprites' ? modelSource.sprites : {}} state={displayState} size={140} />
      )}
      {bubbles.map((b, i) => (
        <div key={b.id} className={`pet-bubble ${b.type}`} style={{ position: 'absolute', top: 6 + i * 42, left: '50%', transform: 'translateX(-50%)' }}>
          {b.text}
        </div>
      ))}
    </div>
  )
})
