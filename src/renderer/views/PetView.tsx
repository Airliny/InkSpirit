import { useEffect, useRef, useState, useCallback } from 'react'
import { Avatar } from '../components/avatar/Avatar'
import { Live2DView } from '../components/avatar/Live2DView'
import type { AnimationState, ModelSource } from '../components/avatar/modelTypes'

interface Bubble { id: number; text: string; type: 'speak' | 'thought'; createdAt: number }
let bubbleId = 0

interface PetViewProps {
  modelSource: ModelSource
  state: AnimationState
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export function PetView({ modelSource, state, onClick, onContextMenu }: PetViewProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [currentState, setCurrentState] = useState<AnimationState>(state)
  const walkRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setCurrentState(state) }, [state])

  useEffect(() => {
    if (currentState === 'walk') {
      walkRef.current = setInterval(() => {
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
    setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 4000 + text.length * 30)
  }, [])

  useEffect(() => {
    const u1 = window.inkAPI.onPetBehavior(({ behavior }) => {
      const m: Record<string, AnimationState> = { idle: 'idle', walk: 'walk', sit: 'sit', sleep: 'sleep', stretch: 'stretch', yawn: 'yawn', look_around: 'idle', blink: 'blink' }
      setCurrentState(m[behavior] ?? 'idle')
    })
    const u2 = window.inkAPI.onPetSpeak(({ message }) => showBubble(message, 'speak'))
    const u3 = window.inkAPI.onPetThought(({ thought }) => showBubble(thought, 'thought'))
    const u4 = window.inkAPI.onPetExpression(({ expression: expr }) => {})
    const u5 = window.inkAPI.onPetMood(({ mood: m }) => {})
    const u6 = window.inkAPI.onPetUserReturned(() => {})
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [showBubble])

  return (
    <div className="pet-view" onClick={onClick} onContextMenu={onContextMenu}>
      {modelSource.type === 'live2d' ? (
        <Live2DView modelPath={modelSource.live2d.modelPath} width={180} height={200} />
      ) : (
        <Avatar sprites={modelSource.type === 'sprites' ? modelSource.sprites : {}} state={currentState} size={140} />
      )}
      {bubbles.map(b => (
        <div key={b.id} className={`pet-bubble ${b.type}`} style={{ position: 'absolute', top: -10 - (bubbles.indexOf(b) * 50), left: '50%', transform: 'translateX(-50%)' }}>
          {b.text}
        </div>
      ))}
    </div>
  )
}
