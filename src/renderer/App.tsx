import { useState, useEffect, useCallback } from 'react'
import { useChatStore } from './stores/chatStore'
import { useAvatarStore } from './stores/avatarStore'
import { ChatView } from './views/ChatView'
import { SettingsView } from './views/SettingsView'
import { WizardView } from './views/WizardView'
import { PetView } from './views/PetView'
import { useIdleBehavior } from './hooks/useIdleBehavior'
import type { SpriteSource, ModelSource } from './components/avatar/modelTypes'
import type { AvatarExpression } from './stores/avatarStore'
import './App.css'

type Screen = 'wizard' | 'desktop'
type Panel = 'chat' | 'settings' | null

export default function App() {
  const [screen, setScreen] = useState<Screen>('desktop')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'pet' | 'panel'>('pet')
  const [panel, setPanel] = useState<Panel>(null)
  const [modelSource, setModelSource] = useState<ModelSource>({ type: 'sprites', sprites: {} })
  const {
    messages, isStreaming, addUserMessage, appendAssistantChunk, finishAssistantMessage
  } = useChatStore()
  const { expression, setExpression } = useAvatarStore()
  const [soulEnergy, setSoulEnergy] = useState(0.8)
  const [soulAttachment, setSoulAttachment] = useState(0.3)
  const [mood, setMood] = useState('neutral')
  const idleState = useIdleBehavior(soulEnergy, soulAttachment)

  // Init
  useEffect(() => {
    async function init() {
      try {
        const hasModel = await window.inkAPI.hasModel()
        if (!hasModel) {
          const firstLaunch = await window.inkAPI.getConfig('first_launch')
          if (firstLaunch !== 'false') {
            await window.inkAPI.setPanelMode()
            setMode('panel'); setScreen('wizard'); setLoading(false); return
          }
        }

        const modelType = await window.inkAPI.getModelType()
        if (modelType === 'live2d') {
          const l2dPath = await window.inkAPI.getLive2DPath()
          if (l2dPath) {
            setModelSource({ type: 'live2d', live2d: { type: 'live2d', modelPath: l2dPath } })
          }
        } else {
          const savedSprites = await window.inkAPI.getModelSprites()
          const source: SpriteSource = {}
          for (const [key, val] of Object.entries(savedSprites)) {
            if (val) (source as any)[key] = val
          }
          setModelSource({ type: 'sprites', sprites: source })
        }
      } catch {}
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    const unsub = window.inkAPI.onWindowMode((newMode) => {
      setMode(newMode)
      if (newMode === 'pet') setPanel(null)
    })
    return unsub
  }, [])

  useEffect(() => {
    const u1 = window.inkAPI.onChatChunk((chunk) => appendAssistantChunk(chunk))
    const u2 = window.inkAPI.onChatDone(() => { finishAssistantMessage(); setExpression('neutral') })
    const u3 = window.inkAPI.onNavigate((page: string) => {
      if (page === 'settings') { setScreen('desktop'); setMode('panel'); setPanel('settings') }
      if (page === 'chat') { setScreen('desktop'); setMode('panel'); setPanel('chat') }
    })
    const u4 = window.inkAPI.onPetExpression(({ expression: expr }) => setExpression(expr as AvatarExpression))
    const u5 = window.inkAPI.onPetMood(({ mood: m }) => setMood(m))
    const u6 = window.inkAPI.onPetSoul(({ energy, attachment }) => { setSoulEnergy(energy); setSoulAttachment(attachment) })
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [])

  const handlePetClick = useCallback(() => { window.inkAPI.setPanelMode(); setPanel('chat') }, [])
  const handlePetContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); window.inkAPI.setPanelMode(); setPanel('chat') }, [])
  const handleBackToPet = useCallback(() => { window.inkAPI.setPetMode() }, [])

  const handleSend = useCallback(async (message: string) => {
    addUserMessage(message); setExpression('happy')
    try { await window.inkAPI.chat(message) } catch {
      appendAssistantChunk('\u62b1\u6b49\uff0c\u6211\u6682\u65f6\u65e0\u6cd5\u56de\u5e94...')
      finishAssistantMessage(); setExpression('sad')
    }
  }, [])

  const handleWizardComplete = useCallback(async () => {
    const modelType = await window.inkAPI.getModelType()
    if (modelType === 'live2d') {
      const l2dPath = await window.inkAPI.getLive2DPath()
      if (l2dPath) setModelSource({ type: 'live2d', live2d: { type: 'live2d', modelPath: l2dPath } })
    } else {
      const savedSprites = await window.inkAPI.getModelSprites()
      const source: SpriteSource = {}
      for (const [key, val] of Object.entries(savedSprites)) {
        if (val) (source as any)[key] = val
      }
      setModelSource({ type: 'sprites', sprites: source })
    }
    setScreen('desktop'); window.inkAPI.setPetMode()
  }, [])

  if (loading) return <div className="app-container" />

  if (screen === 'wizard') {
    return (
      <div className="app-container">
        <WizardView onComplete={handleWizardComplete} />
      </div>
    )
  }

  if (mode === 'pet') {
    return (
      <div className="pet-mode-root">
        <PetView modelSource={modelSource} state={idleState} expression={expression} mood={mood} onClick={handlePetClick} onContextMenu={handlePetContextMenu} />
      </div>
    )
  }

  const exprToState: Record<string, string> = { neutral: 'idle', happy: 'happy', sad: 'sad', surprised: 'surprised', love: 'love' }
  const panelState = panel === 'chat' ? (exprToState[expression] ?? 'idle') : idleState

  return (
    <div className="app-container">
      <div className="title-bar">
        <span className="title-text">InkSpirit</span>
        <div className="title-actions">
          <button className="title-btn" onClick={() => setPanel(panel === 'settings' ? 'chat' : 'settings')}>
            {panel === 'settings' ? '\u2709' : '\u2699'}
          </button>
          <button className="title-btn" onClick={handleBackToPet}>&#8722;</button>
        </div>
      </div>
      <div className="main-content">
        {panel === 'chat' && (
          <ChatView modelSource={modelSource} state={panelState as any} messages={messages} isStreaming={isStreaming} onSend={handleSend} onHeaderClick={handleBackToPet} />
        )}
        {panel === 'settings' && (
          <SettingsView modelSource={modelSource} onModelSourceChange={setModelSource} onBack={() => setPanel('chat')} />
        )}
      </div>
    </div>
  )
}
